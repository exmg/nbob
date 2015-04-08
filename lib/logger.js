'use strict';

var _ = require('lodash');
var log = require('npmlog');

var MAX_PREFIX_LENGTH = 12;
var nrTrackers = 0;
var loggerMap = {};
var trackerGroup = log.newGroup();

// Replace levels by my own
log.style = {};
log.levels = {};
log.disp = {};
log.addLevel('spam', -Infinity, { fg: 'blue' }, '·');
log.addLevel('debug', 1000, { fg: 'cyan' }, '○');
log.addLevel('info', 2000, { fg: 'green' }, '»');
log.addLevel('ok', 2500, { fg: 'green' }, '✓');
log.addLevel('warn', 3000, { fg: 'yellow', bold: true }, '‼');
log.addLevel('error', 4000, { fg: 'red', bold: true }, 'X');
log.addLevel('silent', Infinity);

// TODO: Add some extra color highlighting options, p.e: highlighted suffixes like: (press control-c to break)

// Convenience function for logging an error and then exiting
log.fatal = function() {
	log.error.apply(log, arguments);
	process.exit(1);
};

function Logger(prefix) {
	this.root = log;
	this.prefix = prefix;
	this.paused = false;
}

var proto = Logger.prototype;

proto.pause = function() {
	this.paused = this.paused || [];
};

proto.resume = function() {
	var paused = this.paused;

	if (paused) {
		paused.forEach(function(record) {
			log[record.level].apply(log, record.args);
		});
	}

	this.paused = false;
};

proto.addWork = function(todo) {
	var tracker = this.tracker;

	if (!tracker) {
		tracker = this.tracker = trackerGroup.newItem(this.prefix);

		if (++nrTrackers === 1) {
			log.enableProgress();
		}
	}

	tracker.addWork(todo);
};

proto.completeWork = function(todo) {
	var tracker = this.tracker;

	if (!tracker) {
		return;
	}

	tracker.completeWork(todo);

	if (tracker.completed() === 1) {
		this.finishWork();
	}
};

proto.finishWork = function() {
	var tracker = this.tracker;

	if (!tracker) {
		return;
	}

	tracker.finish();
	delete this.tracker;

	var trackGroup = trackerGroup.trackGroup;
	trackGroup.splice(trackGroup.indexOf(tracker), 1);
	trackerGroup.totalWeight -= 1;

	if (--nrTrackers === 0) {
		log.disableProgress();
	}
};

Object.keys(log.levels).concat([ 'exit', 'fatal', 'help' ]).forEach(function(level) {
	proto[level] = function() {
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

	var logger = loggerMap[prefix];
	if (!logger) {
		logger = loggerMap[prefix] = new Logger(prefix);
	}
	return logger;
};

Logger.finishAllWork = function() {
	_.each(loggerMap, function(logger) {
		logger.finishWork();
	});
};

module.exports = Logger;
