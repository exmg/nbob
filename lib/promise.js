'use strict';

var Promise = require('es6-promise').Promise;

// Apply array of resolved promise values to specified function.
// This facilitates using the results of a small number of promises that are being processed at the same time.
Promise.apply = function(promises, fn, thisArg) {
	return Promise.all(promises).then(function(results) {
		return fn.apply(thisArg, results);
	});
};

module.exports = Promise;
