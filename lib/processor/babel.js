'use strict';

var util = require('util');
var _ = require('lodash');
var babel = require('babel-core');
var Batch = require('../batch');
var minimatches = require('../minimatches');
var Processor = require('../processor');

var processor = new Processor('http://babeljs.io/');

processor.getBatches = function(inputPaths, inputFiles) {
	// TODO: Implement re-usable support for rc files
	var rcPath = this.config.rcFile;
	var rcFile = _.find(inputFiles, { path: rcPath });

	if (!rcFile) {
		return [];
	}

	return rcFile.getJSON().then(function(rc) {
		var includePatterns = rc.only || [ '**/*' ];
		var excludePatterns = [ rcPath, '**/*.map' ].concat(rc.ignore || []);
		var rcInput = { path: rcPath, type: 'json', isReadOnly: true };

		return inputPaths.filter(function(inputPath) {
			return minimatches(inputPath, includePatterns) && !minimatches(inputPath, excludePatterns);
		}).map(function(inputPath) {
			var inputs = [ rcInput, inputPath ];
			var inputMapPath = inputPath + '.map';
			if (inputPaths.indexOf(inputMapPath) >= 0) {
				inputs.push({ path: inputMapPath, type: 'json' });
			}
			return new Batch(inputs, [ inputPath, { path: inputPath + '.map', type: 'json' } ]);
		}).concat(new Batch([ rcPath ])); // And finally 'remove' the rc file
	});
};

processor.process = function(inputs, outputs) {
	var rcInput = inputs[0];
	var input = inputs[1];
	var mapInput = inputs[2];
	var output = outputs[0];
	var mapOutput = outputs[1];

	// Do nothing when this is the config removal batch
	if (!output) {
		return;
	}

	try {
		var result = babel.transform(input.data, _.extend(rcInput.data, {
			filename: input.path,
			ast: false,
			sourceMaps: true,
			inputSourceMap: mapInput && mapInput.data
		}));
		output.resolve(result.code);
		mapOutput.resolve(result.map);
	} catch (e) {
		// Convert to our error syntax conventions
		var message = e.message.replace(input.path + ': ', '').replace(/^Line \d+: /, '');
		var loc = e.loc || {};
		throw new Error(util.format('%s [%s:%d:%d]', message, input.path, loc.line, loc.column));
	}
};

module.exports = processor;
