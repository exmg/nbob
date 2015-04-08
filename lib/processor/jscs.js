'use strict';

// For more info on JSCS, see: https://www.npmjs.org/package/jscs

var util = require('util');
var Checker = require('jscs');
var _ = require('lodash');
var minimatch = require('minimatch');
var Processor = require('../processor');
var Promise = require('../promise');
var Batch = require('../batch');

var processor = new Processor('http://jscs.info/overview.html');

processor.getBatches = function(inputPaths, inputFiles) {
	// TODO: Implement re-usable support for rc files
	var rcPath = this.config.rcFile;
	var rcFile = _.find(inputFiles, { path: rcPath });

	if (!rcFile) {
		return [];
	}

	return rcFile.getJSON().then(function(rc) {
		var excludePatterns = [ rcPath ].concat(rc.excludeFiles || []);
		var rcInput = { path: rcPath, type: 'json', isReadOnly: true };

		return inputPaths.filter(function(inputPath) {
			return !_.find(excludePatterns, function(excludePattern) {
				return minimatch(inputPath, excludePattern);
			});
		}).map(function(inputPath) {
			// Process each input with rc and write the output since we support auto-fixing
			return new Batch([ inputPath, rcInput ], [ { path: inputPath, write: true } ]);
		}).concat(new Batch([ rcPath ])); // And finally 'remove' the rc file again
	});
};

processor.process = function(inputs, outputs) {
	var fix = this.config.fix;
	var input = inputs[0];
	var inputPath = input.path;
	var inputData = input.data;
	var rcInput = inputs[1];
	var output = outputs[0];

	// Do nothing when this is the config removal batch
	if (!output) {
		return;
	}

	var checker = new Checker();
	checker.registerDefaultRules();
	checker.configure(rcInput.data);

	var result = fix ?
		checker.fixString(inputData) :
		{ output: inputData, errors: checker.checkString(inputData) };

	// Always resolve output so-as-to write fixes, even if there are still errors
	output.resolve(result.output);

	var messages = result.errors.getErrorList().map(function(error) {
		return util.format('%s [%s:%d:%d]', error.message, inputPath, error.line, error.column);
	});

	if (messages.length > 0) {
		return Promise.reject(new Error(
			util.format('%s: %d errors\n%s', inputPath, messages.length, messages.join('\n'))
		));
	}
};

module.exports = processor;
