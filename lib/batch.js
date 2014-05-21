'use strict';

var _ = require('lodash');
var validTypes = [ 'buffer', 'text', 'json' ];

function validateType(type) {
	type = type || 'text';
	if (validTypes.indexOf(type) === -1) {
		throw new Error('Invalid type: ' + type);
	}
	return type;
}

function Batch(inputs, outputs) {
	this.inputs = inputs.map(function(input) {
		if (typeof input === 'string') {
			input = { path: input };
		}
		return {
			path: input.path,
			type: validateType(input.type)
		};
	});

	this.outputs = outputs.map(function(output) {
		if (typeof output === 'string') {
			output = { path: output };
		}
		return {
			path: output.path,
			type: validateType(output.type),
			fromPath: output.fromPath
		};
	});
}

var proto = Batch.prototype;

module.exports = Batch;
