'use strict';

var minimatch = require('minimatch');

module.exports = function(paths, patterns, options) {
	// Separate patterns into inclusion and exclusion patterns
	var includes = [];
	var excludes = [];
	patterns.forEach(function(pattern) {
		if (pattern[0] === '!') {
			// Double negative means ignore earlier exclude
			if (pattern[1] === '!') {
				excludes.splice(excludes.indexOf(pattern.substr(2)), 1);
			} else {
				excludes.push(pattern.substr(1));
			}
		} else {
			includes.push(pattern);
		}
	});

	// Filter by exclusion patterns
	var i, len = excludes.length;
	paths = paths.filter(function(path) {
		for (i = 0; i < len; i++) {
			if (minimatch(path, excludes[i], options)) {
				return false;
			}
		}
		return true;
	});

	// Return matches in order of inclusion patterns
	return includes.reduce(function(matches, include) {
		paths.forEach(function(path) {
			if (matches.indexOf(path) === -1 && minimatch(path, include, options)) {
				matches.push(path);
			}
		});
		return matches;
	}, []);
};
