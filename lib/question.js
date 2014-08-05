'use strict';

var readline = require('readline');
var Promise = require('./promise');

module.exports = function(text) {
	return new Promise(function(resolve) {
		var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question('\n > ' + text + ': ', function(answer) {
			rl.close();
			console.log();
			resolve(answer);
		});
	});
};
