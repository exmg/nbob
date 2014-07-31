'use strict';

var fs = require('fs');
var util = require('util');
// Hardcoded here to prevent cyclic dependency
var logLevels = [ 'spam', 'debug', 'info', 'ok', 'warn', 'error', 'silent' ];

module.exports = [ {
	name: 'dir',
	description: 'Use specified working directory',
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
	description: 'Use specified environment config overrides'
}, {
	name: 'level',
	description: util.format('Use specified log level (%s)', logLevels.join('/')),
	def: 'info',
	test: function(level) {
		return logLevels.indexOf(level) === -1 ? 'Invalid log level' : null;
	}
}, {
	name: 'option',
	description: 'Override specified option in config (e.g: -o server.port=8081)'
}, {
	name: 'reload',
	description: '*Run live-reload server on dist directory'
}, {
	name: 'sync',
	description: '*Run browser-sync server on dist directory'
} ];
