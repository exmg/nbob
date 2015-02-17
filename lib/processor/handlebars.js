'use strict';

var path = require('path');
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
		return JSON.stringify(name) + ': t(' + Handlebars.precompile(input.data) + ')';
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
