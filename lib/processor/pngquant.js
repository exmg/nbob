'use strict';

// TODO: Replace this by imagemin processor that also has support for compressing svg?

var pngquant = require('imagemin-pngquant');
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
	var input = inputs[0];
	var output = outputs[0];
	var inputBuffer = input.data;
	pngquant(this.config.options)(inputBuffer).then(function(outputBuffer) {
		output.resolve(outputBuffer.length < inputBuffer.length ? outputBuffer : inputBuffer);
	}, output.reject);
};

module.exports = processor;
