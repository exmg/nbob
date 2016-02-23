'use strict';

var bower = require('bower');
var listFiles = require('../list-files');
var minimatches = require('../minimatches');
var files = require('../files');
var Promise = require('../promise');

function getLevel(bowerLevel) {
	return {
		'error': 'error',
		'conflict': 'error',
		'warn': 'warn',
		'action': 'info',
		'info': 'debug',
		'debug': 'spam'
	}[bowerLevel];
}

module.exports = function(config, log) {
	if (!files.get(config.file)) {
		return [];
	}

	return new Promise(function(resolve, reject) {
		bower.commands.install(null, null, null).
			on('log', function(event) {
				log[getLevel(event.level)]('%s: %s', event.id, event.message);
			}).
			on('error', function(error) {
				reject(new Error(error.code + ': ' + error.message));
			}).
			on('end', function() {
				var outputPaths = minimatches(listFiles('.'), config.copy);
				outputPaths.forEach(function(outputPath) {
					// Note: Directly add to files to circumvent wendy processLegacy's "added" log for each file
					files.add(outputPath);
				});
				log.info('Added %d bower component files', outputPaths.length);
				resolve([]);
			});
	});
};
