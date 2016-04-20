'use strict';

var minimatch = require('minimatch');

function myMatch(path, pattern, options) {
	// Support regex besides glob patterns, they are marked by beginning and ending with a /
	if (/^\/.*\/$/.test(pattern)) {
		var regex = new RegExp(pattern.substr(1, pattern.length - 2));
		return regex.test(path);
	}

	return minimatch(path, pattern, options);
}

module.exports = function(paths, patterns, options) {
	var returnBool = typeof paths === 'string';
	if (returnBool) {
		paths = [ paths ];
	}

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
			if (myMatch(path, excludes[i], options)) {
				return false;
			}
		}
		return true;
	});

	// Return matches in order of inclusion patterns
	var matches = includes.reduce(function(matches, include) {
		paths.forEach(function(path) {
			if (matches.indexOf(path) === -1 && myMatch(path, include, options)) {
				matches.push(path);
			}
		});
		return matches;
	}, []);

	return returnBool ? matches.length > 0 : matches;
};
