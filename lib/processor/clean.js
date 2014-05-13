/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));

module.exports = function(config, log, inputFileMap) {
	log.spam('Remove: build and dist');
	return Promise.all([
		rimraf('build'),
		rimraf('dist')
	]).then(function() {
		// We did not modify input files (build and dist directories are excluded)
		return inputFileMap;
	});
};
