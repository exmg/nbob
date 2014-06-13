'use strict';

var minimatch = require('minimatch');
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var localesPattern = this.config.locales;
	var localePaths = [];
	var otherPaths = [];
	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, localesPattern)) {
			localePaths.push(inputPath);
		} else {
			otherPaths.push(inputPath);
		}
	});

	return localePaths.map(function(localePath) {
		var otherInputs = otherPaths.map(function(otherPath) {
			return { path: otherPath, isReadOnly: true };
		});
		return new Batch(
			[ { path: localePath, type: 'json' } ].concat(otherInputs),
			[ { path: localePath, type: 'json', write: true } ]
		);
	}, []);
};

processor.process = function(inputs, outputs) {
	var oldLocale = inputs[0].data;
	var textInputs = inputs.slice(1);
	var output = outputs[0];
	var locale = {};

	textInputs.forEach(function(textInput) {
		textInput.data.split('\n').map(function(line) {
			var matches = line.match(/_\('.*?[^\\]'\)/g) || [];
			matches.forEach(function(id) {
				id = id.substring(3, id.length - 2); // cut off _(' and ')
				id = id.replace(/\\'/g, '\''); // unescape escaped quotes
				var record = locale[id] || (locale[id] = {
					files: [],
					// TODO: Enable parsing and storing of descriptions, e.g: _('PlayToTV', 'App title')
					localization: oldLocale[id] ? oldLocale[id].localization : id
				});
				if (record.files.indexOf(textInput.path) === -1) {
					record.files.push(textInput.path);
				}
			});
		});
	});

	output.resolve(locale);
};

module.exports = processor;
