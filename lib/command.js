/*jshint node:true, strict:false*/

function Command(name, desc, action) {
	this.name = name;
	this.desc = desc;
	this.action = action;
}

module.exports = Command;
