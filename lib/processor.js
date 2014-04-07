/*jshint node:true, strict:false*/

var Batch = require('./batch');

function Processor() {
}

// Default getBatches function returns a single dummy batch
Processor.prototype.getBatches = function(/* paths */) {
	return [ new Batch() ];
};

module.exports = Processor;
