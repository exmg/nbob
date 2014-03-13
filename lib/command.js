/*jshint node:true, strict:false*/

function Command(name, description, action) {
	this.name = name;
	this.description = description;
	this.action = action;
}

module.exports = Command;
