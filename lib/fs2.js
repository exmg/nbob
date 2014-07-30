/**
 * Alternative to fs module with methods that return Promises and limit the amount of File Descriptors that are used.
 * Limiting the amount of File Descriptors is especially useful on OS X.
 * Note: The alternative graceful-fs also queues FD functions, but uses as many as possible which can be a problem.
 */

'use strict';

var FD_LIMIT = 100;

var fs = require('fs');
var path = require('path');
var Promise = require('./promise');
var promisify = require('./promisify');
var mkdirp = promisify(require('mkdirp'));
var readFile = promisify(fs.readFile);
var writeFile = promisify(fs.writeFile);

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

function readFile2(file) {
	module.exports.reads.push(file);
	return getFDSlot().then(function() {
		return readFile(file).finally(releaseFDSlot);
	});
}

function writeFile2(file, buffer) {
	module.exports.writes.push(file);
	return getFDSlot().then(function() {
		return writeFile(file, buffer).catch(function(error) {
			if (error.code === 'ENOENT') {
				// Oops, looks like we need to make file's directory first
				return mkdirp(path.dirname(file)).then(function() {
					return writeFile(file, buffer);
				});
			}
			throw error;
		}).finally(releaseFDSlot);
	});
}

module.exports = {
	reads: [],
	writes: [],
	readFile: readFile2,
	writeFile: writeFile2
};
