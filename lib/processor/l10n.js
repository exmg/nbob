'use strict';

var Promise = require('../promise');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var Batch = require('../batch');

var processor = new Processor();

// Note: In the past we supported multiple locales at the same time, but this was never really used
// If we ever need it again, we can reproduce that functionality at that time,
// p.e: index-l10n.html produces: index.html (default locale), index-en-us.html and index-nl-nl.html
processor.getBatches = function(inputPaths) {
	inputPaths = minimatches(inputPaths, this.config.files);
	var localePath = 'l10n/' + this.config.locale + '.json';
	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/-l10n/, '');
		return new Batch([ inputPath, localePath ], [ outputPath, localePath ]);
	});
};

processor.process = function(inputFiles, outputPaths) {
	var file = inputFiles[0];
	var localeFile = inputFiles[1];
	var textPromise = Promise.apply([ file.getText(), localeFile.getJSON() ], function(text, locale) {
		file.path = outputPaths[0];
		return text.split('\n').map(function(line) {
			return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
				id = id.replace(/\\'/g, '\''); // unescape escaped quotes
				var record = locale[id];
				return record ? record.localization : id;
			});
		}).join('\n');
	});
	return file.setText(textPromise).then(function() {
		// File path has changed, but file instances have remained the same
		return inputFiles;
	});
};

module.exports = processor;
