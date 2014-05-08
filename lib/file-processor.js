/*jshint node:true, strict:false*/

var Processor = require('./processor');
var minimatches = require('./minimatches');
var Batch = require('./batch');

function FileProcessor() {
}

var proto = FileProcessor.prototype = new Processor();

proto.constructor = FileProcessor;

// This requires that this.config.files has the desired minimatches patterns
proto.getBatches = function(files) {
	files = minimatches(files, this.config.files);
	return files.map(function(file) {
		return new Batch([ file ], [ file ]);
	});
};

proto.process = function(batch) {
	var file = batch.inputFiles[0];
	return this.processFile(file);
};

module.exports = FileProcessor;
