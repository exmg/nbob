'use strict';

var path = require('path');
var util = require('util');
var LessParser = require('less').Parser;
var Batch = require('../batch');
var Processor = require('../processor');
var Promise = require('../promise');

var processor = new Processor();

processor.getBatches = function(inputPaths, inputFiles) {
	var log = this.log;
	var importMap = {};
	var imported = [];

	var promises = inputFiles.map(function(inputFile) {
		var imports = importMap[inputFile.path] = [];
		var inputFileDir = path.dirname(inputFile.path);
		return inputFile.getText().then(function(text) {
			text.split('\n').forEach(function(line) {
				var matches = line.match(/@import (\(\w+\)\s*)*"(.*)"/);
				if (matches) {
					var importPath = path.relative(process.cwd(), path.resolve(inputFileDir, matches[2]));
					importPath = importPath.replace(/\\/g, '/'); // convert Windows to Unix path
					imports.push(importPath);
					if (imported.indexOf(importPath) === -1) {
						imported.push(importPath);
					}
				}
			});
		});
	});

	return Promise.all(promises).then(function() {
		log.debug('Detected imports: %s', imported.join(', '));
		return inputPaths.filter(function(inputPath) {
			return imported.indexOf(inputPath) === -1;
		}).map(function(inputPath) {
			var outputPath = inputPath.replace(/\.less$/, '.css');
			var importInputs = importMap[inputPath].map(function(importPath) {
				return { path: importPath, isReadOnly: true, trackRatio: true };
			});
			return new Batch(
				[ { path: inputPath, trackRatio: true } ].concat(importInputs),
				[ { path: outputPath, trackRatio: true }, outputPath + '.map' ]
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

	// TODO: Have LessParser use import data from inputs[1,..] instead of it reading the files again itself

	var parser = new LessParser({
		paths: [ '.' ],
		filename: input.path
	});

	parser.parse(text, function (error, tree) {
		if (error) {
			output.reject(new Error(util.format('%s [%s:%d:%d]',
				error.message, error.filename, error.line, error.index)));
		} else {
			// Note: For tree.toCSS() options see: https://github.com/less/less.js/blob/master/lib/less/env.js
			// And/or: https://github.com/less/less.js/blob/master/bin/lessc (many more?)
			//
			// Note: I'd prefer to use clean-css compression in a separate processor, but it doesn't support source
			// maps yet, so instead we will just use the LESS compress option instead
			var css = tree.toCSS({
				sourceMap: true,
				outputSourceFiles: true,
				writeSourceMap: mapOutput.resolve,
				compress: true
			});

			// Workaround for writeSourceMap not being called with zero length CSS
			if (css.length === 0) {
				output.resolve('');
				mapOutput.resolve('');
				return;
			}

			css += '\n/*# sourceMappingURL=' + path.basename(mapOutput.path) + ' */';
			output.resolve(css);
		}
	});

};

module.exports = processor;
