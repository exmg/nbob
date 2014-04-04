/*jshint node:true, strict:false*/

var fs = require('fs');
var _ = require('lodash');
var minimist = require('minimist');
// var abbrev = require('abbrev');
// var commands = require('./commands');
var options = require('./options');
var log = require('./log').create(__filename);

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

// Change root log level here so optional 'silent' can immediately suppress following error logs
log.root.level = args.level;

var argOptions = _.omit(args, '_');
var invalidOptions = _.difference(Object.keys(argOptions), _.pluck(options, 'name'));
if (invalidOptions.length > 0) {
	log.help('Invalid option(s): %s', invalidOptions.join(' '));
}

_.pluck(_.filter(options, 'dir'), 'name').forEach(function(name) {
	var path = argOptions[name];
	if (typeof path !== 'string' || !fs.statSync(path).isDirectory()) {
		log.help('Option: %s=\'%s\' is not a directory', name, path);
	}
});

// TODO check validity of commands, support abbreviations (and return command instances instead of names?)
var argCommands = args._;

module.exports = {
	options: argOptions,
	commands: argCommands
};
