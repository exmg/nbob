'use strict';

var util = require('util');
var AWS = require('aws-sdk');
var _ = require('lodash');
var mime = require('mime');
var pako = require('pako');
var md5hex = require('../md5hex');
var minimatches = require('../minimatches');
var Promise = require('../promise');
var promisify = require('../promisify');

function bytes(nr) {
	return (nr / 1024).toFixed(1) + 'K';
}

function percentage(a, b) {
	return (b ? (a * 100 / b).toFixed(1) : '∞') + '%';
}

function awsPromisifyListFn(fn, thisArg, key) {
	var promisified = promisify(fn, thisArg);
	return function list(params) {
		return promisified.call(thisArg, params).then(function(data) {
			var items = data[key];
			return !data.IsTruncated ? items : list(_.extend(params, {
				Marker: data.NextMarker
			})).then(function(recursedItems) {
				return items.concat(recursedItems);
			});
		});
	};
}

function myCF() {
	var cf = new AWS.CloudFront();
	return {
		listDistributions: awsPromisifyListFn(cf.listDistributions, cf, 'Items'),
		listInvalidations: awsPromisifyListFn(cf.listInvalidations, cf, 'Items'),
		createInvalidation: promisify(cf.createInvalidation, cf)
	};
}

function myS3(region, bucketName) {
	var s3 = new AWS.S3({
		region: region,
		params: { Bucket: bucketName }
	});
	return {
		listObjects: awsPromisifyListFn(s3.listObjects, s3, 'Contents'),
		putObject: promisify(s3.putObject, s3),
		copyObject: promisify(s3.copyObject, s3),
		deleteObject: promisify(s3.deleteObject, s3)
	};
}

function getDistsPromise(cf, bucketName) {
	return cf.listDistributions().then(function(dists) {
		var distPromises = dists.filter(function(dist) {
			return dist.Origins.Items.some(function(origin) {
				return origin.DomainName === bucketName + '.s3.amazonaws.com';
			});
		}).map(function(dist) {
			return cf.listInvalidations({ DistributionId: dist.Id }).then(function(invalidations) {
				dist.invalidationStats = invalidations.reduce(function(stats, invalidation) {
					stats[invalidation.Status] = (stats[invalidation.Status] || 0) + 1;
					return stats;
				}, { InProgress: 0, Completed: 0, Total: invalidations.length });
				return dist;
			});
		});
		return Promise.all(distPromises);
	});
}

function getInputsPromise(inputFiles, config) {
	var gzipThreshold = config.gzipThreshold;
	var cacheControlRules = config.cacheControlRules;
	var defaultCacheControl = config.cacheControl;

	var inputPromises = inputFiles.map(function(file) {
		var path = file.path;

		var type = mime.lookup(path);
		var charset = mime.charsets.lookup(type);
		type = charset ? type + '; charset=' + charset : type;

		var cacheControl = cacheControlRules.reduce(function(control, rule) {
			return minimatches(path, rule.files) ? rule.control : control;
		}, defaultCacheControl);

		var input = { path: path, type: type, cacheControl: cacheControl };

		return file.getBuffer().then(function(buffer) {
			var compressible = /json|text|xml|javascript/.test(type);
			if (compressible && buffer.length > gzipThreshold) {
				// Note: not using Node's zlib module because it generates inconsistent output on OS X and Windows
				// That would result in different MD5's and needless reported changes and uploads
				var compressed = new Buffer(pako.gzip(buffer, { level: 9 }));
				return _.extend(input, {
					buffer: compressed,
					originalSize: buffer.length,
					encoding: 'gzip',
					md5: md5hex(compressed)
				});
			}

			return _.extend(input, {
				buffer: buffer,
				md5: md5hex(buffer)
			});
		});
	});
	return Promise.all(inputPromises);
}

function getBuildDir(paths) {
	var buildPath = _.find(paths, function(path) {
		return path.indexOf('build-') === 0;
	});
	return buildPath ? buildPath.substr(0, buildPath.indexOf('/')) : null;
}

function analyze(inputs, objects, keepPatterns, force) {
	var analysis = {
		oldBuildDir: getBuildDir(_.pluck(objects, 'Key')),
		newBuildDir: getBuildDir(_.pluck(inputs, 'path')),
		copied: [],
		added: [],
		changed: [],
		removed: [],
		kept: [],
		unchanged: []
	};

	inputs.forEach(function(input) {
		var key = input.path;
		var obj = _.find(objects, { Key: key });
		if (!obj) {
			var src = _.find(objects, function(srcObj) {
				return srcObj !== obj && srcObj.ETag === '"' + input.md5 + '"';
			});
			if (src) {
				// Note: Though changes can be copies as well I do not consider them as such to prevent complications
				analysis.copied.push({ srcKey: src.Key, dstKey: key });
			} else {
				analysis.added.push(key);
			}
		} else if (force || obj.ETag !== '"' + input.md5 + '"') {
			analysis.changed.push(key);
		} else {
			analysis.unchanged.push(key);
		}
	});

	objects.forEach(function(obj) {
		var key = obj.Key;
		if (minimatches(key, keepPatterns)) {
			analysis.kept.push(key);
		} else if (!_.find(inputs, { path: key })) {
			analysis.removed.push(key);
		}
	});

	return analysis;
}

function showAnalysis(log, analysis) {
	var copied = analysis.copied.slice(0);
	var added = analysis.added.slice(0);
	var changed = analysis.changed.slice(0);
	var removed = analysis.removed.slice(0);
	var oldBuildDir = analysis.oldBuildDir;
	var newBuildDir = analysis.newBuildDir;
	var buildChanged = [];

	// Reduce number of logged differences when build-xxx directory is renamed to build-yyy
	// Note: we leave the original analysis alone since that will still be used for AWS processing
	if (oldBuildDir && newBuildDir && (oldBuildDir !== newBuildDir)) {
		log.info('%s => %s', oldBuildDir, newBuildDir);

		removed.filter(function(removedKey) {
			return removedKey.indexOf(oldBuildDir) === 0;
		}).forEach(function(oldBuildKey) {
			var newBuildKey = oldBuildKey.replace(oldBuildDir, newBuildDir);
			var removedIndex = removed.indexOf(oldBuildKey);

			// Replace "Removed: build-old/foo" and "Added: build-new/foo" by "Changed: build-new/foo"
			var addedIndex = added.indexOf(newBuildKey);
			if (addedIndex >= 0) {
				added.splice(addedIndex, 1);
				removed.splice(removedIndex, 1);
				buildChanged.push(newBuildKey);
			}

			// Silence "Copy: build-old/foo => build-new/foo" and "Removed: build-old/foo" (Unchanged)
			var copiedIndex = _.findIndex(copied, function(record) {
				return record.srcKey === oldBuildKey && record.dstKey === newBuildKey;
			});
			if (copiedIndex >= 0) {
				copied.splice(copiedIndex, 1);
				removed.splice(removedIndex, 1);
			}
		});
	}

	buildChanged.forEach(function(key) {
		log.info('Changed: %s', key);
	});

	copied.forEach(function(record) {
		log.info('Copied: %s => %s', record.srcKey, record.dstKey);
	});

	added.forEach(function(key) {
		log.info('Added: %s', key);
	});

	changed.forEach(function(key) {
		log.info('Changed: %s', key);
	});

	removed.forEach(function(key) {
		log.info('Removed: %s', key);
	});

	analysis.kept.forEach(function(key) {
		log.info('Kept: %s', key);
	});

	log.info('Files copied: %d, added: %d, changed: %d, removed: %d, kept: %d, unchanged: %d',
		copied.length, added.length, changed.length + buildChanged.length, removed.length,
		analysis.kept.length, analysis.unchanged.length
	);
}

function getCommonParams(input) {
	var encoding = input.encoding;
	var params = {
		ACL: 'public-read',
		CacheControl: input.cacheControl,
		ContentType: input.type,
		Key: input.path
	};
	if (encoding) {
		params.ContentEncoding = encoding;
	}
	return params;
}

function getInputSizeStr(input) {
	var encoding = input.encoding;
	var originalSize = input.originalSize;
	var outputSize = input.buffer.length;
	return !encoding ? bytes(outputSize) : util.format('%s %s %s of %s',
		bytes(outputSize), encoding, percentage(outputSize, originalSize), bytes(originalSize)
	);
}

module.exports = function(config, log, inputFiles) {
	var region = config.region;
	var bucketName = config.bucketName;

	var s3 = myS3(region, bucketName);
	var cf = myCF();

	return Promise.apply([
		getDistsPromise(cf, bucketName),
		getInputsPromise(inputFiles, config),
		s3.listObjects()
	], function(dists, inputs, objects) {
		log.info('[[ %s ]]', bucketName.toUpperCase());
		log.info('S3 URL: http://%s.s3-website-%s.amazonaws.com', bucketName, region);

		dists.forEach(function(dist) {
			log.info('CF URL: http://%s', dist.DomainName);
			dist.Aliases.Items.forEach(function(alias) {
				log.info('CF Alias: http://%s', alias);
			});
			var invalidationStats = dist.invalidationStats;
			log.info('CF Invalidations: InProgress: %d, Completed: %d, Total: %d',
				invalidationStats.InProgress, invalidationStats.Completed, invalidationStats.Total);
		});

		if (dists.length === 0) {
			log.info('No CloudFront distributions found using this bucket as origin.');
		}

		var analysis = analyze(inputs, objects, config.keep, config.force);

		showAnalysis(log, analysis);

		var nrMutations = [ 'copied', 'added', 'changed', 'removed' ].reduce(function(sum, type) {
			return sum + analysis[type].length;
		}, 0);
		if (nrMutations === 0) {
			log.info('Nothing to do.');
			return;
		}

		return log.question('Synchronize ' + bucketName + ' to S3? (y/n)').then(function(answer) {
			if (answer !== 'y') {
				log.info('Aborting...');
				return;
			}

			var putPromises = analysis.added.concat(analysis.changed).map(function(key) {
				var input = _.find(inputs, { path: key });
				var params = _.extend(getCommonParams(input), {
					Body: input.buffer
				});
				return s3.putObject(params).then(function() {
					log.ok('Put: %s (%s)', key, getInputSizeStr(input));
				});
			});

			var copyPromises = analysis.copied.map(function(record) {
				var input = _.find(inputs, { path: record.dstKey });
				var params = _.extend(getCommonParams(input), {
					Bucket: bucketName,
					CopySource: encodeURIComponent(bucketName + '/' + record.srcKey)
				});
				return s3.copyObject(params).then(function() {
					log.ok('Copied: %s => %s', record.srcKey, record.dstKey);
				});
			});

			// Wait for copying to finish before deleting to prevent deletion of a copy source (e.g: on file move)
			var deletedPromise = Promise.all(copyPromises).then(function() {
				var deletePromises = analysis.removed.map(function(key) {
					return s3.deleteObject({ Key: key }).then(function() {
						log.ok('Deleted: %s', key);
					});
				});
				return Promise.all(deletePromises);
			});

			return Promise.all(putPromises.concat(deletedPromise)).then(function() {
				var changedKeys = analysis.changed;

				if (changedKeys.length === 0) {
					log.info('Nothing to invalidate.');
					return;
				}

				if (dists.length === 0) {
					log.info('Nowhere to invalidate.');
					return;
				}

				return log.question('Invalidate ' + bucketName + ' on CloudFront? (y/n)').then(function(answer) {
					if (answer !== 'y') {
						log.info('Aborting...');
						return;
					}

					var invalidationPromises = dists.map(function(dist) {
						return cf.createInvalidation({
							DistributionId: dist.Id,
							InvalidationBatch: {
								CallerReference: '' + new Date(),
								Paths: {
									Quantity: changedKeys.length,
									Items: changedKeys.map(function(key) {
										return '/' + key;
									})
								}
							}
						}).then(function() {
							log.ok('Invalidated: %s', dist.Aliases.Items.join(', '));
						});
					});

					return Promise.all(invalidationPromises);
				});
			});
		});
	}).then(function() {
		// We did not modify input files
		return inputFiles;
	});
};
