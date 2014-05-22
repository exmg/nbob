'use strict';

// var _ = require('lodash');
var ProgressBar = require('progress');

var barFormat = '[:bar] :percent :etas (:names)';
var bar = new ProgressBar(barFormat, { total: 0, incomplete: ' ' });
var counterMap = {};
var active = false;

function isActive() {
	return active;
}

function render() {
	bar.render({ names: Object.keys(counterMap).join(', ') });
	active = true;
}

function clear() {
	if (active) {
		active = false;
		bar.stream.clearLine();
		bar.stream.cursorTo(0);
		bar.lastDraw = null;
	}
}

function add(name, nr) {
	nr = nr || 1;
	var counter = counterMap[name] || 0;
	counterMap[name] = counter + nr;
	bar.total += nr;
	// TODO: Cap bar width based on terminal width?
	bar.width = Math.min(bar.total, 40);
	if (!bar.start) {
		bar.start = new Date();
	}
	render();
}

function finish(name, nr) {
	nr = nr || 1;
	var count = counterMap[name] - nr;
	if (count) {
		counterMap[name] = count;
	} else {
		delete counterMap[name];
	}
	bar.curr += nr;
	render();
}

// End on a clean line after progress bar
process.on('exit', function() {
	if (active) {
		bar.stream.write('\n');
	}
});

module.exports = {
	isActive: isActive,
	render: render,
	clear: clear,
	add: add,
	finish: finish
};
