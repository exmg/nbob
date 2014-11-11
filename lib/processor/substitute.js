'use strict';

var _ = require('lodash');
var md5hex = require('../md5hex');
var minimatches = require('../minimatches');
var Promise = require('../promise');

function digestFiles(files) {
	return Promise.all(files.map(function(file) {
		return file.getMD5();
	})).then(function(md5s) {
		// Combination of file paths and md5s should provide a suitable combined digest
		return md5hex(files.map(function(file, i) {
			return file.path + md5s[i];
		}));
	});
}

function substituteContents(substitutes, log, files, file) {
	return file.getText().then(function(text) {
		var newText = text.replace(/(['"]?)__(.+?)__(['"]?)/g, function(match, quote1, key, quote2) {
			var value = substitutes[key];
			if (value === undefined) {
				return match; // undefined substitute, leave as-is
			}

			// Substitute by list of files matching specified patterns
			if (/^LIST_/.test(key)) {
				value = minimatches(_.pluck(files, 'path'), value);
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

		if (newText !== text) {
			file.setBuffer(new Buffer(newText));
		}

		return file;
	});
}

function substitutePath(substitutes, log, file) {
	var oldPath = file.path;

	var newPath = oldPath.replace(/__(.+?)__/g, function(match, key) {
		return substitutes[key] === undefined ? match : substitutes[key];
	});

	if (newPath !== oldPath) {
		log.debug('%s => %s', oldPath, newPath);
		file.path = newPath;
	}

	return file;
}

module.exports = function(config, log, files) {
	var substitutes = config.substitutes;
	var textFiles = config.textFiles;

	// Fill in the current build digest
	return digestFiles(files).then(function(digest) {
		// Prefix digest with build- so it is more human readable
		// 32 characters (128 bits) is a bit long for our purposes, 8 characters should suffice
		digest = 'build-' + digest.substr(0, 8);

		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__BUILD__/g, digest) : value;
		});

		// Substitute all file paths before file contents so file list substitutions will be correct
		return Promise.all(files.map(function(file) {
			return substitutePath(substitutes, log, file);
		}).map(function(file) {

			// Skip content substitution for non-text files
			if (!minimatches(file.path, textFiles)) {
				return file;
			}

			return substituteContents(substitutes, log, files, file);
		}));
	});
};
