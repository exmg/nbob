/*jshint node:true, strict:false*/

var fs = require('fs');
var jshint = require('jshint').JSHINT;
var FileProcessor = require('../file-processor');

var processor = new FileProcessor();

function getOptions(config, log) {
	var options = {};
	var path = config.rcFile;
	if (fs.existsSync(path)) {
		try {
			options = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }));
		} catch (e) {
			log.warn('Error while reading: %s', path, e);
		}
	} else {
		log.debug(path + ' does not exist');
	}
	return options;
}

function getIgnores(config, log) {
	var ignores = [];
	var path = config.ignoreFile;
	if (fs.existsSync(path)) {
		try {
			ignores = fs.readFileSync(path, { encoding: 'utf8' }).split('\n').map(function(line) {
				return line.trim();
			}).filter(function(line) {
				return !!line;
			});
		} catch (e) {
			log.warn('Error while reading: %s', path, e);
		}
	} else {
		log.debug(path + ' does not exist');
	}
	return ignores;
}

processor.init = function(config, log) {
	FileProcessor.prototype.init.apply(this, arguments);

	// Get options from .jshintrc
	this.options = getOptions(config, log);

	// Get ignores from .jshintignore, turn them into patterns and add those to our config.files patterns
	var patterns = getIgnores(config, log).map(function(ignore) {
		return '!' + ignore;
	});
	[].push.apply(this.config.files, patterns);
};

processor.processFile = function(file) {
	var options = this.options;
	var log = this.log;

	// TODO: Immediately pass through input to output (we process read-only)

	return file.read('utf8').then(function(text) {
		if (jshint(text, options)) {
			log.ok('%s', file.path);
		} else {
			var errors = jshint.errors;
			log.warn('%s: %d errors', file.path, errors.length);
			errors.forEach(function(error) {
				if (!error) {
					return;
				}
				log.warn('#' + error.code + ': ' + error.reason +
					' [' + file.path + ':' + error.line + ':' + error.character + ']'
				);
			});
		}
	});
};

module.exports = processor;
