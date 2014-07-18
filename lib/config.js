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

function getValue(obj, path) {
	var i = path.indexOf('.');
	var head = path.substr(0, i);
	var tail = path.substr(i + 1);
	return head ? getValue(obj[head], tail) : obj[path];
}

function setValue(obj, path, value) {
	var i = path.indexOf('.');
	var head = path.substr(0, i);
	var tail = path.substr(i + 1);
	if (head) {
		setValue(obj[head], tail, value);
	} else {
		obj[path] = value;
	}
}

function subst(subj, obj) {
	if (_.isObject(subj)) {
		// Recurse
		_.each(subj, function(value, key) {
			subj[key] = subst(value, obj);
		});
		return subj;
	} else if (_.isString(subj)) {
		// Substitute by object value
		if (/^\{\{\> (.+?)}}$/.test(subj)) {
			return getValue(obj, RegExp.$1);
		}
		// Substitute by string
		return subj.replace(/\{\{(.+?)}}/g, function(match, path) {
			return getValue(obj, path);
		});
	} else { // number, boolean, ..
		return subj;
	}
}

function extend() {
	var args = _.toArray(arguments);
	args.push(function(a, b) {
		if (_.isArray(a)) {
			b = _.isArray(b) ? b : [ b ];
			// If first item equals !! then override array instead of extending it
			return b[0] === '!!' ? b.slice(1) : a.concat(b);
		}
		return _.isObject(a) && _.isObject(b) ? extend(a, b) : b;
	});
	return _.extend.apply(_, args);
}

function read(fn, optional) {
	try {
		return JSON.parse(fs.readFileSync(fn));
	} catch (e) {
		if (optional) {
			return {};
		}
		log.help('Error reading and parsing file: %s\n  %s', fn, e.message);
	}
}

// TODO: Warn if home config is group/world readable?

var config = extend(
	read(path.join(__dirname, '../' + configFn)),
	read(path.join(homeDir, homeSubDir, configFn), true),
	read(path.join(projectDir, configFn))
);

var env = options.env;
if (env) {
	var envConfigMap = config.envConfigMap;
	var envConfig = envConfigMap[env];
	if (!envConfig) {
		log.help('Invalid option value: env=\'%s\', valid values: %s', env, Object.keys(envConfigMap));
	}
	extend(config, envConfig);
}

if (/(.*)=(.*)/.test(options.option)) {
	setValue(config, RegExp.$1, RegExp.$2);
}

subst(config, config);

module.exports = config;
