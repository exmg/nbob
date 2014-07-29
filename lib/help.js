'use strict';

var util = require('util');
var pkg = require('../package.json');
var commands = require('./commands');
var options = require('./options');

function commandsHelp(commands, depth) {
	depth = depth || 1;
	return commands.map(function(command) {
		var name = command.name;
		for (var i = 0; i < depth; i++) {
			name = '  ' + name;
		}
		var desc = command.desc ? (command.processor ? '' : '*') + command.desc : '';
		var subHelp = '';
		var subCommands = command.subCommands;
		if (subCommands.length > 0) {
			subHelp += '\n' + commandsHelp(subCommands, depth + 1);
		}
		return name + (name.length > 7 ? '\t' : '\t\t') + desc + subHelp;
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
		'nBob v' + pkg.version,
		'',
		'Usage: nbob [options] <commands>',
		'',
		'Commands:',
		commandsHelp(commands),
		'',
		'Options:',
		optionsHelp(options),
		'',
		'*) Not yet implemented',
		'',
		'Note: Like options, commands can be abbreviated, per example:',
		'Full length:\tnbob --env=staging update:api deploy',
		'Abbreviated:\tnbob -e staging u:a d'
	);
};
