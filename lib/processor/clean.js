/*jshint node:true, strict:false*/

var Promise = require('../promise');
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));

module.exports = function(config, log, inputFiles) {
	log.spam('Remove: build and dist');
	return Promise.all([
		rimraf('build'),
		rimraf('dist')
	]).then(function() {
		// We did not modify input files (build and dist directories are excluded)
		return inputFiles;
	});
};
