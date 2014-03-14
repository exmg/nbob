/*jshint node:true, strict:false*/

var _ = require('lodash');
var minimist = require('minimist');
// var abbrev = require('abbrev');
// var commands = require('./commands');
var options = require('./options');

var minOptions = {
	boolean: _.pluck(_.filter(options, 'bool'), 'name'),
	default: _.transform(_.filter(options, 'def'), function(defs, option) {
		defs[option.name] = option.def;
	}, {}),
	alias: _.transform(options, function(aliases, option) {
		aliases[option.name.substr(0, 1)] = option.name;
	}, {})
};
var args = minimist(process.argv.slice(2), minOptions);
args = _.omit(args, Object.keys(minOptions.alias));

var argCommands = []; // TODO
var invalidCommands = []; // TODO

var argOptions = _.omit(args, '_');
var invalidOptions = _.omit(argOptions, _.pluck(options, 'name'));

module.exports = {
	commands: argCommands,
	invalidCommands: invalidCommands,
	options: argOptions,
	invalidOptions: invalidOptions
};
