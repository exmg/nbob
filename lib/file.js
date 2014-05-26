'use strict';

var crypto = require('crypto');
var fs = require('fs');
var Promise = require('./promise');
var promisify = require('./promisify');
var readFile = promisify(fs.readFile);

function File(filePath) {
	this.path = filePath;
}

var proto = File.prototype;

proto.getBuffer = function() {
	if (!this.bufferPromise) {
		this.bufferPromise = readFile(this.path);
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
		this.md5Promise = this.getBuffer().then(function(buffer) {
			var sum = crypto.createHash('md5');
			sum.update(buffer);
			return sum.digest('hex');
		});
	}
	return this.md5Promise;
};

proto.invalidate = function() {
	delete this.bufferPromise;
	delete this.md5Promise;
};

module.exports = File;
