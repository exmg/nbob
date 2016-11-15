'use strict';

var _ = require('lodash');
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

	function command() {
		var args = _.toArray(arguments);
		var cmd = args.shift();
		var commands = bower.commands;
		return new Promise(function(resolve, reject) {
			commands[cmd].apply(commands, args).
				on('log', function(event) {
					log[getLevel(event.level)]('%s: %s', event.id, event.message);
				}).
				on('error', function(error) {
					reject(new Error(error.code + ': ' + error.message));
				}).
				on('end', function(data) {
					resolve(data);
				});
		});
	}

	// Start by pruning any bower components that are no longer used
	return command('prune').then(function() {
		return command('install').then(function() {
			// TODO: Default to 'main' files defined in component bower.json files
			// and then add config.copy include and exclude patterns to those
			// AND/OR: Any bower_components files referred to by make:components.imports
			// OR: Simply copy nothing by default
			//   AND? have components FSResolver load bower_components files on demand (what about caching?)
			var outputPaths = minimatches(listFiles(config.dir), config.copy);
			outputPaths.forEach(function(outputPath) {
				// Note: Directly add to files to circumvent wendy processLegacy's "added" log for each file
				files.add(outputPath);
			});
			log.info('Added %d bower component files', outputPaths.length);
		});
	});
};
