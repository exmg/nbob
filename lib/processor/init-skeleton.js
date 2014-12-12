'use strict';

var path = require('path');
var fs2 = require('../fs2');
var listFiles = require('../list-files');
var Promise = require('../promise');
var promisify = require('../promisify');
var mkdirp = promisify(require('mkdirp'));
var resDir = path.join(__dirname, '..', '..', 'res', 'init-skeleton');

module.exports = function(config, log, inputFiles) {
	return Promise.all(listFiles(resDir).map(function(resPath) {
		var projectPath = path.relative(resDir, resPath).replace(/__PROJECT__/g, config.project.name);
		return fs2.readFile(projectPath).then(function() {
			log.debug('%s already exists', projectPath);
		}, function() {
			return fs2.readFile(resPath).then(function(buffer) {
				return mkdirp(path.dirname(projectPath)).then(function() {
					return fs2.writeFile(projectPath, buffer).then(function() {
						log.ok(projectPath);
					});
				});
			});
		});
	})).then(function() {
		return inputFiles;
	});
};
