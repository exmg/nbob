'use strict';

var path = require('path');
var _ = require('lodash');
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var dirs = _.uniq(inputPaths.map(path.dirname));
	return dirs.map(function(dir) {
		var inputs = inputPaths.filter(function(inputPath) {
			return inputPath.indexOf(dir + '/') === 0;
		}).map(function(path) {
			return { path: path, trackRatio: true };
		});
		return new Batch(inputs, [ { path: dir + '.json', trackRatio: true } ]);
	});
};

processor.process = function(inputs, outputs) {
	var ext = this.config.ext;
	var texts = _.pluck(inputs, 'data');
	var map = _.transform(texts, function(map, text, i) {
		map[path.basename(inputs[i].path, ext)] = text;
	}, {});
	var output = outputs[0];
	output.resolve(JSON.stringify(map, null, '\t'));
};

module.exports = processor;
