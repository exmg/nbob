/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;
var Processor = require('./processor');
var Batch = require('./batch');

function VaryingProcessor() {
}

var proto = VaryingProcessor.prototype = new Processor();

proto.constructor = VaryingProcessor;

proto.getBatches = function(files) {
	// Use all files as batch inputs to block untill all previous processors have resolved
	// Use Promise of outputs to block all subsequent processors until those are resolved during processing
	var outputsResolve, outputsReject;
	var batch = new Batch(files, new Promise(function(resolve, reject) {
		outputsResolve = resolve;
		outputsReject = reject;
	}));
	batch.outputsResolve = outputsResolve;
	batch.outputsReject = outputsReject;
	return [ batch ];
};

proto.process = function(batch) {
	// Call varying output method with inputFiles then resolve outputFiles once that resolves
	return this.processVarying(batch.inputFiles).then(batch.outputsResolve, batch.outputsReject);
};

module.exports = VaryingProcessor;
