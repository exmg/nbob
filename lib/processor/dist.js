'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var _ = require('lodash');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var listFiles = require('../list-files');
var Batch = require('../batch');
var promisify = require('../promisify');
var mkdirp = promisify(require('mkdirp'));
var readFile = promisify(fs.readFile);
var writeFile = promisify(fs.writeFile);

var processor = new Processor();

function removeEmptyDirs(dir) {
	try {
		var filePaths = fs.readdirSync(dir).filter(function(filePath) {
			filePath = path.join(dir, filePath);
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

function getMD5(buffer) {
	var sum = crypto.createHash('md5');
	sum.update(buffer);
	return sum.digest('hex');
}

processor.getBatches = function(inputPaths) {
	var config = this.config;
	var log = this.log;
	var distDir = config.dir;

	// Remove files that are no longer in inputPaths
	var oldPaths = listFiles(distDir);
	inputPaths = minimatches(inputPaths, config.files);
	var newPaths = inputPaths.map(function(inputPath) {
		return path.join(distDir, inputPath);
	});
	_.difference(oldPaths, newPaths).forEach(function(removedPath) {
		log.spam('Removed: %s', removedPath);
		fs.unlinkSync(removedPath);
	});

	// Remove empty directories left behind after removing files
	removeEmptyDirs(distDir);

	return inputPaths.map(function(inputPath) {
		return new Batch([ { path: inputPath, type: 'buffer', isReadOnly: true } ]);
	});
};

processor.process = function(inputs) {
	var log = this.log;
	var input = inputs[0];
	var buffer = input.data;
	var inputPath = input.path;
	var outputPath = path.join(this.config.dir, inputPath);

	return readFile(outputPath).then(getMD5, function() {
		return undefined; // MD5 of non-existing file should not be a failure (just empty)
	}).then(function(oldMD5) {
		if (getMD5(buffer) === oldMD5) {
			log.spam('Unchanged: %s', outputPath);
		} else {
			return mkdirp(path.dirname(outputPath)).then(function() {
				return writeFile(outputPath, buffer).then(function() {
					log.ok('%s: %s', oldMD5 ? 'Changed' : 'Added', outputPath);
				});
			});
		}
	});
};

module.exports = processor;
