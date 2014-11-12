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

function getBuildDir(distDir, distPaths) {
	var paths = distPaths.map(function(distPath) {
		return distPath.substr(distDir.length + 1);
	});
	var buildPath = _.find(paths, function(path) {
		return path.indexOf('build-') === 0;
	});
	return buildPath ? distDir + '/' + buildPath.substr(0, buildPath.indexOf('/')) : null;
}

processor.getBatches = function(inputPaths) {
	var log = this.log;
	var distDir = this.config.project.distDir;

	var oldPaths = listFiles(distDir);
	var newPaths = inputPaths.map(function(inputPath) {
		return unixPathJoin(distDir, inputPath);
	});

	// Rename any old build-xxx to new build-yyy dir to reduce number of differences
	var oldBuildDir = getBuildDir(distDir, oldPaths);
	var newBuildDir = getBuildDir(distDir, newPaths);
	if (oldBuildDir && newBuildDir && (oldBuildDir !== newBuildDir)) {
		log.ok('%s => %s', oldBuildDir, newBuildDir);
		fs.renameSync(oldBuildDir, newBuildDir);
		oldPaths = oldPaths.map(function(oldPath) {
			return oldPath.replace(oldBuildDir, newBuildDir);
		});
	}

	// Remove files that are no longer in inputPaths
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
