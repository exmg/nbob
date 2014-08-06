'use strict';

var path = require('path');
var fs2 = require('../fs2');
var Promise = require('../promise');
var resDir = path.join(__dirname, '..', '..', 'res', 'init-copy');

module.exports = function(config, log, inputFiles) {
	return Promise.all(config.relPaths.map(function(relPath) {
		return fs2.readFile(relPath).then(function() {
			log.debug('%s already exists', relPath);
		}, function() {
			var resPath = path.join(resDir, relPath);
			return fs2.readFile(resPath).then(function(buffer) {
				return fs2.writeFile(relPath, buffer).then(function() {
					log.ok(relPath);
				});
			});
		});
	})).then(function() {
		return inputFiles;
	});
};
