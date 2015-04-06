'use strict';

var path = require('path');
var util = require('util');
var Handlebars = require('handlebars');
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
		return new Batch([ inputPath ], [ inputPath + '.js' ]);
	}).concat(runtimeOutput ? [ new Batch([], [ runtimeOutput ]) ] : []);
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var partialPatterns = config.partialFiles;
	var nameRegex = new RegExp(config.nameRegex);
	var input = inputs[0];
	var output = outputs[0];

	// Handlebars runtime output batch
	if (!input) {
		return runtimeFile.getText().then(function(runtime) {
			// Runtime does not initialize Handlebars.templates for some reason (it does for Handlebars.partials)
			output.resolve(runtime + 'Handlebars.templates = {};\n');
		});
	}

	var collection = minimatches(input.path, partialPatterns) ? 'partials' : 'templates';

	var name = input.path;
	name = name.replace(/\\/g, '/'); // convert windows to unix path
	name = name.match(nameRegex)[1]; // extract name from path using regex

	try {
		// TODO: Add sourceMap support (e.g: see handlebars lib/precompiler.js lines 92, 110 and 111)
		output.resolve(
			'Handlebars.' + collection + '[' + JSON.stringify(name) + '] = ' +
			'Handlebars.template(' + Handlebars.precompile(input.data) + ')'
		);
	} catch (error) {
		// Make error message more descriptive and match our conventions for log output

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

		output.reject(new Error(util.format('%s [%s:%d:%d]', message, input.path, row, column)));
	}
};

module.exports = processor;
