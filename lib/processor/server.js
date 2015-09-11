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

function make(log) {
	return wendy([ commands.find('make') ]).catch(function(error) {
		log.error(error.message);
		throw error;
	});
}

function connectMake(context, log) {
	return function(req, res, next) {
		if (context.dirty) {
			context.makePromise = make(log);
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

function getLineContext(contents, line) {
	// Get previous, specified and following lines
	var contextLines = contents.split('\n').slice(Math.max(line - 2, 0), line + 1);

	// Remove common indent white space prefix from lines and replace tabs by spaces to compact excerpts
	var indentSpace = contextLines.reduce(function(indentSpace, line) {
		var lineSpace = line.match(/\s*/)[0];
		return indentSpace === null ? lineSpace :
			lineSpace.length < indentSpace.length ? lineSpace : indentSpace;
	}, null);
	contextLines = contextLines.map(function(lineText) {
		return lineText.replace(indentSpace, '').replace('\t', '    ');
	});

	// Prefix lines with their numbers
	return contextLines.map(function(lineText, i) {
		return (line + i - (line > 1 ? 1 : 0)) + ':\t' + lineText;
	}).join('\n');
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

			// TODO: Use fs2 to perform async file reading etc.
			// TODO: Add support for reverse source mapping line/col
			var contents = fs.readFileSync(filePath).toString();
			var context = getLineContext(contents, line);

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
	var message = error.originalMessage || error.message;
	var messageLines = message.split('\n');

	var title = getFileExcerpts(messageLines.shift());

	var details = messageLines.map(getFileExcerpts);

	var stackRegex = /^\s*at\s+/;
	var stack = error.stack.split('\n').filter(function(line) {
		return stackRegex.test(line);
	}).map(function(line) {
		return line.replace(stackRegex, '');
	});

	return {
		commandName: error.commandName,
		command: error.command,
		processor: error.processor,
		error: {
			name: error.name,
			title: title,
			details: details,
			stack: stack
		}
	};
}

function connectErrorHandler(config) {
	return function(err, req, res, next) {
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
		makePromise: make(log),
		dirty: false
	};

	// Start Connect web server
	var app = connect();
	app.use(morgan('dev')); // logger
	app.use(connectMake(context, log));
	app.use(connectSourceMap(distDir));
	app.use(compression());
	app.use(serveStatic(distDir));
	app.use(serveIndex(distDir, { icons: true }));
	app.use(connectErrorHandler(config));
	http.createServer(app).listen(port);
	log.info('Listening on port: %d (press any key to exit)', port);

	// Changes to project files make build dirty
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

	// Changes to config make build dirty
	commands.addListener(function() {
		log.info('Config and/or commands changed');
		context.dirty = true;
	});

	// Exit process on certain input
	var stdin = process.stdin;
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding('utf8');

	stdin.on('data', function( key ) {

		// Uncomment this line to find out input hex value
		// console.log(key.charCodeAt(0).toString(16));

		if ( key === '\u0003' /* ctrl-c */ || key === '\u001b' /* ESC */ || key === 'q' ) {
			log.info('Job done');

			process.exit();
		}

		// write the key to stdout all normal like
		// Using console.log because `process.stdout.write` does not handle newlines correctly
		console.log(key);
	});

	// We do not modify input files ourselves
	return inputFiles;
};
