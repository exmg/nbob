'use strict';

var _ = require('lodash');
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	// TODO: Also take corresponding .map files as inputs and merge those into a corresponding output
	// Input paths are sorted alphabetically and by file patterns order (see: minimatches)
	// They can be ordered by re-arranging the "files" config or changing their names (p.e: lib/1/z.js, lib/2/a.js)
	return [ new Batch(inputPaths, [ this.config.output ]) ];
};

processor.process = function(inputs, outputs) {
	var texts = _.pluck(inputs, 'data');
	var output = outputs[0];
	output.resolve(texts.join('\n'));
	this.log.ok('%s', output.path);
};

module.exports = processor;
