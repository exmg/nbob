'use strict';

var fs = require('fs');
var path = require('path');
var minimatches = require('./minimatches');

function listFiles(dir, patterns, excludes) {
	if (patterns && !excludes) {
		excludes = [];
		patterns.forEach(function(pattern) {
			if (pattern[0] === '!') {
				// Double negative means ignore earlier exclude
				if (pattern[1] === '!') {
					excludes.splice(excludes.indexOf(pattern.substr(2)), 1);
				} else {
					excludes.push(pattern.substr(1));
				}
			}
		});

		// Add extra excludes to exclude directories early on (e.g: build/**/* => build)
		excludes.filter(function(pattern) {
			return /\/\*\*\/\*$/.test(pattern);
		}).forEach(function(pattern) {
			excludes.push(pattern.replace(/\/\*\*\/\*$/, ''));
		});
	}

	var paths = [];

	try {
		fs.readdirSync(dir).forEach(function(filePath) {
			filePath = path.join(dir, filePath);

			// It is easier to work with Unix paths everywhere except where necessary
			var stdPath = filePath.replace(/\\/g, '/');

			// Prevent unnecessary recursion by excluding early-on
			if (excludes && minimatches(stdPath, excludes)) {
				return;
			}

			var stat = fs.lstatSync(filePath);
			if (stat && stat.isDirectory()) {
				paths = paths.concat(listFiles(filePath, patterns, excludes));
			} else if (!patterns || minimatches(stdPath, patterns)) {
				paths.push(stdPath);
			}
		});
	} catch (error) {}

	return paths;
}

module.exports = listFiles;
