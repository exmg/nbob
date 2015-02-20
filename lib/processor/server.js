'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var _ = require('lodash');
var chokidar = require('chokidar');
var compression = require('compression');
var connect = require('connect');
var morgan = require('morgan');
var serveIndex = require('serve-index');
var serveStatic = require('serve-static');
var pkg = require('../../package.json');
var commands = require('../commands');
var File = require('../file');
var files = require('../files');
var Handlebars = require('../handlebars');
var listFiles = require('../list-files');
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

function getFileExcerpts(text) {
	var excerpts = [];
	var fileRegex = /\s?[\[\(]?([\w \/\.\-_]+):(\d+):?(\d*)[\]\)]?/g;
	var fileMatches;
	while ((fileMatches = fileRegex.exec(text))) {
		var match = fileMatches[0];
		var filePath = fileMatches[1];
		var line = parseInt(fileMatches[2], 10);
		var column = parseInt(fileMatches[3], 10);
		var file = files.get(filePath);
		if (file && line) {
			// Remove file reference from text
			text = text.replace(match, '');

			// TODO: Make this async
			var fileLines = fs.readFileSync(filePath).toString().split('\n');
			var context =
				(line > 1 ? (line - 1) + ':\t' + fileLines[line - 2] + '\n' : '') +
				(line) + ':\t' + fileLines[line - 1] + '\n' +
				(line + 1) + ':\t' + fileLines[line - 0];

			excerpts.push({
				path: filePath,
				line: line,
				column: column,
				context: context
			});
		}
	}

	return {
		text: text,
		excerpts: excerpts
	};
}

function parseError(error) {
	var messageLines = error.message.split('\n');

	var title = messageLines.shift();

	var commandMatches = title.match(/([\w:]+): (.*)/);
	var commandName = commandMatches[1];
	var command = commandMatches && commands.find(commandName);
	if (command) {
		title = commandMatches[2];
	}

	title = getFileExcerpts(title);

	var details = messageLines.map(getFileExcerpts);

	var stackRegex = /^\s*at\s+/;
	var stack = error.stack.split('\n').filter(function(line) {
		return stackRegex.test(line);
	}).map(function(line) {
		return line.replace(stackRegex, '');
	});

	return {
		commandName: commandName,
		command: command,
		error: {
			name: error.name,
			title: title,
			details: details,
			stack: stack
		}
	};
}

function connectErrorHandler(config, log) {
	return function(err, req, res, next) {
		log.error(err.message);

		// Can not respond
		if (res._header) {
			return req.socket.destroy();
		}

		res.statusCode = 500;

		// Reset files for file references from parseError
		files.init(minimatches(listFiles('.'), config.project.files));

		var data = _.extend({
			pkg: pkg,
			project: config.project
		}, parseError(err));

		var errorHtmlFile = new File(path.join(__dirname, '..', '..', 'res', 'server', 'error.hbs'));
		errorHtmlFile.getText().then(function(hbs) {
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			var template = Handlebars.compile(hbs);
			res.end(template(data));
		}, function(error) {
			next(error);
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
		app.use(connectErrorHandler(config, log));

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
