'use strict';

var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ inputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	output.resolve(input.data); // TODO: replace __key__ strings by their values
};

module.exports = processor;
