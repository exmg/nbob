/*jshint node:true, strict:false*/

// TODO: Show feedback on invalid commands/options
// TODO: Show help if requested
// TODO: Use update-notifier to encourage use of latest version of nbob

var util = require('util');
var log = require('npmlog');
var pkg = require('../package.json');
var args = require('./args');
var config = require('./config');

log.info('nBob v' + pkg.version);

var nbob = {
	commands: args.commands,
	options: args.options,
	config: config
};

console.log(util.inspect(nbob, { depth: null }));

module.exports = nbob;
