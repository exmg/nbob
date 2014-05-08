/*jshint node:true, strict:false*/

function Processor() {
}

var proto = Processor.prototype;

proto.init = function(config, log) {
	this.config = config;
	this.log = log;
};

proto.getBatches = function(/* files */) {
	throw new Error('Processor getBatches function undefined');
};

// Is passed a batch instance returned earlier by getBatches
// Should return a Promise that resolves after all batch.outputFiles are processed
proto.process = function(/* batch */) {
	throw new Error('Processor process function undefined');
};

module.exports = Processor;
