'use strict';

var util = require('util');

function getName(path, nameRegex) {
	nameRegex = new RegExp(nameRegex);
	path = path.replace(/\\/g, '/'); // convert windows to unix path
	return path.match(nameRegex)[1];
}

// Make error message more descriptive and match our conventions for log output
function improveError(error, inputPath) {
	var message = error.message;
	var row = error.lineNumber;
	var column = error.column || 0;
	var matches;

	// "Parse error on line xx: ..."
	matches = message.match(/(.*) on line (\d+):.*/);
	if (matches) {
		message = matches[1];
		row = matches[2];
	}

	// "... - xx:yy"
	matches = message.match(/(.*) - (\d+):(\d+)$/);
	if (matches) {
		message = matches[1];
		row = matches[2];
		column = matches[3];
	}

	error.message = row ?
		util.format('%s [%s:%d:%d]', message, inputPath, row, column) :
		util.format('%s [%s]', message, inputPath);
	return error;
}

module.exports = {
	getName: getName,
	improveError: improveError
};
