/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;

function Batch(inputFiles, outputFiles) {
	this.inputFiles = inputFiles || [];
	this.outputFilesPromise = outputFiles instanceof Promise ? outputFiles : Promise.resolve(outputFiles);
}

module.exports = Batch;
