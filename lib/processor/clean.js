'use strict';

var Promise = require('../promise');
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));

module.exports = function(config, log, inputFiles) {
	var dirs = config.directories;
	log.spam('Remove: %s', dirs.join(', '));
	return Promise.all(dirs.map(function(dir) {
		return rimraf(dir);
	})).then(function() {
		// We did not modify input files (build and dist directories are excluded)
		return inputFiles;
	});
};
