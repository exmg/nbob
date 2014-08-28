'use strict';

var _ = require('lodash');
var minimatch = require('minimatch');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var partialsPattern = this.config.partials;
	var partialPaths = [];
	var otherPaths = [];

	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, partialsPattern)) {
			partialPaths.push(inputPath);
		} else {
			otherPaths.push(inputPath);
		}
	});

	if (partialPaths.length === 0 || otherPaths.length === 0) {
		return [];
	}

	var partialInputs = partialPaths.map(function(partialPath) {
		return { path: partialPath, isReadOnly: true };
	});

	return otherPaths.map(function(otherPath) {
		return new Batch([ otherPath ].concat(partialInputs), [ otherPath.replace(/-inc/, '') ]);
	}).concat(new Batch(partialPaths, [])); // end with partials removal batch
};

processor.process = function(inputs, outputs) {
	// Partials removal batch, nothing to do here
	if (outputs.length === 0) {
		return;
	}

	var regex = new RegExp(this.config.regex, 'g');
	var input = inputs[0];
	var partials = inputs.slice(1);
	var output = outputs[0];
	var text = input.data;
	output.resolve(text.replace(regex, function(ref, partialPath) {
		var partial = _.find(partials, { path: partialPath });
		if (!partial) {
			output.reject(new Error('Could not find partial: ' + partialPath + ' [' + input.path + ']'));
		}
		return partial ? partial.data : ref;
	}));
};

module.exports = processor;
