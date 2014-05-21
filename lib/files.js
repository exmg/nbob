'use strict';

var _ = require('lodash');
var listFiles = require('./list-files');
var minimatches = require('./minimatches');
var config = require('./config');
var File = require('./file');
var list = [];

function init() {
	list.length = 0;
	minimatches(listFiles('.'), config.project.files).sort().forEach(function(file) {
		list.push(new File(file));
	});
}

function get(path) {
	return _.find(list, { path: path });
}

function sortedList() {
	return _.sortBy(list, 'path');
}

function getList(paths) {
	if (!paths) {
		return sortedList();
	}
	return paths.map(get);
}

function getPaths(files) {
	files = files || sortedList();
	return _.pluck(files, 'path');
}

function add(file) {
	file = typeof file === 'string' ? get(file) : file;
	list.push(file);
}

function remove(file) {
	file = typeof file === 'string' ? get(file) : file;
	var i = list.indexOf(file);
	if (i >= 0) {
		list.splice(i, 1);
	}
}

module.exports = {
	init: init,
	get: get,
	getList: getList,
	getPaths: getPaths,
	add: add,
	remove: remove
};
