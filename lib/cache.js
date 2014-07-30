'use strict';

var MAX_BUFFER_SIZE = 1024 * 1024;

var fs2 = require('./fs2');
var md5hex = require('./md5hex');
var Promise = require('./promise');
var log = require('./logger').create('cache');

var pathMD5Map = {};
var md5BufferMap = {};
var md5TextMap = {};
var writePromiseMap = {};

function getMD5(path) {
	return pathMD5Map[path];
}

function getByMD5(md5) {
	return md5BufferMap[md5];
}

function getTextByMD5(md5) {
	return md5TextMap[md5];
}

function remember(path, md5, buffer, text) {
	pathMD5Map[path] = md5;
	if (buffer.length <= MAX_BUFFER_SIZE) {
		md5BufferMap[md5] = buffer;
		if (text !== undefined) {
			md5TextMap[md5] = text;
		}
	}
}

function write(path, buffer, message) {
	var promise = fs2.writeFile(path, buffer).then(function() {
		log.spam('Wrote: %s', path);
		return message;
	});
	writePromiseMap[path] = promise;
	return promise;
}

function get(path, md5) {
	md5 = md5 || pathMD5Map[path];
	var buffer = md5BufferMap[md5];
	if (buffer) {
		return Promise.resolve(buffer);
	}

	var readyToRead = writePromiseMap[path] || Promise.resolve();

	return readyToRead.then(function() {
		return fs2.readFile(path).then(function(buffer) {
			md5 = md5 || md5hex(buffer);
			remember(path, md5, buffer);
			return buffer;
		});
	});
}

function set(path, buffer, md5) {
	md5 = md5 || md5hex(buffer);
	// TODO: Fallback to fs2.readFile(path).then(function(buffer) { oldMD5 = md5hex(buffer); }
	// That would prevent false positives on 'added' instead of 'unchanged' or 'changed' and corresponding writes
	var oldMD5 = pathMD5Map[path];
	if (md5 === oldMD5) {
		return Promise.resolve('unchanged');
	}
	remember(path, md5, buffer);
	return write(path, buffer, oldMD5 ? 'changed' : 'added');
}

function getText(path, md5) {
	md5 = md5 || pathMD5Map[path];
	var text = md5TextMap[md5];
	if (text) {
		return Promise.resolve(text);
	}

	var readyToRead = writePromiseMap[path] || Promise.resolve();

	return readyToRead.then(function() {
		return fs2.readFile(path).then(function(buffer) {
			md5 = md5 || md5hex(buffer);
			text = buffer.toString();
			remember(path, md5, buffer, text);
			return text;
		});
	});
}

function setText(path, text, md5) {
	md5 = md5 || md5hex(text);
	var oldMD5 = pathMD5Map[path];
	if (md5 === oldMD5) {
		return Promise.resolve('unchanged');
	}
	var buffer = new Buffer(text);
	remember(path, md5, buffer, text);
	return write(path, buffer, oldMD5 ? 'changed' : 'added');
}

// TODO: Add support for JSON caching through md5JSONMap
function getObject(path, md5) {
	return getText(path, md5).then(function(text) {
		return JSON.parse(text);
	});
}

function setObject(path, object, md5) {
	var text = JSON.stringify(object, null, '\t');
	return setText(path, text, md5);
}

function removePath(path) {
	delete pathMD5Map[path];
}

module.exports = {
	getMD5: getMD5,
	getByMD5: getByMD5,
	getTextByMD5: getTextByMD5,
	get: get,
	set: set,
	getText: getText,
	setText: setText,
	getObject: getObject,
	setObject: setObject,
	removePath: removePath
};
