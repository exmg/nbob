'use strict';

var crypto = require('crypto');
var _ = require('lodash');
var args = require('../args');
var minimatches = require('../minimatches');
var Graph = require('../graph');
var Promise = require('../promise');

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

function orderFiles(textFiles, binaryFiles) {
	var graph = new Graph();

	// Binary files
	binaryFiles.forEach(function(file) {
		graph.addNode(file.path, file);
	});

	// TODO: Actually look into textFiles
	var promises = textFiles.map(function(file) {
		var myPath = file.path;
		graph.addNode(myPath, file);

		return file.getText().then(function(text) {
			text.replace(/([^'"]+)__(.+?)__([^'"]+)/g, function(/*match, head, key, tail*/) {
				// TODO: graph.connectNodes(myPath, x) where x is:
				//   LIST_ => all referred files
				//   <path>?__MD5__ => <path>
				//   <path> which contains __MD5__ => <path>

				// if (/^LIST_/.test(key)) {
				// 	minimatches(_.pluck(files, 'path'), value);
				// }
			});
		});
	});

	return Promise.all(promises).then(function() {
		return graph.reduceToRoot(function(ordered, file) {
			ordered.push(file);
			return ordered;
		}, []);
	});
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

function substituteContents(substitutes, log, files, file, getMD5) {
	return file.getText().then(function(text) {
		// First substitute normal, optionally quoted __KEY__ references (synchronously)
		var newText = text.replace(/(['"]?)__(.+?)__(['"]?)/g, function(match, quote1, key, quote2) {
			var value = substitutes[key];
			if (value === undefined) {
				return match; // undefined substitute, leave as-is
			}

			log.debug('%s: %s', file.path, key);

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

			return getMD5(md5File).then(function(md5) {
				return md5Path + between + md5;
			});
		}).then(function(newText) {
			if (newText !== text) {
				file.setText(newText);
			}

			return file;
		});
	});
}

function substitutePath(substitutes, log, file, getMD5) {
	var oldPath = file.path;

	return replace(oldPath, /__(.+?)__/g, function(match, key) {
		var value = substitutes[key];

		return key === 'MD5' ? getMD5(file) :
			value !== undefined ? value :
			match;
	}).then(function(newPath) {
		if (newPath !== oldPath) {
			log.debug('%s => %s', oldPath, newPath);
			file.path = newPath;
		}
		return file;
	});
}

module.exports = function(config, log, files) {
	var ignoreMD5 = config.ignoreMD5;
	var substitutes = config.substitutes;

	// TODO: Refactor ignoreMD5 and isTextFile stuff; it seems overly complicated
	// Might want to split up substituteContents and substitutePath or something instead
	// Also facilitates looking for dependencies due to MD5 substitutes if synchronous
	/*
		digestPromise = ignoreMD5 ? Promise.resolve : digestFiles
		digestPromise.then digest
			if digest
				substitutes __BUILD__ digest
			files.forEach file
				subPath file
			textFiles.forEach file
				subContents file
			orderFiles textFiles.then orderedFiles
				orderedFiles.forEach file
					subMD5Path
					subMD5Contents
	 */
	// Dang.. the above will work with any BUILD in file paths (but not MD5, only for query params)
	// Suppose it might be better to use a flow like we have below and just deal with more complex orderFiles function

	// TODO: Optimize with either 1 and/or 2
	// 1) Start by creating an array of a custom type of files that facilitate efficient synchronous processing
	//    E.g. with properties: path, md5 and text. Read on start and then finally written back to files at the end.
	// 2) Perform dependency analysis in getBatches to increase speed of incremental builds
	//    E.g: Enabling nBob to cache batch outputs and only need to process 1 or a few batches on a file change
	//
	// Or perhaps even better:
	// 3) Split MD5 and digest stuff off into a separate processor
	//    E.g: "md5", not a child of make, but deploy depends on it (or "deploy:md5"?)
	//    Or: "make:md5" below "make:substitute" and use config.ignore or something like we do now
	//    Enables substitute processor to work efficiently with single file batches (like 2)
	//    And MD5 processor efficiently with all file contents (like 1)

	var textFiles = [];
	var binaryFiles = [];
	files.forEach(function(file) {
		var array = minimatches(file.path, config.textFiles) ? textFiles : binaryFiles;
		array.push(file);
	});

	var getMD5 = function(file) {
		return ignoreMD5 ? Promise.resolve('__MD5__') : file.getText().then(function(text) {
			return md5URI([ text ]);
		});
	};

	var prePromises = ignoreMD5 ? [ files ] :
		[ orderFiles(textFiles, binaryFiles), digestFiles(files) ];

	return Promise.apply(prePromises, function(orderedFiles, digest) {
		if (digest) {
			substitutes = _.mapValues(substitutes, function(value) {
				return typeof value === 'string' ? value.replace(/__BUILD__/g, 'build-' + digest) : value;
			});
		}

		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__ENV__/g, args.env || '') : value;
		});

		return Promise.reduce(orderedFiles, function(results, file) {
			var contentsPromise = textFiles.indexOf(file) >= 0 ?
				substituteContents(substitutes, log, files, file, getMD5) :
				Promise.resolve();

			return contentsPromise.then(function() {
				substitutePath(substitutes, log, file, getMD5);

				results.push(file);
				return results;
			});
		}, []);
	});
};
