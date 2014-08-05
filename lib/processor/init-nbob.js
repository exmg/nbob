'use strict';

var fs2 = require('../fs2');
var question = require('../question');
var configFn = 'nbob-config.json';

module.exports = function(config, log, inputFiles) {
	return fs2.readFile(configFn).then(function() {
		log.debug('%s already exists', configFn);
	}, function() {
		return question('Project name', 'nbob-project').then(function(name) {
			return question('Project version', '0.0.1').then(function(version) {
				var projectConfig = {
					name: name,
					version: version
				};

				// TODO: Also ask about nbob.multiCore and project files, buildDir and distDir
				// TODO: Get questions from all Processors and include those answers in config
				// TODO: Add envConfigMap support

				return fs2.writeFile(configFn, JSON.stringify({
					project: projectConfig
				}, null, '\t') + '\n').then(function() {
					// TODO: Have changes take effect immediately, e.g: have config module reload

					log.ok(configFn);
				});
			});
		});
	}).then(function() {
		return inputFiles;
	});
};
