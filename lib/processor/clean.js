/*jshint node:true, strict:false*/

var path = require('path');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var options = require('../args').options;
var Processor = require('../processor');
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));

module.exports = _.extend(new Processor(), {
	// Dummy batch support only
	process: function(log) {
		var buildDir = path.join(options.dir, 'build');
		var distDir = path.join(options.dir, 'dist');

		log.spam('Remove: %s', buildDir);
		log.spam('Remove: %s', distDir);

		return Promise.all([
			rimraf(buildDir),
			rimraf(distDir)
		]);
	}
});
