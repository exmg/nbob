'use strict';

function Processor(documentation) {
	this.documentation = documentation;
}

var proto = Processor.prototype;

proto.init = function(name, config, log) {
	this.name = name;
	this.config = config;
	this.log = log;
};

// Returns (a Promise of) an array of Batch instances
// Can optionally use inputFiles to do some initial contents examination before determining batches
// Note: Try to postpone heavy/slow processing until process() is called as much as possible!
proto.getBatches = function(/* inputPaths, inputFiles */) {
	throw new Error('getBatches function undefined');
};

// The inputs and outputs arguments are similar to the inputs and outputs properties of the originating batch,
// but with a property to pass the input data and with functions to resolve or reject the output data:
// inputs: [ { path, type, data, md5 } ]
// outputs: [ { path, type, resolve(data), reject(error) } ]
// Can optionally return a Promise to indicate this is not finished yet when all output data promises have resolved
proto.process = function(/* inputs, outputs */) {
	throw new Error('process function undefined');
};

module.exports = Processor;
