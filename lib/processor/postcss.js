'use strict';

var util = require('util');
var path = require('path');
var _ = require('lodash');
var postcss = require('postcss');
var Batch = require('../batch');
var Processor = require('../processor');
var Promise = require('../promise');
var autoprefixer = require('autoprefixer');

var projectDir = process.cwd();
var pluginNameMap = {
	autoprefixer: 'autoprefixer'
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
		return /\.css$/.test(inputPath);
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

	var plugins = [];

	_.each(config.plugins, function (options, name) {
		if(!options) {
			return;
		}

		name = pluginNameMap[name] || name;
		options = options === true ? {} : options;

		// Store plugins + options
		var module = require(name)(options);

		plugins.push(module);
	});

	var processor = postcss(plugins);

	processor.process(input.data, {
		from: input.path,
		to: output.path,
		map: {
			inline: false,
			prev: mapInput && mapInput.data,
			sourcesContent: true,
			annotation: false
		}
	}).then(function (result) {
		result.warnings().forEach(function (warning) {
			// `warning.line` isn't correct, so we only log info that is "usable".
			log.warn(warning.text);
			log.warn(warning.node + ' in file ' + input.path);
		});

		output.resolve(result.css);
		mapOutput.resolve(result.map.toString());
	}, function (err) {
		error.message = formatError(err);
		throw err;
	});
};

module.exports = processor;
