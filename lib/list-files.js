'use strict';

var fs = require('fs');
var path = require('path');

function listFiles(dir) {
	var paths = [];
	try {
		fs.readdirSync(dir).forEach(function(filePath) {
			filePath = path.join(dir, filePath);
			var stat = fs.lstatSync(filePath);
			if (stat && stat.isDirectory()) {
				paths = paths.concat(listFiles(filePath));
			} else {
				paths.push(filePath);
			}
		});
	} catch (error) {}
	return paths.map(function(path) {
		// It is easier to work with Unix paths everywhere except where necessary
		return path.replace(/\\/g, '/');
	});
}

module.exports = listFiles;
