/*jshint node:true, strict:false*/

var _ = require('lodash');
var Promise = require('../promise');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var File = require('../file');
var Batch = require('../batch');

var processor = new Processor();

// Note: In the past we supported multiple locales at the same time, but this was never really used
// If we ever need it again, we can reproduce that functionality at that time,
// p.e: index-l10n.html produces: index.html (default locale), index-en-us.html and index-nl-nl.html
processor.getBatches = function(inputPaths) {
	inputPaths = minimatches(inputPaths, this.config.files);

	var localePath = 'l10n/' + this.config.locale + '.json';

	// Prepare a fresh promise of locale object for this batch
	this.localePromise = new File(localePath).getJSON();

	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/-l10n/, '');
		return new Batch([ inputPath, localePath ], [ outputPath, localePath ]);
	});
};

processor.process = function(batch, inputFileMap) {
	var file = inputFileMap[batch.inputPaths[0]];

	return Promise.apply([ file.getText(), this.localePromise ], function(text, locale) {
		text = text.split('\n').map(function(line) {
			return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
				id = id.replace(/\\'/g, '\''); // unescape escaped quotes
				var record = locale[id];
				return record ? record.localization : id;
			});
		}).join('\n');

		return file.setText(text).then(function() {
			var outputPath = batch.outputPaths[0];
			var outputFileMap = _.extend({}, inputFileMap);
			delete outputFileMap[file.path];
			file.path = outputPath;
			outputFileMap[outputPath] = file;
			return outputFileMap;
		});
	});
};

module.exports = processor;
