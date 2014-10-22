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

			// Remove input sourceMappingURL (assumed to be at end of generated data)
			inputData = inputData.replace(/\n?(\/\/# sourceMappingURL=\S+|\/\*# sourceMappingURL=\S+ \*\/)$/, '');
		} else {
			// TODO: Verify that this works
			generator.setSourceContent(inputPath, inputData);
			generator.addMapping({
				source: inputPath,
				original: { line: 1, column: 1 },
				generated: { line: currentLine + 1, column: 1 }
			});
		}

		// Ensure each inputData ends in a new line so we do not have to deal with columns etc.
		if (inputData[inputData.length - 1] !== '\n') {
			inputData += '\n';
		}

		concatenated += inputData;
		currentLine += inputData.match(/\n/g).length;
	});

	var mapOutputBasePath = path.basename(mapOutput.path);
	if (/\.css$/.test(output.path)) {
		concatenated += '/*# sourceMappingURL=' + mapOutputBasePath + ' */';
	} else {
		concatenated += '//# sourceMappingURL=' + mapOutputBasePath;
	}
	output.resolve(concatenated);
	mapOutput.resolve(JSON.stringify(generator, null, '\t'));
};

module.exports = processor;
