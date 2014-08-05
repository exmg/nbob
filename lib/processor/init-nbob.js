'use strict';

var _ = require('lodash');
var fs2 = require('../fs2');
var question = require('../question');

module.exports = function(config, log, inputFiles) {
	// Note: this overrides any nbob-config.json file already present
	return question('Project name', 'nbob-project').then(function(name) {
		return question('Project version', '0.0.1').then(function(version) {
			var projectConfig = {
				name: name,
				version: version
			};

			// TODO: Also ask about nbob.multiCore and project files, buildDir and distDir
			// TODO: Get questions from all Processors and include those answers in config
			// TODO: Add envConfigMap support

			fs2.writeFile('nbob-config.json', JSON.stringify({
				project: projectConfig
			}, null, '\t') + '\n').then(function() {
				// Have changes take effect immediately
				_.extend(config.project, projectConfig);

				// We did not modify input files (nbob-config is excluded)
				return inputFiles;
			});
		});
	});
};
