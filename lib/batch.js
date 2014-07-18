'use strict';

function Batch(inputs, outputs, options) {
	options = options || {};
	outputs = outputs || [];

	this.inputs = inputs.map(function(input) {
		if (typeof input === 'string') {
			input = { path: input };
		}
		return {
			path: input.path,
			type: input.type || 'text',
			isReadOnly: input.isReadOnly || false,
			trackRatio: input.trackRatio || false
		};
	});

	this.outputs = outputs.map(function(output) {
		if (typeof output === 'string') {
			output = { path: output };
		}
		return {
			path: output.path,
			type: output.type || 'text',
			write: output.write || false,
			trackRatio: output.trackRatio || false
		};
	});

	this.doNotCache = options.doNotCache;
}

module.exports = Batch;
