/*jshint node:true, strict:false*/

var _ = require('lodash');
var log = require('npmlog');
var help = require('./help');

var MAX_PREFIX_LENGTH = 12;

// Replace levels by my own
log.style = {};
log.levels = {};
log.disp = {};
log.addLevel('spam', -Infinity, { fg: 'blue' }, '·');
log.addLevel('debug', 1000, { fg: 'cyan' }, '○');
log.addLevel('info', 2000, { fg: 'green' }, '»');
log.addLevel('ok', 2500, { fg: 'green' }, '✓'); //
log.addLevel('warn', 3000, { fg: 'yellow', bold: true }, '‼');
log.addLevel('error', 4000, { fg: 'red', bold: true }, 'X');
log.addLevel('silent', Infinity);

// Patch for process.exit to end on a clean line after progress bar
var processExit = process.exit;
process.exit = function() {
	if (log.isBarActive()) {
		log.cursor.write('\n');
	}
	processExit.apply(process, arguments);
};

// Check if progress bar is set and ansi cursor is available
log.isBarActive = function() {
	var bar = this.bar;
	var cursor = this.cursor;

	return bar && bar.total > 0 && cursor && this.stream === cursor.stream;
};

// Patch to keep any progress bar at the bottom
var emitLog = log.emitLog;
log.emitLog = function(m) {
	if (this.isBarActive()) {
		this.cursor.horizontalAbsolute(0).eraseLine();
		emitLog.call(log, m);
		this.bar.render();
	} else {
		emitLog.call(log, m);
	}
};

// Convenience function for logging an error and then exiting
log.fatal = function() {
	log.error.apply(log, arguments);
	process.exit(1);
};

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

Object.keys(log.levels).concat([ 'exit', 'fatal', 'help' ]).forEach(function(level) {
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

Logger.create = function(prefix) {
	prefix = prefix.substr(0, MAX_PREFIX_LENGTH);
	var spaces = MAX_PREFIX_LENGTH - prefix.length;
	for (var i = 0; i < spaces; i++) {
		prefix += ' ';
	}
	return new Logger(prefix);
};

module.exports = Logger;
