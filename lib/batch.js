/*jshint node:true, strict:false*/

function Batch(inputs, outputs) {
	this.inputs = inputs || [];
	this.outputs = outputs || [];
}

module.exports = Batch;
