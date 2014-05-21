'use strict';

function Batch(inputs, outputs) {
	this.inputs = inputs.map(function(input) {
		if (typeof input === 'string') {
			input = { path: input };
		}
		return {
			path: input.path,
			type: input.type || 'text'
		};
	});

	this.outputs = outputs.map(function(output) {
		if (typeof output === 'string') {
			output = { path: output };
		}
		return {
			path: output.path || output.fromPath,
			type: output.type || 'text',
			fromPath: output.fromPath
		};
	});
}

module.exports = Batch;
