'use strict';

var path = require('path');
var util = require('util');
var Processor = require('../processor');
var Batch = require('../batch');
var LessParser = require('less').Parser;

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/\.less$/, '.css');
		return new Batch([ inputPath ], [ outputPath, outputPath + '.map' ]);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	var mapOutput = outputs[1];
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
			// And/or: https://github.com/less/less.js/blob/master/bin/lessc (many more?)
			//
			// Note: I'd prefer to use clean-css compression in a separate processor, but it doesn't support source
			// maps yet, so instead we will just use the LESS compress option instead
			var css = tree.toCSS({
				sourceMap: true,
				outputSourceFiles: true,
				writeSourceMap: mapOutput.resolve,
				compress: true
			});
			css += '\n/*# sourceMappingURL=' + path.basename(mapOutput.path) + ' */';
			output.resolve(css);
		}
	});

};

module.exports = processor;
