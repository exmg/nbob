'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var chokidar = require('chokidar');
var compression = require('compression');
var connect = require('connect');
var errorhandler = require('errorhandler');
var morgan = require('morgan');
var serveIndex = require('serve-index');
var serveStatic = require('serve-static');
var commands = require('../commands');
var minimatches = require('../minimatches');
var wendy = require('../wendy');

function make() {
	return wendy([ commands.find('make') ]);
}

function connectMake(context) {
	return function(req, res, next) {
		if (context.dirty) {
			context.makePromise = make();
			context.dirty = false;
		}
		context.makePromise.then(function() {
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
	};
}

function connectSourceMap(distDir) {
	return function(req, res, next) {
		var mapUrl = req.url + '.map';
		fs.exists(path.join(distDir, mapUrl), function(exists) {
			if (exists) {
				res.setHeader('X-SourceMap', mapUrl);
			}
			next();
		});
	};
}

module.exports = function(config, log, inputFiles) {
	var projectDir = process.cwd();
	var projectConfig = config.project;
	var patterns = projectConfig.files;
	var distDir = projectConfig.distDir;
	var port = config.port;
	var context = {
		makePromise: make(),
		dirty: false
	};

	function start() {
		chokidar.watch(projectDir, {
			ignored: function(filePath) {
				filePath = path.relative(projectDir, filePath);
				// Ignoring here, early on, reduces the total number of watched files and any FS issues around that
				// Strictly speaking we should not ignore directories though (just files), for risk of false negatives
				// For now we still do, but we do not ignore the basic path: ''
				if (filePath !== '' && !minimatches(filePath, patterns)) {
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
			context.dirty = true;
		});

		commands.addListener(function() {
			log.info('Config and/or commands changed');
			context.dirty = true;
		});

		var app = connect();

		app.use(morgan('dev')); // logger
		app.use(connectMake(context));
		app.use(connectSourceMap(distDir));
		app.use(compression());
		app.use(serveStatic(distDir));
		app.use(serveIndex(distDir, { icons: true }));
		app.use(errorhandler()); // TODO: change title and improve template

		http.createServer(app).listen(port);

		log.info('Listening on port: %d (press any key to exit)', port);

		var stdin = process.stdin;
		stdin.setRawMode(true);
		stdin.on('data', function() {
			log.info('Key pressed, exiting');
			process.exit();
		});
	}

	context.makePromise.then(start, start);

	// We do not modify input files ourselves
	return inputFiles;
};
