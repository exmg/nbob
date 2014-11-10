'use strict';

var util = require('util');
var _ = require('lodash');
var Graph = require('../graph');
var minimatches = require('../minimatches');
var Promise = require('../promise');

function isTextFile(config, file) {
	return minimatches([ file.path ], config.textFiles).length ? true : false;
}

function getDependencies(config, files, file) {
	if (!isTextFile(config, file)) {
		return Promise.resolve([]);
	}

	return file.getText().then(function(/*text*/) {
		// TODO: Derive dependencies from file text
		return [];
	});
}

function createGraph(config, files) {
	var graph = new Graph();

	var promises = files.map(function(file) {
		graph.addNode(file);
		return getDependencies(config, files, file).then(function(depFiles) {
			depFiles.forEach(function(depFile) {
				graph.connectNodes(file, depFile);
			});
		});
	});

	return Promise.all(promises).then(function() {
		return graph;
	});
}

function getOrderedFiles(graph) {
	var orderedFiles = [];
	var leaf;

	while ((leaf = graph.firstLeaf()) !== -1) {
		orderedFiles.push(graph.getId(leaf));
		graph.removeNode(leaf);
	}

	if (graph.nodes.length > 0) {
		// Replace files by their paths so we can create a readable chart
		graph.nodes = graph.nodes.map(function(file) {
			return file.path;
		});
		throw new Error(util.format('Circular dependencies, see: %s', graph.chart()));
	}

	return orderedFiles;
}

function substituteContents(config, log, files, file) {
	if (!isTextFile(config, file)) {
		return Promise.resolve(file);
	}

	var substitutes = config.substitutes;

	return file.getText().then(function(text) {
		// TODO: Add support for __MD5__ substitution
		var newText = text.replace(/(['"]?)__(.+?)__(['"]?)/g, function(match, quote1, key, quote2) {
			var value = substitutes[key];
			if (value === undefined) {
				return match; // undefined substitute, leave as-is
			}

			if (/^LIST_/.test(key)) {
				value = minimatches(_.pluck(files, 'path'), value);
			}

			// TODO: If there is a source map file corresponding to this text file then that needs to be adapted too

			log.ok('%s: %s', file.path, key);

			// Output as JSON, removing any quotes for the benefit of valid JS: var obj = '__OBJ_JSON__';
			if (/_JSON$/.test(key)) {
				return JSON.stringify(value);
			}

			// Default: Leave any quotes intact and use string representation of value
			return quote1 + value + quote2;
		});

		if (newText !== text) {
			file.setBuffer(new Buffer(newText));
		}

		return file;
	});
}

function substitutePath(config, log, file) {
	var substitutes = config.substitutes;

	var newPath = file.path.replace(/__(.+?)__/g, function(match, key) {
		// TODO: Add support for __MD5__ substitution
		return substitutes[key] === undefined ? match : substitutes[key];
	});

	if (newPath !== file.path) {
		log.ok('%s => %s', file.path, newPath);
		file.path = newPath;
	}

	return file;
}

module.exports = function(config, log, files) {
	// Note: To deal with __MD5__ substitution we need to take care of the order in which we do things
	// So we process files sequentially, ordered by their dependency graph
	return createGraph(config, files).then(getOrderedFiles).then(function(orderedFiles) {
		return Promise.mapSeq(orderedFiles, function(file) {
			return substituteContents(config, log, files, file).then(function(file) {
				return substitutePath(config, log, file);
			});
		});
	});
};
