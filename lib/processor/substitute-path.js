'use strict';

module.exports = function(config, log, files) {
	var substitutes = config.substitutes;
	files.forEach(function(file) {
		var newPath = file.path.replace(/__(.+?)__/g, function(match, key) {
			return substitutes[key] === undefined ? match : substitutes[key];
		});
		if (newPath !== file.path) {
			log.debug('Renaming %s to %s', file.path, newPath);
			file.path = newPath;
		}
	});
	return files;
};
