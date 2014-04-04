/*jshint node:true, strict:false*/

var path = require('path');
var _ = require('lodash');
var log = require('npmlog');
var help = require('./help');

// Replace levels by my own
log.style = {};
log.levels = {};
log.disp = {};
log.addLevel('spam', -Infinity, { fg: 'blue' }, '·');
log.addLevel('debug', 1000, { fg: 'cyan' }, '○');
log.addLevel('info', 2000, { fg: 'green' }, '»');
log.addLevel('warn', 3000, { fg: 'yellow', bold: true }, '‼');
log.addLevel('error', 4000, { fg: 'red', bold: true }, 'X');
log.addLevel('silent', Infinity);


// Convenience function for logging an error, displaying help and then exiting
log.help = function() {
	log.error.apply(log, arguments);
	help();
	process.exit(1);
};

function Logger(fn) {
	this.root = log;
	this.prefix = path.basename(fn, '.js');
}

Object.keys(log.levels).concat([ 'help' ]).forEach(function(level) {
	Logger.prototype[level] = function() {
		var args = _.toArray(arguments);
		args.unshift(this.prefix);
		log[level].apply(log, args);
	};
});

log.create = function(fn) {
	return new Logger(fn);
};

module.exports = log;
