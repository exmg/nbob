'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var options = require('./args').options;
var log = require('./logger').create('config');

var configFn = 'nbob-config.json';
var homeSubDir = '.nbob';
var homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var projectDir = path.resolve(options.dir);

function resolve(obj, path) {
	var i = path.indexOf('.');
	var head = path.substr(0, i);
	var tail = path.substr(i + 1);
	return head ? resolve(obj[head], tail) : obj[path];
}

function subst(subj, obj) {
	if (_.isObject(subj)) {
		_.each(subj, function(value, key) {
			subj[key] = subst(value, obj);
		});
	} else if (_.isString(subj)) {
		subj = subj.replace(/{{([^}]+)}}/g, function(match, path) {
			return resolve(obj, path);
		});
	}
	return subj;
}

function extend() {
	var args = _.toArray(arguments);
	args.push(function(a, b) {
		// TODO: Also support overriding an array or object somehow rather then just extending them?
		return _.isArray(a) ? a.concat(b) : (_.isObject(a) && _.isObject(b) ? extend(a, b) : b);
	});
	return _.extend.apply(_, args);
}

function read() {
	var fn = path.join.apply(path, arguments);
	try {
		return JSON.parse(fs.readFileSync(fn));
	} catch (e) {
		log.help('Error reading and parsing file: %s\n  %s', fn, e.message);
	}
}

// TODO: Warn if home config is group/world readable?

var config = extend(
	read(__dirname, '../' + configFn),
	read(homeDir, homeSubDir, configFn),
	read(projectDir, configFn)
);

subst(config, config);

module.exports = config;
