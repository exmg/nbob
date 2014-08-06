'use strict';

var path = require('path');
var minimatch = require('minimatch');
var sass = require('node-sass');
var util = require('util');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var partialsPattern = this.config.partials;
	var partialPaths = [];
	var otherPaths = [];

	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, partialsPattern)) {
			partialPaths.push(inputPath);
		} else {
			otherPaths.push(inputPath);
		}
	});

	if (partialPaths.length === 0 || otherPaths.length === 0) {
		return [];
	}

	var partialInputs = partialPaths.map(function(partialPath) {
		return { path: partialPath, isReadOnly: true };
	});

	return otherPaths.map(function(otherPath) {
		var outPath = otherPath.replace(/.scss$/, '.css');
		return new Batch([ otherPath ].concat(partialInputs), [ outPath ]);
	}).concat(new Batch(partialPaths, [])); // end with partials removal batch
};

processor.process = function(inputs, outputs) {
	// Import removal batch, nothing to do here
	if (outputs.length === 0) {
		return;
	}

	var input = inputs[0];
	var output = outputs[0];
	var inputPath = input.path;
	var inputDir = path.dirname(inputPath).replace(/\\/g, '/'); // convert Windows to Unix path
	var text = input.data;

	// TODO: Add sourceMap support
	// I'm afraid it requires use of file instead of data property, which is not what we want

	// TODO: Have sass use import data from inputs[1,..] instead of it reading the files again itself

	sass.render({
		data: text,
		outputStyle: 'compressed',
		includePaths: [ '.', inputDir ],
		success: function(css) {
			output.resolve(css);
		},
		error: function(message) {
			var file = /(.*?):/.exec(message)[1];
			file = file === 'source string' ? inputPath : file.replace(/([^\/]+)$/, '_$1.scss');
			var line = /:(\d+)/.exec(message)[1];
			message = /error: (.*)\s*/.exec(message)[1];
			output.reject(new Error(util.format('%s [%s:%d]', message, file, line)));
		}
	});
};

module.exports = processor;
