'use strict';

var http = require('http');
var connect = require('connect');
var commands = require('../commands');
var promisify = require('../promisify');
var gaze = promisify(require('gaze'));
var wendy = require('../wendy');

var makeCommands = [ commands.find('make') ];

module.exports = function(config, log, inputFiles) {
	var watchPatterns = config.project.files;
	var distDir = config.project.distDir;
	var port = config.port;

	return gaze(watchPatterns).then(function(watcher) {
		var makePromise = wendy(makeCommands);
		var dirty = false;

		watcher.on('all', function(event, filePath) {
			log.ok('%s was %s', filePath, event);
			dirty = true;
		});

		connect.errorHandler.title = 'nBob';
		var app = connect()
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
		log.info('Listening on port: %d', port);

		// We did not modify input files ourselves
		return inputFiles;
	});
};
