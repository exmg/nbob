/*jshint node:true, strict:false*/

var files = require('../files');

module.exports = function(config, log, inputFileMap) {
	return files.write('dist').then(function() {
		// We did not modify input files (build and dist directories are excluded)
		return inputFileMap;
	});
};
