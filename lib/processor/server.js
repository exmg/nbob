'use strict';

var connect = require('connect');
var fs = require('fs');
var http = require('http');
var path = require('path');
var commands = require('../commands');
var minimatches = require('../minimatches');
var wendy = require('../wendy');
var chokidar = require('chokidar');

var makeCommands = [ commands.find('make') ];

module.exports = function(config, log, inputFiles) {
	var projectConfig = config.project;
	var patterns = projectConfig.files;
	var projectDir = projectConfig.dir;
	var distDir = projectConfig.distDir;
	var port = config.port;
	var makePromise = wendy(makeCommands);
	var dirty = false;

	function start() {
		chokidar.watch(projectDir, {
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
		}).on('all', function(action, filePath) {
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
					// TODO: Replace by error handler with better multi-line message support
					// This just works around the issue by moving lines into stack trace
					var lines = error.message.split(/\n/);
					if (lines.length > 1) {
						error.message = lines[0];
						error.stack = lines.join('\n') + '\n--\n' + error.stack;
					}

					next(error);
				});
			})
			.use(function connectSourceMap(req, res, next) {
				if (/.min.\w+$/.test(req.url)) {
					var mapUrl = req.url + '.map';
					fs.exists(path.join(distDir, mapUrl), function(exists) {
						if (exists) {
							res.setHeader('X-SourceMap', mapUrl);
						}
						next();
					});
				} else {
					next();
				}
			})
			.use(connect.static(distDir))
			.use(connect.directory(distDir, { icons: true }))
			.use(connect.errorHandler());

		http.createServer(app).listen(port);
		log.info('Listening on port: %d (press control-c to break)', port);
	}

	makePromise.then(start, start);

	// We do not modify input files ourselves
	return inputFiles;
};
