/*jshint node:true, strict:false*/

var _ = require('lodash');
var files = require('../files');

module.exports = function(config, log, inputFiles) {
	return files.write('dist').then(function(report) {
		_.each(report, function(files, action) {
			if (action === 'unchanged') {
				return;
			}
			var desc = '';
			if (files.length > 5) {
				desc = ': ' + files.slice(0, 4).concat('..').join(', ');
			} else if (files.length > 0) {
				desc = ': ' + files.join(', ');
			}
			log.ok('%d files %s%s', files.length, action, desc);
		});

		// We did not modify input files (build and dist directories are excluded)
		return inputFiles;
	});
};
