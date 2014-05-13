/*jshint node:true, strict:false*/

var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var Promise = require('es6-promise').Promise;
var promisify = require('./promisify');
var readFile = promisify(fs.readFile);
var writeFile = promisify(fs.writeFile);
var mkdirp = promisify(require('mkdirp'));

function getMD5(buffer) {
	var sum = crypto.createHash('md5');
	sum.update(buffer);
	return sum.digest('hex');
}

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
	this.bufferPromise = Promise.resolve(buffer);
	delete this.md5Promise;
};

proto.getText = function(encoding) {
	return this.getBuffer().then(function(buffer) {
		return buffer.toString(encoding);
	});
};

proto.setText = function(text, encoding) {
	var textPromise = Promise.resolve(text);
	var bufferPromise = textPromise.then(function(text) {
		return new Buffer(text, encoding);
	});
	this.setBuffer(bufferPromise);
};

proto.getMD5 = function() {
	if (!this.md5Promise) {
		this.md5Promise = this.getBuffer().then(getMD5);
	}
	return this.md5Promise;
};

proto.write = function(dir) {
	var fullPath = dir ? path.join(dir, this.path) : this.path;

	var oldMD5Promise = readFile(fullPath).then(getMD5, function() {
		return undefined;
	});

	return Promise.all([ oldMD5Promise, this.getMD5() ]).then(function(values) {
		if (values[0] === values[1]) {
			return; // file has not changed
		}
		return this.getBuffer().then(function(buffer) {
			return mkdirp(path.dirname(fullPath)).then(function() {
				return writeFile(fullPath, buffer);
			});
		});
	}.bind(this));
};

module.exports = File;
