'use strict';

var start = Date.now();

var jshint = require('jshint').JSHINT;
var File = require('../../lib/file');
var files = require('../../lib/files');
var listFiles = require('../../lib/list-files');
var minimatches = require('../../lib/minimatches');

files.init(minimatches(listFiles('.'), [ '**/*.js' ]));

var paths = files.getPaths();
var nrReceived = 0;

new File('.jshintrc').getJSON().then(function(options) {
	files.getList(paths).map(function(file) {
		file.getText().then(function(text) {
			var path = file.path;
			console.log(jshint(text, options) ?
				path + ' [OK]' :
				path + ' [' + jshint.errors.length + ' ERRORS]'
			);

			if (++nrReceived === paths.length) {
				console.log('Took: %dms', Date.now() - start);
			}
		}).catch(function(err) {
			console.error(err);
		});
	});
});
