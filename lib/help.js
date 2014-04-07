/*jshint node:true, strict:false*/

var _ = require('lodash');
var util = require('util');
var pkg = require('../package.json');
var commands = require('./commands');
var options = require('./options');

function commandsHelp(commands, depth) {
	depth = depth || 1;
	return commands.map(function(command) {
		var subCommandHelp = '';
		var subCommands = command.subCommands;
		if (subCommands.length > 0) {
			subCommandHelp += '\n' + commandsHelp(subCommands, depth + 1);
		}
		var firstColumn = '';
		for (var i = 0; i < depth; i++) {
			firstColumn += '  ';
		}
		firstColumn += _.last(command.name.split(':'));
		return firstColumn + (firstColumn.length > 7 ? '\t' : '\t\t') + command.desc + subCommandHelp;
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
		optionsHelp(options),
		'',
		'Note: Like options, commands can be abbreviated, per example:',
		'Full length:\tnbob --env=dev update:api deploy',
		'Abbreviated:\tnbob -e dev u:a d'
	);
	process.exit(1);
};
