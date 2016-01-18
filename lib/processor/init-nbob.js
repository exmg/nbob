'use strict';

var _ = require('lodash');
var config = require('../config').object;
var fs2 = require('../fs2');
var configFn = 'nbob-config.json';

module.exports = function(initConfig, log, inputFiles) {
	return fs2.readFile(configFn).then(function() {
		log.debug('%s already exists', configFn);
	}, function() {
		var defaultName = process.cwd().replace(/.*[\/\\]/, '');
		return log.question('Project name', defaultName).then(function(name) {
			return log.question('Project version', '0.0.1').then(function(version) {
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
					// Have changes take effect immediately
					_.extend(config.project, projectConfig);

					log.ok(configFn);
				});
			});
		});
	}).then(function() {
		return inputFiles;
	});
};
