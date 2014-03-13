/*jshint node:true, strict:false*/

var Promise = require('es6-promise').Promise;

module.exports = function(asyncFn, thisArg) {
	return function() {
		return new Promise(function(resolve, reject) {
			var args = Array.prototype.slice.call(arguments);
			args.push(function(err, val) {
				if (err !== null) {
					return reject(err);
				}
				return resolve(val);
			});
			asyncFn.apply(thisArg || {}, args);
		});
	};
};
