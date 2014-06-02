'use strict';

var util = require('util');
var Processor = require('../processor');
var Batch = require('../batch');
var LessParser = require('less').Parser;

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/\.less$/, '.css');
		return new Batch([ inputPath ], [ outputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	var text = input.data;

	var parser = new LessParser({
		paths: [ '.' ],
		filename: input.path
	});

	parser.parse(text, function (error, tree) {
		if (error) {
			output.reject(new Error(util.format('%s [%s:%d:%d]',
				error.message, error.filename, error.line, error.index)));
		} else {
			// Note: For tree.toCSS() options see: https://github.com/less/less.js/blob/master/lib/less/env.js
			// I think compression might be better handled by another processor down the line
			// Once LESS supports sourcemaps when combined with clean-css that might be a better option instead
			output.resolve(tree.toCSS({ compress: false }));
		}
	});

};

module.exports = processor;
