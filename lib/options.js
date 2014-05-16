/*jshint node:true, strict:false*/

var fs = require('fs');
var util = require('util');
// Hardcoded here to prevent cyclic dependency
var logLevels = [ 'spam', 'debug', 'ok', 'info', 'warn', 'error', 'silent' ];

module.exports = [ {
	name: 'dir',
	desc: 'Use specified working directory',
	def: process.cwd(),
	test: function(path) {
		var isDirectory = false;
		try {
			isDirectory = fs.statSync(path).isDirectory();
		} catch (e) {}
		return !isDirectory ? 'Not a directory' : null;
	}
}, {
	name: 'env',
	desc: '*Use specified environment config overrides'
}, {
	name: 'level',
	desc: util.format('Use specified log level (%s)', logLevels.join('/')),
	def: 'info',
	test: function(level) {
		return logLevels.indexOf(level) === -1 ? 'Invalid log level' : null;
	}
}, {
	name: 'reload',
	desc: '*Run live-reload server on dist directory'
}, {
	name: 'sync',
	desc: '*Run browser-sync server on dist directory'
} ];
