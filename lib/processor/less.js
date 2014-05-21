'use strict';

var Processor = require('../processor');
var minimatches = require('../minimatches');
var Batch = require('../batch');
var LessParser = require('less').Parser;

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	inputPaths = minimatches(inputPaths, this.config.files);
	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/\.less$/, '.css');
		return new Batch([ inputPath ], [ outputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var log = this.log;
	var input = inputs[0];
	var output = outputs[0];
	var text = input.data;

	var parser = new LessParser({
		paths: [ '.' ],
		filename: input.path
	});

	parser.parse(text, function (error, tree) {
		if (error) {
			output.reject(error.message + ' [' + error.filename + ':' + error.line + ':' + error.index + ']');
		} else {
			output.resolve(tree.toCSS({ compress: true }));
			log.ok('%s', output.path);
		}
	});

};

module.exports = processor;
