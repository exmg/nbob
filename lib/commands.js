'use strict';

var _ = require('lodash');
var abbrev = require('abbrev');

// TODO: Move data into nbob-config and derive commands tree from there to enable more user and project customization

var Command = require('./command');

var cmdMake = new Command('make').addSubCommands([
	new Command('include', 'Include files'),
	new Command('l10n', 'Localize files', 'l10n-make'),
	new Command('images').addSubCommands([
		new Command('tinypng', 'Tinypng images')
	]),
	new Command('html').addSubCommands([
		new Command('minify', 'Minify HTML', 'html-minify'),
		new Command('templates', 'Concatenate templates', 'directory')
	]),
	new Command('css').addSubCommands([
		new Command('less', 'Compile LESS to CSS', 'less'),
		new Command('sass', 'Compile SASS to CSS')
	]),
	new Command('js').addSubCommands([
		new Command('hint', 'Analyze JS with JSHint', 'jshint'),
		new Command('es6', 'Transpile ES6 to ES5'),
		new Command('minify', 'Minify JS', 'uglify'),
		new Command('concat', 'Concatenate JS files', 'concat'),
		new Command('amd', 'Optimize EM AMD modules', 'em-amd'),
		new Command('test', 'Run tests')
	]),
	new Command('substitute').addSubCommands([
		new Command('path', 'Substitute in file paths', 'substitute-path'),
		new Command('text', 'Substitute in text files', 'substitute-text')
	]),
	new Command('dist', 'Write files to dist directory', 'dist')
]);

var commands = [
	new Command('init').addSubCommands([
		new Command('nbob', 'Create nbob-config.json'),
		new Command('hint', 'Create .jshintrc and .jshintignore')
	]),
	new Command('update').addSubCommands([
		new Command('api', 'Update EM api directory', 'em-api'),
		new Command('doc', 'Update doc directory'),
		new Command('l10n', 'Update l10n directory', 'l10n-update'),
		new Command('lib', 'Update lib directory')
	]),
	new Command('clean', 'Remove build and dist directories', 'clean'),
	cmdMake,
	new Command('server', 'Make and host files', 'server'),
	new Command('deploy', 'Make and copy to S3', 'deploy-s3').addDependencies([ cmdMake ])
];

function find(names, list) {
	var head = names[0];
	var tail = _.tail(names);
	var abbreviationMap = abbrev(_.pluck(list, 'name'));
	head = abbreviationMap[head];
	var command = _.find(list, { name: head });
	return command && tail.length > 0 ? find(tail, command.subCommands) : command;
}

commands.find = function(name) {
	return find(name.split(':'), commands);
};

function getName(command, list, parts, shorten) {
	if (list.indexOf(command) !== -1) {
		return parts.concat(command.name).join(':');
	}

	if (shorten) {
		var lengthenMap = abbrev(_.pluck(list, 'name'));
		shorten = {};
		_.each(lengthenMap, function(name, abbrev) {
			if (!shorten[name]) {
				shorten[name] = abbrev;
			}
		});
	}

	for (var i = 0; i < list.length; i++) {
		var sub = list[i];
		var subParts = parts.concat(shorten ? shorten[sub.name] : sub.name);
		var subName = getName(command, sub.subCommands, subParts, shorten);
		if (subName) {
			return subName;
		}
	}
}

commands.getName = function(command, shorten) {
	return getName(command, commands, [], shorten);
};

commands.select = function(list) {
	var expanded = _.flatten(list.map(function(command) {
		return command.expand();
	}));
	var ordered = _.flatten(commands.map(function(command) {
		return [ command ].concat(command.getSubCommands());
	}));
	return ordered.filter(function(command) {
		return expanded.indexOf(command) !== -1;
	});
};

module.exports = commands;
