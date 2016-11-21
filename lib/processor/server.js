'use strict';

var url = require('url');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var bs = require('browser-sync').create('server');
var commands = require('../commands');
var nbobConfig = require('../config');
var fs2 = require('../fs2');
var File = require('../file');
var files = require('../files');
var Handlebars = require('../handlebars');
var listFiles = require('../list-files');
var minimatches = require('../minimatches');
var pkg = require('../../package.json');
var wendy = require('../wendy');

function make(context, action, filePath) {
	var log = context.log;

	function always(error) {
		// BrowserSync monitors dist dir, but make error is shown independently by our middleware
		if (bs.active && error !== context.makeError) {
			bs.reload();
		}

		context.makePromise = null;
		context.makeError = error;

		if (context.makeQueued) {
			context.makeQueued = false;
			make(context);
		}
	}

	if (action) {
		log.info('%s (%s)', path.relative(process.cwd(), filePath), action);
	}

	if (context.makePromise) {
		// TODO: Abort previous make (so we can continue with next one sooner)
		context.makeQueued = true;
	} else {
		context.makePromise = wendy([ commands.find('make') ]).then(function() {
			always();
		}, function(error) {
			always(error);
			log.error(error.message);
		});
	}

	return context.makePromise;
}

function mwDefault(config) {
	return function(req, res, next) {
		// Skip if this is not a GET HTML request
		var accept = req.headers && req.headers.accept || '';
		if (req.method !== 'GET' || !/text\/html/.test(accept)) {
			return next();
		}

		// If specific file or root index or directory listing would not be shown then change to default URL
		// Note: This can still result in a 404 if default page can also not be found
		var server = config.options.server;
		var reqPath = url.parse(req.url).pathname;
		var isRoot = reqPath === '/';
		reqPath = server.baseDir + reqPath + (isRoot ? server.index : '');
		fs.stat(reqPath, function(err, stats) {
			var isFile = !err && stats.isFile();
			var isDirectory = isRoot || !err && stats.isDirectory();
			if (!(isFile || (isDirectory && server.directory))) {
				req.url = '/' + config.default;
			}
			next();
		});
	};
}

function mwContext(context) {
	return function(req, res, next) {
		next(context.makeError);
	};
}

function mwSourceMap(distDir) {
	return function(req, res, next) {
		// Ignore GET params for sourcemaps
		var mapUrl = req.url.replace(/(\?.*)/, '') + '.map';

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

function mwErrorHandler(config) {
	return function(err, req, res, next) {
		// Can not respond
		if (res._header) {
			return req.socket.destroy();
		}

		res.statusCode = 500;

		// Reset files for file references from parseError
		files.init(listFiles('.', config.project.files));

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
	var context = { log: log };

	bs.emitter.on('init', function() {
		var urls = bs.getOption('urls').toJS();
		log.info('');
		log.info('BrowserSync server started (press ctrl-c, esc or q key to exit)');
		log.info('---------------------------------------------------------------');
		log.info('Local:     %s', urls.local);
		log.info('External:  %s', urls.external);
		if (urls.tunnel) {
			log.info('Tunnel:    %s', urls.tunnel);
		}
		log.info('UI:        %s', urls.ui);
		log.info('');
		log.info('For info on options see: https://browsersync.io/docs/options/');
		log.info('');
	});

	// Monitor changes to nbob config files
	bs.watch(nbobConfig.paths, {
		ignoreInitial: true
	}).on('all', function(action, filePath) {
		nbobConfig.update();
		commands.update();
		// Note: Changes to server config (e.g: BrowserSync options) do not (yet) become effective this way
		make(context, action, filePath);
	});

	// Monitor changes to project files
	bs.watch(projectDir, {
		ignored: function(filePath) {
			filePath = path.relative(projectDir, filePath);

			// Notify fs2 caching
			fs2.updateCache(filePath);

			// Ignoring here, early on, reduces the total number of watched files and any FS issues around that
			// Strictly speaking we should not ignore directories though (just files), for risk of false negatives
			// For now we still do, but we do not ignore the basic path: ''
			if (filePath !== '' && !minimatches(filePath, projectConfig.files)) {
				log.debug('Ignoring: %s', filePath);
				return true;
			}
			return false;
		},
		ignoreInitial: true
	}).on('all', function(action, filePath) {
		make(context, action, filePath);
	});

	var options = config.options;
	options.server.middleware = [
		mwDefault(config),
		mwContext(context),
		mwSourceMap(projectConfig.distDir),
		mwErrorHandler(config)
	];

	// Perform initial make before starting BrowserSync server
	make(context).then(function() {
		bs.init(options);
	});

	var stdin = process.stdin;
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding('utf8');

	stdin.on('data', function(key) {
		if ([ '\u0003', '\u001b', 'q' ].indexOf(key) >= 0) { // ctrl-c, esc or q
			log.info('Exiting..');
			process.exit();
		}

		// Allow marking of certain moments in console by pressing return (ignore everything else)
		if (key === '\u000d') {
			console.log('');
		}
	});

	// We do not modify input files ourselves
	return inputFiles;
};
