/*jshint node:true, strict:false*/

var fs = require('fs');
var util = require('util');
// Hardcoded here to prevent cyclic dependency
var logLevels = [ 'spam', 'debug', 'info', 'warn', 'error', 'silent' ];

module.exports = [ {
	name: 'dir',
	desc: 'Use specified working directory',
	def: process.cwd(),
	test: function(path) {
		return typeof path === 'string' && fs.statSync(path).isDirectory();
	}
}, {
	name: 'env',
	desc: 'Activate specified environment config overrides'
	// tested later when config
}, {
	name: 'level',
	desc: util.format('Use specified log level (%s)', logLevels.join('/')),
	def: 'info',
	test: function(level) {
		return logLevels.indexOf(level) !== -1;
	}
} ];
