'use strict';

var util = require('util');
var path = require('path');
var _ = require('lodash');
var postcss = require('postcss');
var Batch = require('../batch');
var Processor = require('../processor');
var Promise = require('../promise');

var projectDir = process.cwd();
var pluginNameMap = {
	autoprefixer: 'autoprefixer-core'
};

var processor = new Processor('https://github.com/postcss/postcss/');

// Adapt error message so it matches our conventions
function formatError(error) {
	var file = path.relative(projectDir, error.file);
	return util.format('%s [%s:%d:%d]', error.reason, file, error.line, error.column);
}

processor.getBatches = function(inputPaths) {
	// Abort if not a single plugin is enabled
	if (!_.some(this.config.plugins)) {
		return [];
	}

	return inputPaths.filter(function(inputPath) {
		return !/\.map$/.test(inputPath);
	}).map(function(cssPath) {
		var mapPath = cssPath + '.map';
		var inputs = inputPaths.indexOf(mapPath) >= 0 ? [ cssPath, mapPath ] : [ cssPath ];
		return new Batch(inputs, [ cssPath, mapPath ], { multiCore: true });
	});
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var log = this.log;
	var input = inputs[0];
	var mapInput = inputs[1];
	var output = outputs[0];
	var mapOutput = outputs[1];

	var processor = postcss();

	// Note: Plugin modules are lazy loaded to prevent unnecessarily loading them when they are disabled
	_.each(config.plugins, function(options, name) {
		if (!options) {
			return;
		}

		// TODO: try catch plugin instantiation to provide clear error in case of invalid plugin options etc?
		name = pluginNameMap[name] || name;
		options = options === true ? {} : options;
		var module = require(name);
		processor.use(module(options).postcss);
	});

	var resultPromise;
	try {
		resultPromise = processor.process(input.data, {
			from: input.path,
			to: output.path,
			map: {
				inline: false,
				prev: mapInput && mapInput.data,
				sourcesContent: true,
				annotation: false
			}
		});
	} catch (error) {
		// For some reason processor.process can both throw _and_ return a rejected Promise?
		log.warn('Caught processor.process error');
		resultPromise = Promise.reject(error);
	}

	return resultPromise.then(function(result) {
		result.warnings().forEach(function(warning) {
			log.warn(formatError(warning.node.error(warning.text, { plugin: warning.plugin })));
		});

		output.resolve(result.css);
		mapOutput.resolve(result.map.toString());
	}, function(error) {
		error.message = formatError(error);
		throw error;
	});
};

module.exports = processor;
