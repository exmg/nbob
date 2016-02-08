'use strict';

var crypto = require('crypto');
var _ = require('lodash');
var args = require('../args');
var minimatches = require('../minimatches');
var Graph = require('../graph');
var Promise = require('../promise');

function getDependencyGraph(textFiles, binaryFiles) {
	var graph = new Graph();

	// Binary files
	binaryFiles.forEach(function(file) {
		graph.addNode(file.path, file);
	});

	// TODO: Actually look into textFiles
	textFiles.forEach(function(file) {
		graph.addNode(file.path, file);
	});

	return Promise.resolve(graph);
}

// Base64 based md5 digest alternative to md5hex that maps URI unsafe characters to safe alternatives
// MD5 is 128 bits so the 2 trailing == can be stripped without losing information
// Replacing + and / by a and b destroys a small amount of information, but it looks better then - and _
// 22 characters (128 bits base64) is still a bit long for our purposes, 8 characters (48 bits) should suffice
// Combined with + and / substitution this equals 45.5 bits
function md5URI(strings) {
	var sum = crypto.createHash('md5');
	strings.forEach(function(str) {
		sum.update(str, 'utf8');
	});
	return sum.digest('base64').replace(/[\+\/=]/g, function(ch) {
		return { '+': 'a', '/': 'b', '=': '' }[ch];
	}).substr(0, 8);
}

// Combination of file paths and md5s should provide a suitable combined digest
// Use md5URI instead of md5hex to minimize digest string length
function digestFiles(files) {
	return Promise.all(files.map(function(file) {
		return file.getMD5().then(function(md5) {
			return { path: file.path, md5: md5 };
		});
	})).then(function(inputs) {
		return md5URI(inputs.map(function(input) {
			return input.path + input.md5;
		}));
	});
}

function replace(str, regex, fn) {
	var promises = [];

	str.replace(regex, function(match) {
		promises.push(fn.apply(this, arguments));
		return match;
	});

	return Promise.all(promises).then(function(values) {
		var i = 0;
		return str.replace(regex, function() {
			return values[i++];
		});
	});
}

function substituteContents(substitutes, log, files, file) {
	return file.getText().then(function(text) {
		// First substitute normal, optionally quoted __KEY__ references (synchronously)
		var newText = text.replace(/(['"]?)__(.+?)__(['"]?)/g, function(match, quote1, key, quote2) {
			var value = substitutes[key];
			if (value === undefined) {
				return match; // undefined substitute, leave as-is
			}

			// Substitute by list of files matching specified patterns
			if (/^LIST_/.test(key)) {
				value = minimatches(_.pluck(files, 'path'), value);
			}

			// Add MD5 query params to paths (e.g: LIST_MD5_.._JSON)
			if (/[_^]MD5[_$]/.test(key)) {
				value = value.map(function(path) {
					return path + '?__MD5__';
				});
			}

			log.debug('%s: %s', file.path, key);

			// Encode value using JSON
			if (/_JSON$/.test(key)) {
				value = JSON.stringify(value);
				// Remove any matching quotes for the benefit of valid JS: var obj = '__OBJ_JSON__';
				if (quote1 === quote2) {
					quote1 = quote2 = '';
				}
			}

			// TODO: If there is a source map file corresponding to this text file then that needs to be adapted too

			return quote1 + value + quote2;
		});

		// Then substitute <path>?__MD5__ references (asynchronously)
		var md5QueryRE = /([^'"]+)(\?[^'"]*)__MD5__/g;
		return replace(newText, md5QueryRE, function(match, md5Path, between) {
			// TODO: Also support relative path (e.g: try relative first and fall back to absolute)
			var md5File = _.find(files, { path: md5Path });
			if (!md5File) {
				throw new Error('Can not find file to get MD5 for: %s [%s]', match, file.path);
			}

			log.debug('%s: %s', file.path, md5Path);

			return md5File.getText().then(function(md5Text) {
				return md5Path + between + md5URI([ md5Text ]);
			});
		}).then(function(newText) {
			if (newText !== text) {
				file.setText(newText);
			}

			return file;
		});
	});
}

function substitutePath(substitutes, log, file) {
	var oldPath = file.path;

	return replace(oldPath, /__(.+?)__/g, function(match, key) {
		var value = substitutes[key];

		if (key === 'MD5') {
			return file.getText().then(function(text) {
				return md5URI([ text ]);
			});
		}

		return value !== undefined ? value : match;
	}).then(function(newPath) {
		if (newPath !== oldPath) {
			log.debug('%s => %s', oldPath, newPath);
			file.path = newPath;
		}
		return file;
	});
}

module.exports = function(config, log, files) {
	var substitutes = config.substitutes;

	var textFiles = [];
	var binaryFiles = [];
	files.forEach(function(file) {
		var array = minimatches(file.path, config.textFiles) ? textFiles : binaryFiles;
		array.push(file);
	});

	return Promise.apply([
		getDependencyGraph(textFiles, binaryFiles),
		digestFiles(files)
	], function(graph, digest) {
		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__BUILD__/g, 'build-' + digest) : value;
		});

		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__ENV__/g, args.env || '') : value;
		});

		var orderedFiles = graph.reduceToRoot(function(ordered, file) {
			ordered.push(file);
			return ordered;
		}, []);

		return Promise.reduce(orderedFiles, function(results, file) {
			var contentsPromise = textFiles.indexOf(file) >= 0 ?
				substituteContents(substitutes, log, files, file) :
				Promise.resolve();

			return contentsPromise.then(function() {
				substitutePath(substitutes, log, file);

				results.push(file);
				return results;
			});
		}, []);
	});
};
