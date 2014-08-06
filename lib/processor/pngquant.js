'use strict';

var fs = require('fs');
var pngquant = require('node-pngquant-native');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var inputs = [ { path: inputPath, type: 'buffer', trackRatio: true } ];
		return new Batch(inputs, inputs, { multiCore: true });
	});
};

processor.process = function(inputs, outputs) {
	var options = this.config.options;
	var input = inputs[0];
	var output = outputs[0];
	// TODO: Remove work around of using fs.readFile; just use input.data instead
	fs.readFile(input.path, function(error, inputBuffer) {
		if (error) {
			output.reject(error);
		} else {
			var outputBuffer = pngquant.compress(inputBuffer, options);
			output.resolve(outputBuffer.length < inputBuffer.length ? outputBuffer : inputBuffer);
		}
	});
};

module.exports = processor;
