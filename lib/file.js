'use strict';

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
	if (!this.textPromise) {
		this.textPromise = this.getBuffer().then(function(buffer) {
			return buffer.toString();
		});
	}
	return this.textPromise;
};

proto.setText = function(text) {
	return this.setBuffer(Promise.resolve(text).then(function(text) {
		return new Buffer(text);
	}));
};

proto.getJSON = function() {
	if (!this.jsonPromise) {
		this.jsonPromise = this.getText().then(function(text) {
			return JSON.parse(text);
		});
	}
	return this.jsonPromise;
};

proto.setJSON = function(obj) {
	return this.setText(Promise.resolve(obj).then(function(obj) {
		return JSON.stringify(obj, null, '\t');
	}));
};

proto.get = function(type) {
	switch (type) {
		case 'buffer': return this.getBuffer();
		case 'text': return this.getText();
		case 'json': return this.getJSON();
		default: throw new Error('Invalid type: ' + type);
	}
};

proto.set = function(type, data) {
	switch (type) {
		case 'buffer': return this.setBuffer(data);
		case 'text': return this.setText(data);
		case 'json': return this.setJSON(data);
		default: throw new Error('Invalid type: ' + type);
	}
};

proto.invalidate = function() {
	delete this.bufferPromise;
	delete this.textPromise;
	delete this.jsonPromise;
};

module.exports = File;
