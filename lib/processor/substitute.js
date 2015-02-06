'use strict';

var crypto = require('crypto');
var _ = require('lodash');
var args = require('../args');
var minimatches = require('../minimatches');
var Promise = require('../promise');

// Base64 based md5 digest alternative to md5hex that maps URI unsafe characters to safe alternatives
// MD5 is 128 bits so the 2 trailing == can be stripped without losing information
// Replacing + and / by a and b destroys a small amount of information, but it looks better then - and _
function md5uri64(strings) {
	var sum = crypto.createHash('md5');
	strings.forEach(function(str) {
		sum.update(str, 'utf8');
	});
	return sum.digest('base64').replace(/[\+\/=]/g, function(ch) {
		return { '+': 'a', '/': 'b', '=': '' }[ch];
	});
}

// Combination of file paths and md5s should provide a suitable combined digest
// Use md5uri64 instead of md5hex to minimize digest string length
function digestFiles(files) {
	return Promise.all(files.map(function(file) {
		return file.getMD5().then(function(md5) {
			return { path: file.path, md5: md5 };
		});
	})).then(function(inputs) {
		return md5uri64(inputs.map(function(input) {
			return input.path + input.md5;
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
		// 22 characters (128 bits base64) is still a bit long for our purposes, 8 characters (48 bits) should suffice
		digest = 'build-' + digest.substr(0, 8);

		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__BUILD__/g, digest) : value;
		});

		// Also substitute __ENV__ by args.env
		substitutes = _.mapValues(substitutes, function(value) {
			return typeof value === 'string' ? value.replace(/__ENV__/g, args.env || '') : value;
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
