'use strict';

var start = Date.now();

var childProcess = require('child_process');
var os = require('os');
var _ = require('lodash');
var Promise = require('../../lib/promise');
var File = require('../../lib/file');
var files = require('../../lib/files');
var listFiles = require('../../lib/list-files');
var minimatches = require('../../lib/minimatches');

var numCPUs = os.cpus().length;
var children = [];
var lastPromise = Promise.resolve();
var childResolve;

for (var i = 0; i < numCPUs; i++) {
	children.push(childProcess.fork(__dirname + '/child.js'));
}

// TODO: Work out a prettier way of queueing
function getChild() {
	var child = _.find(children, { isBusy: false });
	if (child) {
		child.isBusy = true;
		return Promise.resolve(child);
	}

	lastPromise = lastPromise.then(function() {
		return new Promise(function(resolve) {
			childResolve = function(child) {
				childResolve = null;
				child.isBusy = true;
				resolve(child);
			};
		});
	});
	return lastPromise;
}

children.forEach(function(child) {
	child.isBusy = false;
});

files.init(minimatches(listFiles('.'), [ '**/*.js' ]));

var paths = files.getPaths();

new File('.jshintrc').getJSON().then(function(options) {
	files.getList(paths).map(function(file) {
		file.getText().then(function(text) {
			getChild().then(function(child) {
				// console.log('> #%d: %s', children.indexOf(child), file.path);
				child.send({ path: file.path, options: options, text: text });
			});
		});
	});
});

var nrReceived = 0;
children.forEach(function(child, i) {
	child.on('message', function(message) {
		console.log('#%d: %s', i, message);

		child.isBusy = false;
		if (childResolve) {
			childResolve(child);
		}

		if (++nrReceived === paths.length) {
			console.log('Took: %dms', Date.now() - start);
			children.forEach(function(child) {
				child.send('goodbye');
			});
		}
	});
});
