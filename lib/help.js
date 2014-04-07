/*jshint node:true, strict:false*/

var _ = require('lodash');
var util = require('util');
var pkg = require('../package.json');
var commands = require('./commands');
var options = require('./options');

function commandsHelp(commands, depth) {
	depth = depth || 1;
	return commands.map(function(command) {
		var subCommands = '';
		if (command.subCommands.length > 0) {
			subCommands += '\n' + commandsHelp(command.subCommands, depth + 1);
		}
		// Bit of a hack this, but better then a 4 line loop IMHO
		var indentation = [].concat.apply([], new Array(depth * 2 + 1)).join(' ');
		var name = _.last(command.name.split(':'));
		var firstColumn = indentation + name;
		return firstColumn +
			(firstColumn.length > 7 ? '\t' : '\t\t') +
			command.desc + subCommands;
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
