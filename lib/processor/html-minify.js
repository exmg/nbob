'use strict';

var Minimize = require('minimize');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var inputs = [ { path: inputPath, trackRatio: true } ];
		return new Batch(inputs, inputs);
	});
};

processor.process = function(inputs, outputs) {
	var minimize = new Minimize(this.config.options);
	var input = inputs[0];
	var output = outputs[0];

	minimize.parse(input.data, function (error, data) {
		if (error) {
			output.reject(error);
		} else {
			output.resolve(data);
		}
	});
};

module.exports = processor;
