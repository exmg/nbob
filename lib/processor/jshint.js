/*jshint node:true, strict:false*/

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

	// Get options from .jshintrc
	this.options = getOptions(config, log);

	// Get ignores from .jshintignore, turn them into patterns and add those to our config.files patterns
	var patterns = getIgnores(config, log).map(function(ignore) {
		return '!' + ignore;
	});
	[].push.apply(this.config.files, patterns);
};

processor.getBatches = function(inputPaths) {
	// Read-only single JS file batches
	inputPaths = minimatches(inputPaths, this.config.files);
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ]);
	});
};

processor.process = function(batch, inputFileMap) {
	var file = inputFileMap[batch.inputPaths[0]];
	var options = this.options;
	var log = this.log;

	return file.getText().then(function(text) {
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
