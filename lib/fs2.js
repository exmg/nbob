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

var log = require('./logger').create('fs2');

var cache = {};
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

function getId(path) {
	try {
		var stat = fs.statSync(path);
		return path + '!!' + stat.size + '-' + stat.mtime.getTime();
	} catch (ex) {
		return path + '!!0-0';
	}
}

function updateCache(path) {
	var newId = getId(path);
	Object.keys(cache).forEach(function(id) {
		if (id.indexOf(path + '!!') === 0 && id !== newId) {
			log.spam('Cache remove', id);
			delete cache[id];
		}
	});
	return newId;
}

var readFile = fdSlotify(fs.readFile, fs, 'readFile');
function cachedReadFile(path) {
	var id = getId(path);
	var cached = cache[id];
	if (cached) {
		log.spam('Cache hit', id);
	} else {
		log.spam('Cache add', id);
	}
	return cached || (cache[id] = readFile(path));
}

var writeFile = fdSlotify(fs.writeFile, fs, 'writeFile');
function cachedWriteFile(path, data) {
	var promise = writeFile(path, data);
	var buffer = data instanceof Buffer ? data : new Buffer(data);
	promise.then(function() {
		var id = updateCache(path);
		cache[id] = Promise.resolve(buffer);
	});
	return promise;
}

// TODO: Extract FS watch from server processor (BrowerSync) and use for both automatic make and invalidation here
// TODO: Also cache lstat and any other FS calls that are frequently made outside of this module
module.exports = {
	lstat: fdSlotify(fs.lstat, fs, 'lstat'),
	readFile: cachedReadFile,
	writeFile: cachedWriteFile,
	updateCache: updateCache
};
