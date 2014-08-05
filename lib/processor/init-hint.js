'use strict';

var path = require('path');
var fs2 = require('../fs2');
var Promise = require('../promise');
var resDir = path.join(__dirname, '..', '..', 'res', 'init-hint');
var rcFn = '.jshintrc';
var ignoreFn = '.jshintignore';

module.exports = function(config, log, inputFiles) {
	return Promise.all([ rcFn, ignoreFn ].map(function(fn) {
		return fs2.readFile(fn).then(function() {
			log.debug('%s already exists', fn);
		}, function() {
			var resFn = path.join(resDir, fn);
			return fs2.readFile(resFn).then(function(buffer) {
				return fs2.writeFile(fn, buffer).then(function() {
					log.ok(fn);
				});
			});
		});
	})).then(function() {
		return inputFiles;
	});
};
