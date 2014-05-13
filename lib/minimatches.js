/*jshint node:true, strict:false*/

var minimatch = require('minimatch');

module.exports = function(paths, patterns, options) {
	return paths.filter(function(path) {
		var matches = false;
		var i, pattern, len = patterns.length;
		for (i = 0; i < len; i++) {
			pattern = patterns[i];
			if (pattern.indexOf('!') === 0) {
				if (minimatch(path, pattern.substr(1), options)) {
					return false;
				}
			} else {
				matches = matches || minimatch(path, pattern, options);
			}
		}
		return matches;
	});
};
