'use strict';

var _ = require('lodash');
var File = require('./file');
var list = [];

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
	file = typeof file === 'string' ? new File(file) : file;
	list.push(file);
	return file;
}

function remove(file) {
	file = typeof file === 'string' ? get(file) : file;
	var i = list.indexOf(file);
	if (i >= 0) {
		list.splice(i, 1);
		return file;
	}
	return false;
}

function init(paths) {
	list.length = 0;
	paths.forEach(add);
}

module.exports = {
	init: init,
	get: get,
	getList: getList,
	getPaths: getPaths,
	add: add,
	remove: remove
};
