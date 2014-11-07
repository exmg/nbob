'use strict';

function Graph() {
	this.nodes = [];
	this.edges = [ [] ];
}

var proto = Graph.prototype;

proto.getIndex = function(id) {
	return this.nodes.indexOf(id);
};

proto.getId = function(index) {
	return this.nodes[index];
};

proto.addNode = function(id) {
	var index = this.getIndex(id);
	if (index >= 0) {
		return index;
	}

	index = this.nodes.length;
	this.nodes.push(id);

	// Add column to each row in edges matrix
	this.edges.forEach(function(row) {
		row.push(false);
	});

	// Add row to edges matrix
	var newRow = new Array(this.nodes.length);
	for (var i = 0; i < newRow.length; i++) {
		newRow[i] = false;
	}
	this.edges.push(newRow);

	return index;
};

proto.removeNode = function(index) {
	this.nodes.splice(index, 1);

	// Remove row from edges matrix
	this.edges.splice(index, 1);

	// Remove column from edges matrix
	this.edges.forEach(function(row) {
		row.splice(index, 1);
	});
};

proto.connect = function(from, to) {
	this.edges[from][to] = true;
};

proto.connectNodes = function(fromId, toId) {
	this.connect(this.addNode(fromId), this.addNode(toId));
};

proto.isLeaf = function(index) {
	return !this.edges[index].some(function(connected) {
		return connected;
	});
};

proto.firstLeaf = function() {
	for (var i = 0; i < this.nodes.length; i++) {
		if (this.isLeaf(i)) {
			return i;
		}
	}
	return -1;
};

// returns a GraphViz dot syntax representation of this graph
proto.graphviz = function() {
	var graph = this;
	return this.nodes.reduce(function(graphMemo, fromId, fromIndex) {
		fromId = fromId.replace(/\W+/g, '_'); // escape id for graphviz
		return graphMemo + graph.edges[fromIndex].reduce(function(nodeMemo, connected, toIndex) {
			if (connected) {
				var toId = graph.nodes[toIndex];
				toId = toId.replace(/\W+/g, '_'); // escape id for graphviz
				return nodeMemo + '\n\t\t' + fromId + '->' + toId + ';';
			} else {
				return nodeMemo;
			}
		}, '\n\t' + fromId + ';');
	}, 'digraph {') + '\n}';
};

proto.chart = function(layout) {
	layout = layout || 'dot'; // valid values: dot/neato/twopi/circo/fdp
	var chl = this.graphviz().replace(/\s/g, ''); // strip white spaces
	return 'https://chart.googleapis.com/chart?cht=gv:' + layout + '&chl=' + encodeURIComponent(chl);
};

module.exports = Graph;
