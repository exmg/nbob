'use strict';

var Promise = require('es6-promise').Promise;

// Apply array of resolved promise values to specified function.
// This facilitates using the results of a small number of promises that are being processed at the same time.
Promise.apply = function(promises, fn, thisArg) {
	return Promise.all(promises).then(function(results) {
		return fn.apply(thisArg, results);
	});
};

Promise.prototype.finally = function(callback) {
	return this.then(function(value) {
		return Promise.resolve(callback()).then(function() {
			return value;
		});
	}, function(reason) {
		return Promise.resolve(callback()).then(function() {
			throw reason;
		});
	});
};

module.exports = Promise;
