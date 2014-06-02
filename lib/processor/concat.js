'use strict';

var path = require('path');
var _ = require('lodash');
var sourceMapModule = require('source-map');
var SourceMapConsumer = sourceMapModule.SourceMapConsumer;
var SourceMapGenerator = sourceMapModule.SourceMapGenerator;
var SourceNode = sourceMapModule.SourceNode;
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	// Input paths are sorted alphabetically and by file patterns order (see: minimatches)
	// They can be ordered by re-arranging the "files" config or changing their names (p.e: lib/1/z.js, lib/2/a.js)
	var output = this.config.output;
	return [ new Batch(inputPaths, [ output, output + '.map' ]) ];
};

// Loosely based on: https://github.com/kozy4324/grunt-concat-sourcemap/blob/master/tasks/concat_sourcemap.js
processor.process = function(inputs, outputs) {
	var log = this.log;
	var sourceNode = new SourceNode();
	var sourceMaps = [];

	inputs.filter(function(input) {
		return !/\.map$/.test(input.path);
	}).forEach(function(input) {
		var inputPath = input.path;
		var inputData = input.data;

		var mapInputPath = inputPath + '.map';
		var mapInput = _.find(inputs, { path: mapInputPath });
		if (mapInput) {
			var sourceMap = JSON.parse(mapInput.data);
			if ((sourceMap.sourcesContent || []).length !== sourceMap.sources.length) {
				throw new Error('sourcesContent property missing in: ' + mapInputPath);
			}
			sourceMap.file = inputPath;
			sourceMaps.push(sourceMap);
		} else {
			log.warn('Input map not found: %s', mapInputPath);
			sourceNode.setSourceContent(inputPath, inputData);
		}

		inputData.split('\n').forEach(function(line, lineIndex) {
			line = line.replace(/(\/\/# sourceMappingURL=\S+|\/\*# sourceMappingURL=\S+ \*\/)/, '');
			if (!line) {
				return;
			}
			sourceNode.add(new SourceNode(lineIndex + 1, 0, inputPath, line + '\n'));
		});
	});

	var output = outputs[0];
	var mapOutput = outputs[1];

	if (/\.css$/.test(output.path)) {
		sourceNode.add('/*# sourceMappingURL=' + path.basename(mapOutput.path) + ' */');
	} else {
		sourceNode.add('//# sourceMappingURL=' + path.basename(mapOutput.path));
	}

	var codeMap = sourceNode.toStringWithSourceMap({ file: path.basename(output.path) });

	output.resolve(codeMap.code);

	var generator = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(codeMap.map.toJSON()));
	sourceMaps.forEach(function(sourceMap){
		generator.applySourceMap(new SourceMapConsumer(sourceMap));
	});
	var newSourceMap = generator.toJSON();

	var sourcesContent = newSourceMap.sourcesContent;
	newSourceMap.sources.forEach(function(source, i) {
		if (!sourcesContent[i]) {
			log.warn('No content for: %s', source);
		}
	});

	mapOutput.resolve(JSON.stringify(newSourceMap, null, '\t'));
};

module.exports = processor;
