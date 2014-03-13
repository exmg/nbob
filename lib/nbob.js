/*jshint node:true, strict:false*/

// TODO: Use chalk for console styling (color, underline, bold)
// TODO: Use update-notifier to encourage use of latest version of nbob

var util = require('util');
var path = require('path');
var _ = require('lodash');
var minimist = require('minimist');
var abbrev = require('abbrev');
var pkg = require('../package.json');
var commands = require('./commands');
var options = require('./options');

console.log(pkg.name + ' v' + pkg.version);
console.log('Commands: ' + util.inspect(commands));
console.log('Options: ' + util.inspect(options));

var args = minimist(process.argv.slice(2), {
	boolean: _.pluck(_.filter(options, 'bool'), 'name'),
	default: options.filter(function(option) {
		return option.def !== undefined;
	}).reduce(function(defs, option) {
		defs[option.name] = option.def;
		return defs;
	}, {}),
	alias: abbrev(_.pluck(options, 'name'))
});

console.log('Arguments: ' + util.inspect(args));

module.exports = {
	dir: {
		project: __dirname,
		build: path.join(__dirname, 'build'),
		dist: path.join(__dirname, 'dist')
	}
};
