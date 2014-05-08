/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;
var VaryingProcessor = require('../varying-processor');
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));

// This is not really a varying output processor, but it provides suitable blocking behavior
var processor = new VaryingProcessor();

processor.processVarying = function(inputFiles) {
	this.log.spam('Remove: build and dist');
	return Promise.all([
		rimraf('build'),
		rimraf('dist')
	]).then(function() {
		// We did not modify inputFiles (build and dist directories are excluded)
		return inputFiles;
	});
};

module.exports = processor;
