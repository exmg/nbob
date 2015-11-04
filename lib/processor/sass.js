'use strict';

var path = require('path');
var util = require('util');
var sass = require('node-sass');
var Batch = require('../batch');
var Processor = require('../processor');
var Promise = require('../promise');

var processor = new Processor('http://sass-lang.com/');

processor.getBatches = function(inputPaths, inputFiles) {
	var log = this.log;
	var projectDir = process.cwd();
	var importMap = {};
	var imported = [];

	// TODO(Saar) Do we need this???
	var promises = inputFiles.map(function(inputFile) {
		var imports = importMap[inputFile.path] = [];
		var inputFileDir = path.dirname(inputFile.path);
		return inputFile.getText();
	});

	// Resolve import paths recursively, but prevent infinite recursion and duplicates
	function getImports(path, paths) {
		paths = paths || [];
		(importMap[path] || []).forEach(function(importPath) {
			if (paths.indexOf(importPath) < 0) {
				paths.push(importPath);
				getImports(importPath, paths);
			}
		});
		return paths;
	}

	return Promise.all(promises).then(function() {
		log.debug('Detected imports: %s', imported.join(', '));
		return inputPaths.filter(function(inputPath) {
			return imported.indexOf(inputPath) === -1;
		}).map(function(inputPath) {
			var outputPath = inputPath.replace(/\.scss$/, '.css');
			var importInputs = getImports(inputPath).map(function(importPath) {
				return { path: importPath, isReadOnly: true, trackRatio: true };
			});
			return new Batch(
				[ { path: inputPath, trackRatio: true } ].concat(importInputs),
				[ { path: outputPath, trackRatio: true }, outputPath + '.map' ],
				{ multiCore: true }
			);
		}).concat([ new Batch(imported, []) ]);
	});
};

processor.process = function(inputs, outputs) {
	// Import removal batch, nothing to do here
	if (outputs.length === 0) {
		return;
	}

	var input = inputs[0];
	var output = outputs[0];
	var mapOutput = outputs[1];
	var text = input.data;

	return sass.render({
		file: input.path,
		sourceMap: true,
		outFile: output.path,
		sourceMapContents: true
	}, function (err, result) {
		if(err) {
			throw err;
		}

		output.resolve(result.css);
		mapOutput.resolve(result.map);
	});
};

module.exports = processor;
