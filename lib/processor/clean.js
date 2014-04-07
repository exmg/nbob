/*jshint node:true, strict:false*/

var path = require('path');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var options = require('../args').options;
var Processor = require('../processor');
var promisify = require('../promisify');
var rimraf = promisify(require('rimraf'));
var log = require('../log').create(__filename);

module.exports = _.assign(new Processor('clean'), {
	// Dummy batch support only
	process: function(/* batch */) {
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
