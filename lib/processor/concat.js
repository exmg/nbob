'use strict';

var _ = require('lodash');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var config = this.config;

	// Input paths are sorted alphabetically and can be influenced as such (p.e: lib/1/z.js, lib/2/a.js)
	inputPaths = minimatches(inputPaths, config.files).sort();

	return [ new Batch(inputPaths, [ config.output ]) ];
};

processor.process = function(inputs, outputs) {
	var texts = _.pluck(inputs, 'data');
	var output = outputs[0];
	output.resolve(texts.join('\n'));
	this.log.ok('%s', output.path);
};

module.exports = processor;
