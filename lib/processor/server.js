'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var chokidar = require('chokidar');
var connect = require('connect');
var commands = require('../commands');
var minimatches = require('../minimatches');
var wendy = require('../wendy');

function make() {
	return wendy([ commands.find('make') ]);
}

module.exports = function(config, log, inputFiles) {
	var projectDir = process.cwd();
	var projectConfig = config.project;
	var patterns = projectConfig.files;
	var distDir = projectConfig.distDir;
	var port = config.port;
	var makePromise = make();
	var dirty = false;

	function start() {
		chokidar.watch(projectDir, {
			ignored: function(filePath) {
				filePath = path.relative(projectDir, filePath);
				// Ignoring here, early on, reduces the total number of watched files and any FS issues around that
				// Strictly speaking we should not ignore directories though (just files), for risk of false negatives
				// For now we still do, but we do not ignore the basic path: ''
				if (filePath !== '' && minimatches([ filePath ], patterns).length ===  0) {
					log.debug('Ignoring: %s', filePath);
					return true;
				}
				return false;
			},
			persistent: true,
			ignoreInitial: true
		}).on('all', function(action, filePath) {
			filePath = path.relative(projectDir, filePath);
			log.info('%s (%s)', filePath, action);
			dirty = true;
		});

		commands.addListener(function() {
			log.info('Config and/or commands changed');
			dirty = true;
		});

		connect.errorHandler.title = 'nBob';
		var app = connect()
			.use(connect.favicon())
			.use(connect.logger('dev'))
			.use(function(req, res, next) {
				if (dirty) {
					makePromise = make();
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
			.use(connect.compress()) // TODO: Use exact same compression as deploy-s3?
			.use(connect.static(distDir))
			.use(connect.directory(distDir, { icons: true }))
			.use(connect.errorHandler());

		http.createServer(app).listen(port);

		log.info('Listening on port: %d (press any key to exit)', port);

		var stdin = process.stdin;
		stdin.setRawMode(true);
		stdin.on('data', function() {
			log.info('Key pressed, exiting');
			process.exit();
		});
	}

	makePromise.then(start, start);

	// We do not modify input files ourselves
	return inputFiles;
};
