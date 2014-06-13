'use strict';

var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return [];
};

processor.process = function(inputs, outputs) {
};

module.exports = processor;
