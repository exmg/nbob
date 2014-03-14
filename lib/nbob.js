/*jshint node:true, strict:false*/

// TODO: Choose/create simple logger
// TODO: Use chalk for console styling (color, underline, bold)?
// TODO: Show feedback on invalid commands/options
// TODO: Show help if requested
// TODO: Use update-notifier to encourage use of latest version of nbob

var util = require('util');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var pkg = require('../package.json');
var args = require('./args');
var commands = args.commands;
var options = args.options;

console.log('nBob v' + pkg.version);

function superExtend(x, y) {
	return _.extend({}, x, y, function(a, b) {
		return _.isArray(a) ? a.concat(b) : (_.isObject(a) ? superExtend(a, b) : b);
	});
}

var defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../nbob-config.json')));
var projectDir = path.resolve(options.dir);
var projectConfig = JSON.parse(fs.readFileSync(path.join(projectDir, 'nbob-config.json')));
var config = superExtend(defaultConfig, projectConfig);

var nbob = {
	commands: commands,
	options: options,
	dir: {
		project: projectDir,
		build: path.join(projectDir, 'build'),
		dist: path.join(projectDir, 'dist')
	},
	config: config
};

console.log(util.inspect(nbob, { depth: null }));

module.exports = nbob;
