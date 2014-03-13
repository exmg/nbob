/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;
var promisify = require('./promisify');
var rimraf = promisify(require('rimraf'));

module.exports = function(nbob) {
	return Promise.all([
		rimraf(nbob.dir.build),
		rimraf(nbob.dir.dist)
	]);
};
