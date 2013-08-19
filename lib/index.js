/*jshint node:true, strict:false*/
var program = require('commander');
var util = require('util');
var version = require('../package.json').version;

program.version(version);

// require('./command/foo')(program);

if (process.argv.length === 2) {
	process.argv[2] = '--help';
} else {
	program.command('*').action(function(arg) {
		util.print('  Invalid command: ' + arg);
		program.help();
	});
}

program.parse(process.argv);
