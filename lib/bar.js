'use strict';

// TODO: Clean up this mess and/or just create my own custom progress bar

var ProgressBar = require('progress');

var bar, counterMap, totalMap, active;

function init() {
	bar = new ProgressBar('[:bar] :percent :etas (:names)', { total: 0, incomplete: ' ' });
	counterMap = {};
	totalMap = {};
	active = false;
}

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

function reset() {
	clear();
	init();
}

function setTotal(total) {
	bar.total = total;
	// TODO: Cap bar width based on terminal width?
	bar.width = Math.min(bar.total, 20);
}

function add(name, nr) {
	nr = nr || 1;
	var counter = counterMap[name] || 0;
	counterMap[name] = counter + nr;
	var nameTotal = totalMap[name] || 0;
	totalMap[name] = nameTotal + nr;
	setTotal(bar.total + nr);
	if (!bar.start) {
		bar.start = new Date();
	}
	render();
}

function finish(name, nr) {
	nr = nr || 1;
	bar.curr += nr;
	var count = counterMap[name] - nr;
	if (count) {
		counterMap[name] = count;
	} else {
		var nameTotal = totalMap[name];
		bar.curr -= nameTotal;
		setTotal(bar.total - nameTotal);
		delete totalMap[name];
		delete counterMap[name];
	}
	if (bar.total) {
		render();
	} else {
		reset();
	}
}

init();

module.exports = {
	isActive: isActive,
	render: render,
	clear: clear,
	add: add,
	finish: finish,
	reset: reset
};
