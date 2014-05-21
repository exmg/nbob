'use strict';

function Processor() {
}

var proto = Processor.prototype;

proto.init = function(config, log) {
	this.config = config;
	this.log = log;
};

// Returns an array of Batch instances
proto.getBatches = function(/* inputPaths */) {
	throw new Error('getBatches function undefined');
};

// The inputs and outputs arguments are similar to the inputs and outputs properties of the originating batch,
// but with a property to pass the input data and with functions to resolve or reject the output data:
// inputs: [ { path, type, data } ]
// outputs: [ { path, type, resolve(data), reject(error) } ]
proto.process = function(/* inputs, outputs */) {
	throw new Error('process function undefined');
};

module.exports = Processor;
