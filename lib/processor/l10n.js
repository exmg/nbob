/*jshint node:true, strict:false*/

var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var Processor = require('../processor');
var minimatches = require('../minimatches');
var File = require('../file');
var Batch = require('../batch');

var processor = new Processor();

// Note: In the past we supported multiple locales at the same time, but this was never really used
// If we ever need it again, we can reproduce that functionality at that time (e.g: replace -l10n by -<locale>)
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
	var log = this.log;
	var file = inputFileMap[batch.inputPaths[0]];

	// TODO: Fix and use following or extend Promise with Promise.apply(promises, fn) or something like that
	// return Promise.all([ file.getText(), this.localePromise ]).then(function(text, locale) {
	return Promise.all([ file.getText(), this.localePromise ]).then(function(values) {
		var text = values[0];
		var locale = values[1];

		text = text.split('\n').map(function(line) {
			return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
				id = id.replace(/\\'/g, '\''); // unescape escaped quotes
				var record = locale[id];
				return record ? record.localization : id;
			});
		}).join('\n');

		return file.setText(text).then(function() {
			var outputPath = batch.outputPaths[0];
			log.ok('%s', outputPath);
			var outputFileMap = _.extend({}, inputFileMap);
			delete outputFileMap[file.path];
			file.path = outputPath;
			outputFileMap[outputPath] = file;
			return outputFileMap;
		});
	});
	// }.apply.bind(null));
};

module.exports = processor;
