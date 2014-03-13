/*jshint node:true, strict:false*/

module.exports = [ {
	name: 'help',
	desc: 'Show information about usage',
	bool: true
}, {
	name: 'dir',
	desc: 'Use specified working directory instead of current directory',
	def: process.cwd()
}, {
	name: 'env',
	desc: 'Activate specified environment config overrides'
}, {
	name: 'verbose',
	desc: 'Show debug log messages',
	bool: true
} ];
