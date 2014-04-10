/*jshint node:true, strict:false*/

var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var Processor = require('../processor');

module.exports = _.extend(new Processor(), {
	process: function(log) {
		log.info('TODO: Replace this by an actual processor');
		return Promise.resolve();
	}
});
