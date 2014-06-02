'use strict';

var util = require('util');
var _ = require('lodash');
var Processor = require('../processor');
var Batch = require('../batch');
var Graph = require('../graph');

var processor = new Processor();

function parse(text) {
	var modules = [];
	var otherLines = [];
	text.split('\n').forEach(function(line) {
		var matches = line.match(
			/^(em|playtotv)\.define\("([\w\.]+)",\[([\w\.",]*)\],function\(([\w,]*)\)\{([\w\W]*)\}\);/);
		if (matches) {
			var id = matches[2];
			var deps = matches[3].trim();
			deps = deps.length > 0 ? deps.substr(1, deps.length - 2).split(/","/) : [];
			var params = matches[4].trim();
			params = params.length > 0 ? params.split(/,/): [];
			modules.push({
				id: id,
				deps: deps,
				params: params,
				body: matches[5],
				text: text
			});
			console.error('Module: %s [%s] (%s)', id, deps.join(', '), params.join(', '));
		} else {
			otherLines.push(line);
		}
	});
	return {
		modules: modules,
		otherText: otherLines.join('\n')
	};
}

function getUndefinedDeps(modules) {
	return modules.reduce(function(undefDeps, module) {
		return undefDeps.concat(module.deps.filter(function(dep) {
			return !_.find(modules, { id: dep });
		}).map(function(dep) {
			return { id: module.id, dep: dep };
		}));
	}, []);
}

function checkUnusedDependencies(modules, log, inputPath) {
	modules.forEach(function(module) {
		var deps = module.deps;
		var params = module.params;
		if (deps.length > 0 && params.length === 0) {
			deps.forEach(function(dep) {
				// Assuming: var c = playtotv.importModules(this.dependencies);
				params.push('c.' + dep.substr(dep.lastIndexOf('.') + 1));
			});
		} else if (params.length !== deps.length) {
			// TODO: reject
			log.warn(
				'%s: %s: Number of factory parameters (%d) does not equal number of dependencies (%d)',
				inputPath, module.id, params.length, deps.length
			);
		}
		params.forEach(function(param, i) {
			// TODO: Improve this check, it matches too much
			if (!module.body.match(new RegExp('\\W' + param + '\\W'))) {
				// TODO: reject
				log.warn(
					'%s: %s: Dependency %s is not used',
					inputPath, module.id, deps[i]
				);
			}
		});
	});
}

function pruneUnusedModules(exports, modules) {
	if (exports.length === 0) {
		return modules;
	}

	exports.forEach(function markUsed(id) {
		var module = _.find(modules, { id: id });
		if (!module.used) {
			module.used = true;
			module.deps.forEach(markUsed);
		}
	});

	return modules.filter(function(module) {
		return module.used;
	});
}

function createDependencyGraph(modules) {
	var graph = new Graph();
	modules.forEach(function(module) {
		var id = module.id;
		var deps = module.deps;
		var fromIndex = graph.getIndex(id);
		if (fromIndex === -1) {
			fromIndex = graph.addNode(id);
		}
		deps.forEach(function(dep) {
			var toIndex = graph.getIndex(dep);
			if (toIndex === -1) {
				toIndex = graph.addNode(dep);
			}
			graph.connect(fromIndex, toIndex);
		});
	});
	return graph;
}

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ inputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var log = this.log;
	var input = inputs[0];
	var output = outputs[0];
	var inputPath = input.path;

	var parsed = parse(input.data);
	var modules = parsed.modules;

	var undefDeps = getUndefinedDeps(modules);
	if (undefDeps.length > 0) {
		var undefDepsStr = undefDeps.map(function(rec) {
			return util.format('%s (in %s)', rec.dep, rec.id);
		}).join(', ');
		return output.reject(new Error(util.format('%s: Undefined dependencies: %s', inputPath, undefDepsStr)));
	}

	checkUnusedDependencies(modules, log, inputPath);

	var totalNrModules = modules.length;
	modules = pruneUnusedModules(this.config.exports, modules);
	if (modules.length < totalNrModules) {
		log.ok('%s: Pruned %d unused modules out of %d', inputPath, totalNrModules - modules.length, totalNrModules);
	}

	var graph = createDependencyGraph(modules);
	// TODO: optionally output full graph in graphviz format?

	// Order modules according to graph
	var orderedModules = [];
	var leaf;
	while ((leaf = graph.firstLeaf()) !== -1) {
		orderedModules.push(_.find(modules, { id: graph.getId(leaf) }));
		graph.removeNode(leaf);
	}

	// Reject on circular dependencies
	if (graph.nodes.length > 0) {
		return output.reject(new Error(util.format('%s: Circular dependencies, see: %s', inputPath, graph.chart())));
	}

	output.resolve(parsed.otherText + _.pluck(orderedModules, 'text').join('\n'));
};

module.exports = processor;
