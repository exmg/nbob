// TODO(Saar) Watch imports for change
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

	var promises = inputFiles.map(function(inputFile) {
		var imports = importMap[inputFile.path] = [];
		var inputFileDir = path.dirname(inputFile.path);
		return inputFile.getText().then(function(text) {
			text.split('\n').forEach(function(line) {
				var matches = line.match(/@import (?:'|")(.*?)(?:'|")/);
				if (matches) {
					var filename = matches[1].indexOf('.') > -1 ? matches[1] : matches[1] + '.scss';
					var importPath = path.relative(projectDir, path.resolve(inputFileDir, filename));
					importPath = importPath.replace(/\\/g, '/'); // convert Windows to Unix path
					imports.push(importPath);
					if (imported.indexOf(importPath) === -1) {
						imported.push(importPath);
					}
				}
			});
		});
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
		data: input.data,
		sourceMap: true,
		outFile: output.path,
		sourceMapContents: true,
		importer: function(url, prev, done) {
			var matches = inputs.filter(function(input) {
				return input.path.indexOf('/' + url + '.scss') > -1;
			});

			if(!matches.length) {
				return;
			}

			return {
				file: matches[0].path,
				contents: matches[0].data
			};
		}
	}, function (error, result) {
		if(error) {
			return output.reject(Error(
				util.format('%s [%s:%d:%d]', error.message, error.file, error.line, error.column)
			));
		}

		output.resolve(result.css);
		mapOutput.resolve(result.map);
	});
};

module.exports = processor;
