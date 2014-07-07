'use strict';

var connect = require('connect');
var http = require('http');
var path = require('path');
var commands = require('../commands');
var minimatches = require('../minimatches');
var wendy = require('../wendy');
var chokidar = require('chokidar');

var makeCommands = [ commands.find('make') ];

module.exports = function(config, log, inputFiles) {
	var patterns = config.project.files;
	var distDir = config.project.distDir;
	var port = config.port;
	var projectDir = process.cwd();
	var makePromise = wendy(makeCommands);

	return makePromise.then(function() {
		var dirty = false;

		var watcher = chokidar.watch(projectDir, {
			ignored: function(filePath) {
				filePath = path.relative(projectDir, filePath);
				var ignore = filePath === '' ? false : minimatches([ filePath ], patterns).length === 0;
				if (ignore) {
					log.debug('Ignoring: %s', filePath);
				}
				return ignore;
			},
			persistent: true,
			ignoreInitial: true
		});

		watcher.on('all', function(action, filePath) {
			filePath = path.relative(projectDir, filePath);
			if (minimatches([ filePath ], patterns).length === 0) {
				log.debug('Ignoring: %s', filePath);
				return;
			}
			log.info('%s (%s)', filePath, action);
			dirty = true;
		});

		connect.errorHandler.title = 'nBob';
		var app = connect()
			.use(connect.favicon())
			.use(connect.logger('dev'))
			.use(function(req, res, next) {
				if (dirty) {
					makePromise = wendy(makeCommands);
					dirty = false;
				}
				makePromise.then(function() {
					next();
				}, function(error) {
					next(error);
				});
			})
			.use(connect.static(distDir))
			.use(connect.directory(distDir, { icons: true }))
			.use(connect.errorHandler());

		http.createServer(app).listen(port);
		log.info('Listening on port: %d (press control-c to break)', port);

		// We did not modify input files ourselves
		return inputFiles;
	});
};
