'use strict';

var path = require('path');
var util = require('util');
var _ = require('lodash');
var Handlebars = require('handlebars');
var sourceMapModule = require('source-map');
var SourceMapGenerator = sourceMapModule.SourceMapGenerator;
var SourceMapConsumer = sourceMapModule.SourceMapConsumer;
var Batch = require('../batch');
var File = require('../file');
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
		return new Batch([ inputPath ], [ inputPath + '.js', { path: inputPath + '.js.map', type: 'json' } ]);
	}).concat(runtimeOutput ? [ new Batch([], [ runtimeOutput ]) ] : []);
};

// Make error message more descriptive and match our conventions for log output
function improveError(error, inputPath) {
	// Note: Unfortunately error.lineNumber and error.column will not mean much after make:html:minify
	// Ideally that would create a source map and we would support that from here on in
	// For now you can temporarily disable html:minify by using the debug environment
	var message = error.message;
	var row = error.lineNumber;
	var column = error.column || 0;
	var matches;

	// "Parse error on line xx: ..."
	matches = message.match(/(.*) on line (\d+):.*/);
	if (matches) {
		message = matches[1];
		row = matches[2];
	}

	// "... - xx:yy"
	matches = message.match(/(.*) - (\d+):(\d+)$/);
	if (matches) {
		message = matches[1];
		row = matches[2];
		column = matches[3];
	}

	error.message = util.format('%s [%s:%d:%d]', message, inputPath, row, column);
	return error;
}

processor.process = function(inputs, outputs) {
	/*jshint maxstatements:50*/

	var log = this.log;
	var config = this.config;
	var partialPatterns = config.partialFiles;
	var nameRegex = new RegExp(config.nameRegex);
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

	var name = inputPath;
	name = name.replace(/\\/g, '/'); // convert windows to unix path
	name = name.match(nameRegex)[1]; // extract name from path using regex

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
		var generator = new SourceMapGenerator({ file: path.basename(inputPath) });

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
		output.reject(improveError(error, inputPath));
	}
};

module.exports = processor;
