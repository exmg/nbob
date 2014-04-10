/*jshint node:true, strict:false*/

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

function Logger(prefix) {
	this.root = log;
	this.prefix = prefix;
	this.paused = false;
}

Logger.prototype.pause = function() {
	this.paused = this.paused || [];
};

Logger.prototype.resume = function() {
	var paused = this.paused;
	if (paused) {
		paused.forEach(function(record) {
			log[record.level].apply(log, record.args);
		});
	}
	this.paused = false;
};

Object.keys(log.levels).concat([ 'help' ]).forEach(function(level) {
	Logger.prototype[level] = function() {
		var args = _.toArray(arguments);
		args.unshift(this.prefix);
		if (this.paused) {
			this.paused.push({ level: level, args: args });
		} else {
			log[level].apply(log, args);
		}
	};
});

log.create = function(prefix) {
	return new Logger(prefix);
};

module.exports = log;
