'use strict';

var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

// Note: In the past we supported multiple locales at the same time, but this was never really used
// If we ever need it again, we can reproduce that functionality at that time,
// p.e: index-l10n.html produces: index.html (default locale), index-en-us.html and index-nl-nl.html
processor.getBatches = function(inputPaths) {
	var localePath = 'l10n/' + this.config.locale + '.json';
	return inputPaths.map(function(inputPath) {
		var outputPath = inputPath.replace(/-l10n/, '');
		return new Batch(
			[ inputPath, { path: localePath, type: 'json', isReadOnly: true } ],
			[ outputPath ]
		);
	});
};

processor.process = function(inputs, outputs) {
	var text = inputs[0].data;
	var locale = inputs[1].data;
	var output = outputs[0];
	output.resolve(text.split('\n').map(function(line) {
		return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
			id = id.replace(/\\'/g, '\''); // unescape escaped quotes
			var record = locale[id];
			return record ? record.localization : id;
		});
	}).join('\n'));
	this.log.ok('%s', output.path);
};

module.exports = processor;
