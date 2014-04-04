/*jshint node:true, strict:false*/

var util = require('util');
var pkg = require('../package.json');
var commands = require('./commands');
var options = require('./options');

function commandsHelp(commands, indent) {
	indent = indent || 0;
	return commands.map(function(command) {
		// TODO: Recurse into sub-commands (if command.action is Array of Commands)
		return '  ' + command.name + ' - ' + command.desc;
	}).join('\n');
}

function optionsHelp(options) {
	return options.map(function(option) {
		return '  -' + option.name.substr(0, 1) + ', --' + option.name + '\t' + option.desc +
			(option.def ? ' (default: ' + option.def + ')' : '');
	}).join('\n');
}

module.exports = function() {
	util.error(
		'',
		'nBob v' + pkg.version,
		'',
		'Usage: nbob [options] <commands>',
		'',
		'Commands:',
		commandsHelp(commands),
		'',
		'Options:',
		optionsHelp(options)
	);
	process.exit(1);
};
