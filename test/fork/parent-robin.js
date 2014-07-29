'use strict';

var start = Date.now();

var childProcess = require('child_process');
var os = require('os');
var File = require('../../lib/file');
var files = require('../../lib/files');
var listFiles = require('../../lib/list-files');
var minimatches = require('../../lib/minimatches');

var numCPUs = os.cpus().length;
var children = [];
var roundRobinIndex = 0;

for (var i = 0; i < numCPUs; i++) {
	children.push(childProcess.fork(__dirname + '/child.js'));
}

files.init(minimatches(listFiles('.'), [ '**/*.js' ]));

var paths = files.getPaths();

new File('.jshintrc').getJSON().then(function(options) {
	files.getList(paths).map(function(file) {
		file.getText().then(function(text) {
			var child = children[roundRobinIndex++ % children.length];
			child.send({ path: file.path, options: options, text: text });
		}).catch(function(err) {
			console.error(err);
		});
	});
});

var nrReceived = 0;
children.forEach(function(child, i) {
	child.on('message', function(message) {
		console.log('#%d: %s', i, message);

		if (++nrReceived === paths.length) {
			console.log('Took: %dms', Date.now() - start);
			children.forEach(function(child) {
				child.send('goodbye');
			});
		}
	});
});
