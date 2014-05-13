/*jshint node:true, strict:false*/

function Batch(inputPaths, outputPaths) {
	// Freeze input and output paths so we can use these to securely check the contract later
	this.inputPaths = Object.freeze(inputPaths);
	this.outputPaths = outputPaths ? Object.freeze(outputPaths) : undefined;
}

var proto = Batch.prototype;

proto.isReadOnly = function() {
	return this.outputPaths === undefined;
};

module.exports = Batch;
