'use strict';

var Handlebars = require('handlebars');

Handlebars.registerHelper('with', function(context, options) {
	return options.fn(context);
});

Handlebars.registerHelper('if-equal', function(value, options) {
	if (value === options.hash.to) {
		return options.fn(this);
	} else {
		return options.inverse(this);
	}
});

Handlebars.registerHelper('unless-equal', function(value, options) {
	if (value !== options.hash.to) {
		return options.fn(this);
	} else {
		return options.inverse(this);
	}
});

Handlebars.registerHelper('join', function(list, options) {
	var separator = options.hash.separator || ', ';
	separator = separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
	return list.map(function(item) {
		return options.fn(item);
	}).join(separator);
});

Handlebars.registerHelper('replace', function(options) {
	var hash = options.hash;
	var regexp = new RegExp(hash.regexp, hash.flags || '');
	var by = hash.by || '';
	by = by.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
	return options.fn(this).replace(regexp, by);
});

Handlebars.registerHelper('partial', function(name, options) {
	Handlebars.registerPartial(name, options.fn);
});

module.exports = Handlebars;
