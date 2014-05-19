'use strict';

var Promise = require('../promise');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var File = require('../file');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var config = this.config;

	// Input paths are sorted alphabetically and can be influenced as such (p.e: lib/1/z.js, lib/2/a.js)
	inputPaths = minimatches(inputPaths, config.files).sort();

	return [ new Batch(inputPaths, [ config.output ]) ];
};

processor.process = function(inputFiles, outputPaths) {
	var outputFile = new File(outputPaths[0]);
	var textPromise = Promise.all(inputFiles.map(function(file) {
		return file.getText();
	})).then(function(texts) {
		return texts.join('\n');
	});
	return outputFile.setText(textPromise).then(function() {
		return [ outputFile ];
	});
};

module.exports = processor;
