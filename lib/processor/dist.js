'use strict';

var fs = require('fs');
var _ = require('lodash');
var cache = require('../cache');
var Processor = require('../processor');
var listFiles = require('../list-files');
var Batch = require('../batch');

var processor = new Processor();

function unixPathJoin() {
	return _.toArray(arguments).join('/');
}

function removeEmptyDirs(dir) {
	try {
		var filePaths = fs.readdirSync(dir).filter(function(filePath) {
			filePath = unixPathJoin(dir, filePath);
			var stat = fs.lstatSync(filePath);
			return !(stat && stat.isDirectory() && removeEmptyDirs(filePath));
		});

		if (filePaths.length === 0) {
			fs.rmdirSync(dir);
			return true;
		}
	} catch (error) {}

	return false;
}

processor.getBatches = function(inputPaths) {
	var log = this.log;
	var distDir = this.config.project.distDir;

	// Remove files that are no longer in inputPaths
	var oldPaths = listFiles(distDir);
	var newPaths = inputPaths.map(function(inputPath) {
		return unixPathJoin(distDir, inputPath);
	});
	_.difference(oldPaths, newPaths).forEach(function(removedPath) {
		log.ok('%s (removed)', removedPath);
		fs.unlinkSync(removedPath);
		cache.removePath(removedPath);
	});

	// Remove empty directories left behind after removing files
	removeEmptyDirs(distDir);

	return inputPaths.map(function(inputPath) {
		return new Batch([ { path: inputPath, type: 'buffer', isReadOnly: true } ], [], { doNotCache: true });
	});
};

processor.process = function(inputs) {
	var log = this.log;
	var input = inputs[0];
	var outputPath = unixPathJoin(this.config.project.distDir, input.path);

	return cache.set(outputPath, input.data, input.md5).then(function(message) {
		if (message === 'unchanged') {
			log.spam('%s (%s)', outputPath, message);
		} else {
			log.ok('%s (%s)', outputPath, message);
		}
	});
};

module.exports = processor;
