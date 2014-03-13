/*jshint node:true, strict:false*/

var Command = require('./command');

module.exports = [
	new Command('init', 'Init project files', [
		// TODO
	]),
	new Command('update', 'Update project files', [
		// TODO:
		// api** - Update API files (from server)
		// doc - Update doc directory with JSDoc
		// l10n* - Update locales files
		// lib* - Update lib files (from sibling directories?)
		// images - Optimize image files
	]),
	new Command('clean', 'Remove build and dist files', require('./clean')),
	new Command('make', 'Analyze, build and test', [
		new Command('analyze', 'Analyze source files', [
			new Command('js', 'JavaScript', [
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
	new Command('serve', 'Make and host files on a web server', [
		// TODO
	]),
	new Command('deploy', 'Clean, make, gzip and copy to S3', [
		// TODO
	])
];
