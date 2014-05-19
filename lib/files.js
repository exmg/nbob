'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var Promise = require('./promise');
var minimatches = require('./minimatches');
var config = require('./config');
var File = require('./file');
var list = [];

// TODO: Make this async?
function listFiles(dir) {
	var paths = [];
	fs.readdirSync(dir).forEach(function(filePath) {
		filePath = path.join(dir, filePath);
		var stat = fs.lstatSync(filePath);
		if (stat && stat.isDirectory()) {
			paths = paths.concat(listFiles(filePath));
		} else {
			paths.push(filePath);
		}
	});
	return paths;
}

// TODO: Make this async?
function removeEmptyDirs(dir) {
	var filePaths = fs.readdirSync(dir).filter(function(filePath) {
		filePath = path.join(dir, filePath);
		var stat = fs.lstatSync(filePath);
		return !(stat && stat.isDirectory() && removeEmptyDirs(filePath));
	});

	if (filePaths.length === 0) {
		fs.rmdirSync(dir);
		return true;
	}

	return false;
}

function init() {
	list.length = 0;
	minimatches(listFiles('.'), config.project.files).sort().forEach(function(file) {
		list.push(new File(file));
	});
}

function getList(paths) {
	if (!paths) {
		return list;
	}
	return paths.map(function(p) {
		return _.find(list, { path: p });
	});
}

function getPaths(files) {
	files = files || list;
	return _.pluck(files, 'path');
}

function remove(files) {
	list = _.difference(list, files);
}

function add(files) {
	list = list.concat(files);
}

function sort() {
	list = _.sortBy(list, 'path');
}

function process(inputFiles, outputFiles) {
	add(_.difference(outputFiles, inputFiles));
	remove(_.difference(inputFiles, outputFiles));
	// changed files (e.g: path or contents) are already the same file instances, so no need to process those
	sort();
}

function write(dir) {
	var report = {
		unchanged: [],
		added: [],
		changed: [],
		removed: []
	};

	return Promise.all(list.map(function(file) {
		return file.write(dir).then(function(action) {
			report[action].push(file.path);
		});
	})).then(function() {
		var paths = _.pluck(list, 'path');
		listFiles(dir).map(function(path) {
			var relPath = path.substr(dir.length + 1); // strip leading dir name and separator
			if (paths.indexOf(relPath) === -1) {
				fs.unlinkSync(path);
				report.removed.push(relPath);
			}
		});

		removeEmptyDirs(dir);

		return report;
	});
}

module.exports = {
	init: init,
	getList: getList,
	getPaths: getPaths,
	process: process,
	write: write
};
