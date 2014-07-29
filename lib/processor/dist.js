'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var fs2 = require('../fs2');
var md5hex = require('../md5hex');
var Processor = require('../processor');
var listFiles = require('../list-files');
var Batch = require('../batch');
var promisify = require('../promisify');
var mkdirp = promisify(require('mkdirp'));

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
	var buffer = input.data;
	var inputPath = input.path;
	var outputPath = unixPathJoin(this.config.project.distDir, inputPath);

	return fs2.readFile(outputPath).then(md5hex, function() {
		return undefined; // MD5 of non-existing file should not be a failure (just empty)
	}).then(function(oldMD5) {
		if (input.md5 === oldMD5) {
			log.spam('%s (unchanged)', outputPath);
		} else {
			return mkdirp(path.dirname(outputPath)).then(function() {
				return fs2.writeFile(outputPath, buffer).then(function() {
					log.ok('%s (%s)', outputPath, oldMD5 ? 'changed' : 'added');
				});
			});
		}
	});
};

module.exports = processor;
