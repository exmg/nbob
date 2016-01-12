'use strict';

var path = require('path');
var _ = require('lodash');
var Handlebars = require('handlebars');
var sourceMapModule = require('source-map');
var SourceMapGenerator = sourceMapModule.SourceMapGenerator;
var SourceMapConsumer = sourceMapModule.SourceMapConsumer;
var Batch = require('../batch');
var File = require('../file');
var hbsUtil = require('../hbs-util');
var minimatches = require('../minimatches');
var Processor = require('../processor');

var processor = new Processor('http://handlebarsjs.com');
var runtimeFile = new File(path.join(__dirname, '..', '..', 'res', 'handlebars', 'handlebars.runtime.js'));

processor.getBatches = function(inputPaths) {
	if (inputPaths.length === 0) {
		return [];
	}

	var config = this.config;
	var runtimeOutput = config.runtime;

	return inputPaths.map(function(inputPath) {
		return new Batch(
			[ inputPath ],
			[ inputPath + '.js', { path: inputPath + '.js.map', type: 'json' } ],
			{ multiCore: true }
		);
	}).concat(runtimeOutput ? [ new Batch([], [ runtimeOutput ]) ] : []);
};

processor.process = function(inputs, outputs) {
	/*jshint maxstatements:50*/

	var log = this.log;
	var config = this.config;
	var partialPatterns = config.partialFiles;
	var input = inputs[0];
	var output = outputs[0];
	var mapOutput = outputs[1];

	// Handlebars runtime output batch
	if (!input) {
		return runtimeFile.getText().then(function(runtime) {
			// Runtime does not initialize Handlebars.templates for some reason (it does for Handlebars.partials)
			output.resolve(runtime + 'Handlebars.templates = {};\n');
		});
	}

	var inputPath = input.path;
	var inputData = input.data;

	var collection = minimatches(inputPath, partialPatterns) ? 'partials' : 'templates';

	var name = hbsUtil.getName(inputPath, config.nameRegex);

	var options = config.options;
	options = _.extend({}, options, {
		srcName: inputPath, // For SourceMap
		knownHelpers: _.transform(options.knownHelpers, function(map, name) {
			map[name] = true; // Convert array to hash
		})
	});

	try {
		var prefix = 'Handlebars.' + collection + '[' + JSON.stringify(name) + '] = Handlebars.template(';
		var precompiled = Handlebars.precompile(inputData, options);
		var suffix = ');\n';

		// Adapt SourceMap to compensate for code prefix and suffix
		var generator = new SourceMapGenerator({ file: output.path });

		// Handlebars source maps do not include source content; add it
		generator.setSourceContent(inputPath, inputData);

		var sourceMapConsumer = new SourceMapConsumer(precompiled.map);
		sourceMapConsumer.eachMapping(function(mapping) {
			try {
				var generatedLine = mapping.generatedLine;
				generator.addMapping({
					source: mapping.source,
					name: mapping.name,
					original: { line: mapping.originalLine, column: mapping.originalColumn },
					generated: {
						line: generatedLine,
						column: mapping.generatedColumn + (generatedLine === 1 ? prefix.length : 0)
					}
				});
			} catch (error) {
				// Handlebars sometimes returns invalid mappings for some reason; warn and discard those
				log.warn('%s [%s]', error.message, inputPath);
			}
		});

		output.resolve(prefix + precompiled.code + suffix);
		mapOutput.resolve(generator);
	} catch (error) {
		output.reject(hbsUtil.improveError(error, inputPath));
	}
};

module.exports = processor;
