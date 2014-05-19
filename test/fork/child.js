'use strict';

var jshint = require('jshint').JSHINT;

process.on('message', function(message) {
	if (message === 'goodbye') {
		process.exit();
	}

	var path = message.path;
	process.send(jshint(message.text, message.options) ?
		path + ' [OK]' :
		path + ' [' + jshint.errors.length + ' ERRORS]'
	);
});
