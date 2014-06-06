'use strict';

var crypto = require('crypto');

module.exports = function(datas, inputEncoding) {
	datas = datas instanceof Array ? datas : [ datas ];
	var sum = crypto.createHash('md5');
	datas.forEach(function(data) {
		sum.update(data, inputEncoding);
	});
	return sum.digest('hex');
};
