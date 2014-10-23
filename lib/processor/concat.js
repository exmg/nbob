'use strict';

var path = require('path');
var _ = require('lodash');
var sourceMapModule = require('source-map');
var SourceMapGenerator = sourceMapModule.SourceMapGenerator;
var SourceMapConsumer = sourceMapModule.SourceMapConsumer;
var jsonParse = require('../json-parse');
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	// Input paths are sorted alphabetically and by file patterns order (see: minimatches)
	// They can be ordered by re-arranging the "files" config or changing their names (p.e: lib/1/z.js, lib/2/a.js)
	var output = this.config.output;
	return [ new Batch(inputPaths, [ output, output + '.map' ]) ];
};

processor.process = function(inputs, outputs) {
	var output = outputs[0];
	var mapOutput = outputs[1];
	var generator = new SourceMapGenerator({ file: path.basename(output.path) });
	var concatenated = '';
	var currentLine = 0;

	inputs.filter(function(input) {
		// Start by filtering out source map files, we will look them up again later
		return !/\.map$/.test(input.path);
	}).forEach(function(input) {
		var inputPath = input.path;
		var inputData = input.data;

		if (inputData.length === 0) {
			return;
		}

		// Remove input sourceMappingURLs, we will create a concatenated source map instead
		inputData = inputData.replace(/\n?(\/\/# sourceMappingURL=\S+|\/\*# sourceMappingURL=\S+ \*\/)/g, '');

		// Ensure each inputData ends in a new line so we do not have to deal with columns etc.
		if (inputData[inputData.length - 1] !== '\n') {
			inputData += '\n';
		}

		var nrLines = inputData.match(/\n/g).length;

		// We assume source map files to have the same path as the generated file but with a .map suffix
		var mapInputPath = inputPath + '.map';
		var mapInput = _.find(inputs, { path: mapInputPath });
		if (mapInput) {
			var sourceMap = jsonParse(mapInputPath, mapInput.data);

			sourceMap.sources.forEach(function(source, i) {
				var sourceContent = sourceMap.sourcesContent[i];
				generator.setSourceContent(source, sourceContent);
			});

			var sourceMapConsumer = new SourceMapConsumer(sourceMap);
			sourceMapConsumer.eachMapping(function(mapping) {
				generator.addMapping({
					source: mapping.source,
					name: mapping.name,
					original: { line: mapping.originalLine, column: mapping.originalColumn },
					generated: {
						line: mapping.generatedLine + currentLine,
						column: mapping.generatedColumn
					}
				});
			});
		} else {
			// Create basic line mappings
			generator.setSourceContent(inputPath, inputData);
			for (var i = 0; i < nrLines; i++) {
				generator.addMapping({
					source: inputPath,
					original: { line: 1 + i, column: 1 },
					generated: { line: currentLine + 1 + i, column: 1 }
				});
			}
		}

		concatenated += inputData;
		currentLine += nrLines;
	});

	output.resolve(concatenated);
	mapOutput.resolve(JSON.stringify(generator, null, '\t'));
};

module.exports = processor;
