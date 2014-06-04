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
	var sourceMapLine;
	text.split('\n').forEach(function(line) {
		var matches = line.match(
			/^(em|playtotv)\.define\("([\w\.]+)",\[([\w\.",]*)\],function\(([\w,]*)\)\{([\w\W]*)\}\);$/);
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
				text: line
			});
		} else if (/^\/\/# sourceMappingURL=\S+$/.test(line)) {
			sourceMapLine = line;
		} else {
			otherLines.push(line);
		}
	});
	return {
		otherText: otherLines.join('\n'),
		modules: modules,
		sourceMapLine: sourceMapLine
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

function getDependencyErrors(modules) {
	return modules.reduce(function(depErrors, module) {
		var deps = module.deps;
		var params = module.params;
		if (deps.length > 0 && params.length === 0) {
			deps.forEach(function(dep) {
				// Assuming: var c = playtotv.importModules(this.dependencies);
				params.push('[a-z].' + dep.substr(dep.lastIndexOf('.') + 1));
			});
		} else if (params.length !== deps.length) {
			depErrors.push({
				id: module.id,
				error: util.format('Nr of params: %d <> Nr of deps: %d', params.length, deps.length)
			});
		}
		params.forEach(function(param, i) {
			// TODO: Improve this check, it matches too much
			if (!module.body.match(new RegExp('\\W' + param + '\\W'))) {
				depErrors.push({
					id: module.id,
					error: util.format('Unused: %s (%s)', deps[i], param)
				});
			}
		});
		return depErrors;
	}, []);
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
		// TODO: Accept source map input and adapt it while pruning and ordering
		return new Batch([ inputPath ], [ inputPath, inputPath + '.gv' ]);
	});
};

processor.process = function(inputs, outputs) {
	/*jshint maxstatements:100, maxcomplexity:100*/
	// TODO: Split this function up to reduce complexity and number of statements to a more acceptable range

	var log = this.log;
	var input = inputs[0];
	var output = outputs[0];
	var gvOutput = outputs[1];
	var inputPath = input.path;

	var parsed = parse(input.data);
	var modules = parsed.modules;

	var undefDeps = getUndefinedDeps(modules);
	if (undefDeps.length > 0) {
		var undefDepsStr = undefDeps.map(function(rec) {
			return util.format('%s [%s]', rec.dep, rec.id);
		}).join('\n');
		return output.reject(new Error(util.format('%s: Undefined dependencies: %s', inputPath, undefDepsStr)));
	}

	var depErrors = getDependencyErrors(modules);
	if (depErrors.length > 0) {
		var depErrorsStr = depErrors.map(function(rec) {
			return util.format('%s [%s]', rec.error, rec.id);
		}).join('\n');
		return output.reject(new Error(util.format('%s: Dependency errors: %s', inputPath, depErrorsStr)));
	}

	var totalNrModules = modules.length;
	modules = pruneUnusedModules(this.config.exports, modules);
	if (modules.length < totalNrModules) {
		log.ok('%s: Pruned %d unused modules out of %d', inputPath, totalNrModules - modules.length, totalNrModules);
	}

	var graph = createDependencyGraph(modules);
	gvOutput.resolve(graph.graphviz());

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

	var text = '';
	if (parsed.otherText) {
		text += parsed.otherText + '\n';
	}
	if (orderedModules.length > 0) {
		text += _.pluck(orderedModules, 'text').join('\n') + '\n';
	}
	if (parsed.sourceMapLine) {
		text += parsed.sourceMapLine + '\n';
	}
	output.resolve(text);
};

module.exports = processor;
