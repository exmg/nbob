'use strict';

var path = require('path');
var util = require('util');
var Handlebars = require('handlebars');
var Batch = require('../batch');
var File = require('../file');
var minimatches = require('../minimatches');
var Processor = require('../processor');
var Promise = require('../promise');

var processor = new Processor();
var runtimeFile = new File(path.join(__dirname, '..', '..', 'res', 'handlebars', 'handlebars.runtime.js'));

processor.getBatches = function(inputPaths) {
	return inputPaths.length ? [ new Batch(inputPaths, [ this.config.output ]) ] : [];
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var partialPatterns = config.partialFiles;
	var nameRegex = new RegExp(config.nameRegex);
	var output = outputs[0];

	function inputToString(input) {
		var name = input.path;
		name = name.replace(/\\/g, '/'); // convert windows to unix path
		name = name.match(nameRegex)[1]; // extract name from path using regex
		try {
			return JSON.stringify(name) + ': t(' + Handlebars.precompile(input.data) + ')';
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

			throw new Error(util.format('%s [%s:%d:%d]', message, input.path, row, column));
		}
	}

	var templateInputs = [];
	var partialInputs = [];
	inputs.forEach(function(input) {
		if (minimatches(input.path, partialPatterns)) {
			partialInputs.push(input);
		} else {
			templateInputs.push(input);
		}
	});

	var runtimePromise = !config.runtime ? Promise.resolve('') : runtimeFile.getText();
	return runtimePromise.then(function(runtime) {
		// TODO: Add sourceMap support (e.g: see handlebars lib/precompiler.js lines 92, 110 and 111)
		output.resolve(
			'/*jshint ignore:start*/\n/*jscs:disable*/\n' + runtime +
			'(function() { var h = Handlebars, t = h.template; ' +
			'h.templates = { ' + templateInputs.map(inputToString).join(', ') + ' }; ' +
			'h.partials = { ' + partialInputs.map(inputToString).join(', ') + ' }; ' +
			' }());\n'
		);
	});
};

module.exports = processor;
