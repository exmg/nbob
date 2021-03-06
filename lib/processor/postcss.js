'use strict';

var util = require('util');
var path = require('path');
var _ = require('lodash');
var postcss = require('postcss');
var Batch = require('../batch');
var Processor = require('../processor');

var projectDir = process.cwd();

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
		var cssInput = { path: cssPath, trackRatio: true };
		var inputs = inputPaths.indexOf(mapPath) >= 0 ? [ cssInput, mapPath ] : [ cssInput ];
		return new Batch(inputs, [ { path: cssPath, trackRatio: true }, mapPath ], { multiCore: true });
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

	_.each(config.plugins, function(options, name) {
		if (!options) {
			return;
		}

		// Load plugin with options
		options = options === true ? {} : options;
		var plugin = require(name)(options);
		plugins.push(plugin);
	});

	var processor = postcss(plugins);

	var mapInputObj;
	if (mapInput) {
		mapInputObj = JSON.parse(mapInput.data);

		// PostCSS requires absolute source paths for some annoying reason
		// See: https://github.com/postcss/postcss/issues/240
		mapInputObj.sources = mapInputObj.sources.map(function(source) {
			return path.join(projectDir, source);
		});

		// Work around PostCSS validator throwing on empty mappings
		if (!mapInputObj.mappings) {
			log.warn('Invalid source map (no mappings): %s', mapInput.path);
			mapInputObj = false;
		}
	}

	return processor.process(input.data, {
		from: input.path,
		to: output.path,
		map: {
			inline: false,
			prev: mapInputObj,
			sourcesContent: true,
			annotation: false
		}
	}).then(function(result) {
		var warnings = result.warnings().map(function(warning) {
			// Create an error based on this warning to have things like source file and line resolved for us
			var error = warning.node.error(warning.text, { plugin: warning.plugin });
			return formatError(error);
		});

		if (warnings.length > 0) {
			var warningsMsg = util.format('%s: %d warnings:\n%s', input.path, warnings.length, warnings.join('\n'));
			if (config.ignoreWarnings) {
				log.warn(warningsMsg);
			} else {
				throw new Error(warningsMsg);
			}
		}

		output.resolve(result.css);
		mapOutput.resolve(result.map.toString());
	}).catch(function(error) {
		if (error.file) {
			error.message = formatError(error);
		}
		throw error;
	});
};

module.exports = processor;
