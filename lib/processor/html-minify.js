'use strict';


var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ inputPath ]);
	});
};

// Rudimentary whitespace minification, because html-minifier and minimize npm packages seem like overkill to me
processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	var text = input.data.replace(/\s+/g, ' ').trim();
	output.resolve(text);
};

module.exports = processor;
