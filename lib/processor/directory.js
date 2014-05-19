'use strict';

var path = require('path');
var _ = require('lodash');
var Promise = require('../promise');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var File = require('../file');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	inputPaths = minimatches(inputPaths, this.config.files);
	var dirs = _.uniq(inputPaths.map(path.dirname));
	return dirs.map(function(dir) {
		var paths = inputPaths.filter(function(inputPath) {
			return inputPath.indexOf(dir) === 0;
		});
		return new Batch(paths, [ dir + '.json' ]);
	});
};

processor.process = function(inputFiles, outputPaths) {
	var ext = this.config.ext;
	var outputFile = new File(outputPaths[0]);
	var textPromise = Promise.all(inputFiles.map(function(file) {
		return file.getText();
	})).then(function(texts) {
		var map = _.transform(texts, function(map, text, i) {
			map[path.basename(inputFiles[i].path, ext)] = text;
		}, {});
		return JSON.stringify(map, null, '\t');
	});
	return outputFile.setText(textPromise).then(function() {
		return [ outputFile ];
	});
};

module.exports = processor;
