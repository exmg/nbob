'use strict';

var util = require('util');
var jsonlint = require('jsonlint');
var parser = jsonlint.parser;
var lexer = parser.lexer;

// This solution is based on the following from: https://github.com/zaach/jsonlint/blob/master/lib/cli.js
//
// if (options.compact) {
//   var fileName = options.file? options.file + ': ' : '';
//   parser.parseError = parser.lexer.parseError = function(str, hash) {
//     console.error(fileName + 'line '+ hash.loc.first_line +', col '+ hash.loc.last_column +
//       ', found: \''+ hash.token +'\' - expected: '+ hash.expected.join(', ') +'.');
//     throw new Error(str);
//   };
// }

module.exports = function(filename, text) {
	/*jshint camelcase:false*/

	var originalParseError = parser.parseError;
	parser.parseError = lexer.parseError = function(str, hash) {
		var loc = hash.loc;
		throw new Error(util.format('%s  [%s:%d:%d]', str, filename, loc.first_line, loc.last_column));
	};

	try {
		return parser.parse(text);
	} finally {
		parser.parseError = lexer.parseError = originalParseError;
	}
};

