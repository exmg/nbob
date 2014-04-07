/*jshint node:true, strict:false*/

var _ = require('lodash');
var abbrev = require('abbrev');
var Command = require('./command');

var commands = [
	new Command('init', 'Init project files', null, [
		// TODO
	]),
	new Command('update', 'Update project files', null, [
		// TODO:
		// api** - Update API files (from server)
		// doc - Update doc directory with JSDoc
		// l10n* - Update locales files
		// lib* - Update lib files (from sibling directories?)
		// images - Optimize image files
	]),
	new Command('clean', 'Remove build and dist files', 'clean'),
	new Command('make', 'Analyze, build and test', null, [
		new Command('analyze', 'Analyze source files', null, [
			new Command('js', 'JavaScript', null, [
				// TODO:
				// new Command('hint', 'With JSHint', require('./processor/jshint'))
				// conventions* - Check further coding conventions
				// modules** - Check definitions and dependencies
			])
			// TODO:
			// l10n* - Check localization syntax errors
		])
		// TODO:
		// build - Create or update build directories
		// 	l10n* - Localize text files and directories
		// 	templates* - Concatenate templates directories to JSON files
		// 	css - Compile and minify CSS
		// 		less - Compile with LESS
		// 		minify - Minify with YUICompressor
		// 	js - Compile and minify JavaScript
		// 		es6 - Transpile Class, Module, Promise, etc. support to ES5 JS (build/src)
		// 		concat - Concatenate lib and src JS files
		// 		prune - Remove unused modules**
		// 		minify - Minify with UglifyJS
		// 	inc* - Replace includes in text files (*-inc.*?)
		// 	substitute* - Replace version, checksum, file list, config etc. in paths and text files
		// test - Run unit tests
	]),
	new Command('serve', 'Make and host files on a web server', null, [
		// TODO
	]),
	new Command('deploy', 'Clean, make, gzip and copy to S3', null, [
		// TODO
	])
];


function find(headParts, parts, subCommands) {
	var currPart = parts[0];
	var tailParts = _.tail(parts);

	// Lengthen any abbreviations
	var abbrevMap = abbrev(_.pluck(subCommands, 'name').map(function(name) {
		return _.last(name.split(':'));
	}));
	currPart = abbrevMap[currPart];

	headParts.push(currPart);

	var command = _.find(subCommands, { name: headParts.join(':') });

	return tailParts.length > 0 ? find(headParts, tailParts, command.subCommands) : command;
}

commands.find = function(name) {
	return find([], name.split(':'), commands);
};

module.exports = commands;
