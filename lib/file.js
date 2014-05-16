/*jshint node:true, strict:false*/

var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var Promise = require('./promise');
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
	this.invalidate();
	this.bufferPromise = Promise.resolve(buffer);
	return this.bufferPromise;
};

proto.getText = function(encoding) {
	return this.getBuffer().then(function(buffer) {
		return buffer.toString(encoding);
	});
};

proto.setText = function(text, encoding) {
	return this.setBuffer(Promise.resolve(text).then(function(text) {
		return new Buffer(text, encoding);
	}));
};

proto.getJSON = function() {
	return this.getText().then(function(text) {
		return JSON.parse(text);
	});
};

proto.setJSON = function(obj) {
	return this.setText(Promise.resolve(obj).then(function(obj) {
		return JSON.stringify(obj, null, '\t');
	}));
};

proto.getMD5 = function() {
	if (!this.md5Promise) {
		this.md5Promise = this.getBuffer().then(getMD5);
	}
	return this.md5Promise;
};

proto.invalidate = function() {
	delete this.bufferPromise;
	delete this.md5Promise;
};

proto.write = function(dir) {
	var fullPath = dir ? path.join(dir, this.path) : this.path;

	var oldMD5Promise = readFile(fullPath).then(getMD5, function() {
		return undefined; // MD5 of non-existing file should not be a failure (just empty)
	});

	return Promise.apply([ oldMD5Promise, this.getMD5() ], function(oldMD5, newMD5) {
		if (newMD5 === oldMD5) {
			return 'unchanged';
		}
		return Promise.apply([ this.getBuffer(), mkdirp(path.dirname(fullPath)) ], function(buffer) {
			return writeFile(fullPath, buffer).then(function() {
				return oldMD5 ? 'changed' : 'added';
			});
		});
	}.bind(this));
};

module.exports = File;
