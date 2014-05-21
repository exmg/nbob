'use strict';

var fs = require('fs');
var jshint = require('jshint').JSHINT;
var Processor = require('../processor');
var minimatches = require('../minimatches');
var Batch = require('../batch');

var processor = new Processor();

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
	Processor.prototype.init.apply(this, arguments);

	// TODO: Create options and ignores promises in getBatches() and use those in process() (like in l10n)
	// Now we are sync reading and blocking following processor inits which is not nice
	// Also, that way we are more likely to pick up changes to these files at a mild overhead cost

	// Get options from .jshintrc
	this.options = getOptions(config, log);

	// Get ignores from .jshintignore, turn them into patterns and add those to our config.files patterns
	var patterns = getIgnores(config, log).map(function(ignore) {
		return '!' + ignore;
	});
	[].push.apply(this.config.files, patterns);
};

processor.getBatches = function(inputPaths) {
	inputPaths = minimatches(inputPaths, this.config.files);
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ { fromPath: inputPath } ]);
	});
};

processor.process = function(inputs) {
	var input = inputs[0];
	var options = this.options;
	var log = this.log;

	if (jshint(input.data, options)) {
		log.ok('%s', input.path);
	} else {
		var errors = jshint.errors;
		log.warn('%s: %d errors', input.path, errors.length);
		errors.forEach(function(error) {
			if (!error) {
				return;
			}
			log.warn('#' + error.code + ': ' + error.reason +
				' [' + input.path + ':' + error.line + ':' + error.character + ']'
			);
		});
	}
};

module.exports = processor;
