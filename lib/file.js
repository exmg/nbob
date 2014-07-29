'use strict';

var fs2 = require('./fs2');
var md5hex = require('./md5hex');
var Promise = require('./promise');

function File(filePath) {
	this.path = filePath;
}

var proto = File.prototype;

proto.getBuffer = function() {
	if (!this.bufferPromise) {
		this.bufferPromise = fs2.readFile(this.path);
	}
	return this.bufferPromise;
};

proto.setBuffer = function(buffer) {
	this.invalidate();
	this.bufferPromise = Promise.resolve(buffer);
	return this.bufferPromise;
};

proto.getText = function() {
	return this.getBuffer().then(function(buffer) {
		return buffer.toString();
	});
};

proto.getJSON = function() {
	return this.getText().then(function(text) {
		return JSON.parse(text);
	});
};

proto.getMD5 = function() {
	if (!this.md5Promise) {
		this.md5Promise = this.getBuffer().then(md5hex);
	}
	return this.md5Promise;
};

proto.invalidate = function() {
	delete this.bufferPromise;
	delete this.md5Promise;
};

module.exports = File;
