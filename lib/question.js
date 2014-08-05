'use strict';

var readline = require('readline');
var Promise = require('./promise');

module.exports = function(text, def) {
	def = def || '';
	return new Promise(function(resolve) {
		var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(' > ' + text + (def ? ' [' + def + ']' : '') + ': ', function(answer) {
			rl.close();
			resolve(answer || def);
		});
	});
};
