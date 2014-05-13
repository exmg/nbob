/*jshint node:true, strict:false*/

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var Promise = require('es6-promise').Promise;
var minimatches = require('./minimatches');
var config = require('./config');
var File = require('./file');
var list = [];

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

function init() {
	list.length = 0;
	minimatches(listFiles('.'), config.project.files).sort().forEach(function(file) {
		list.push(new File(file));
	});
}

function getMap(paths) {
	return list.reduce(function(map, file) {
		if (!paths || paths.indexOf(file.path) !== -1) {
			map[file.path] = file;
		}
		return map;
	}, {});
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

function process(inputMap, outputMap) {
	var inputFiles = _.values(inputMap);
	var outputFiles = _.values(outputMap);
	add(_.difference(outputFiles, inputFiles));
	remove(_.difference(inputFiles, outputFiles));
	// changed files (e.g: path or contents) are already the same file instances, so no need to process those
	sort();
}

function write(dir) {
	return Promise.all(list.map(function(file) {
		return file.write(dir);
	}));
}

module.exports = {
	init: init,
	getMap: getMap,
	getPaths: getPaths,
	process: process,
	write: write
};
