/*jshint node:true, strict:false*/

var jshint = require('jshint').JSHINT;
var Promise = require('es6-promise').Promise;
var Processor = require('../processor');
var minimatches = require('../minimatches');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(files) {
	// TODO: Use .jshintrc as input (for options) but leave it out of outputs ('remove it')
	files = minimatches(files, this.config.files);
	return [ new Batch(files, files) ];
};

processor.process = function(batch) {
	// Read-only so return a promise that resolves immediately
	// TODO: Ensure we don't need to wait for all files to be read first (could be changed by other processors?)
	// Just log hint errors as warnings, but pause those logs so they are returned in one block
	var log = this.log;
	Promise.all(batch.inputFiles.map(function(file) {
		return file.read('utf8').then(function(text) {
			if (!jshint(text/*, options, globals*/)) {
				log.pause();
				jshint.errors.forEach(function(error) {
					log.warn('#' + error.code + ': ' + error.reason +
						' [' + file.path + ':' + error.line + ':' + error.character + ']'
					);
				});
			}
		});
	})).then(function() {
		log.resume();
	});
	return Promise.resolve();
};

module.exports = processor;
