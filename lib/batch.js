'use strict';

function Batch(inputs, outputs) {
	this.inputs = inputs.map(function(input) {
		if (typeof input === 'string') {
			input = { path: input };
		}
		return {
			path: input.path,
			type: input.type || 'text',
			isReadOnly: input.isReadOnly || false
		};
	});

	this.outputs = (outputs || []).map(function(output) {
		if (typeof output === 'string') {
			output = { path: output };
		}
		return {
			path: output.path,
			type: output.type || 'text'
		};
	});
}

module.exports = Batch;
