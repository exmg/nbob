/**
 * Alternative to fs module with methods that return Promises and limit the amount of File Descriptors that are used.
 * Limiting the amount of File Descriptors is especially useful on OS X.
 * Note: The alternative graceful-fs also queues FD functions, but uses as many as possible which can be a problem.
 */

'use strict';

var FD_LIMIT = 100;

var _ = require('lodash');
var fs = require('fs');
var Promise = require('./promise');
// TODO: Look at common use cases and see if IO's can be optimized
// var log = require('./logger').create('fs2');

var fdCount = 0;
var fdWaiting = [];

function getFDSlot() {
	return new Promise(function(resolve) {
		if (fdCount++ < FD_LIMIT) {
			resolve();
		} else {
			fdWaiting.push(resolve);
		}
	});
}

function releaseFDSlot() {
	fdCount--;
	if (fdWaiting.length > 0) {
		fdWaiting.shift()();
	}
}

function fdSlotify(asyncFn, thisArg/*, name*/) {
	return function() {
		var args = _.toArray(arguments);
		// log.spam('%s %s', name, args[0]);
		return getFDSlot().then(function() {
			return new Promise(function(resolve, reject) {
				args.push(function(err, val) {
					if (err !== null) {
						reject(err);
					} else {
						resolve(val);
					}
					releaseFDSlot();
				});
				asyncFn.apply(thisArg, args);
			});
		});
	};
}

module.exports = {
	lstat: fdSlotify(fs.lstat, fs, 'lstat'),
	readFile: fdSlotify(fs.readFile, fs, 'readFile'),
	writeFile: fdSlotify(fs.writeFile, fs, 'writeFile')
};
