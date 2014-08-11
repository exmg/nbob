'use strict';

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
	var inputBuffer = input.data;
	var outputBuffer = pngquant.compress(inputBuffer, options);
	output.resolve(outputBuffer.length < inputBuffer.length ? outputBuffer : inputBuffer);
};

module.exports = processor;
