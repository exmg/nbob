/*jshint node:true, strict:false*/

var _ = require('lodash');
var Promise = require('./promise');

module.exports = function(asyncFn, thisArg) {
	return function() {
		var args = _.toArray(arguments);
		return new Promise(function(resolve, reject) {
			args.push(function(err, val) {
				if (err !== null) {
					reject(err);
				}
				resolve(val);
			});
			asyncFn.apply(thisArg, args);
		});
	};
};
