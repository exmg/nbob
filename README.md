nBob
====
nbob or nBob, short for Node Bob, is Ex Machina's frontend build tool.

# History
It is based on the Rhino JS based build tool Bob which has been developed in house over the last years.
We are looking to improve performance and be able to more easily use the various third party tools we depend on by moving over to Node JS.
We will also be drawing inspiration from other great tools out there like brunch, grunt, yeoman and mimosa to further extend and improve our functionality.

# Roadmap
1. Port most command line functionality of Bob to nBob
2. Add support for a build server that watches for file changes
3. ..
4. Profit!

# Usage
This section will describe the command line options. For now here is the help of the old Bob:

	Usage: bob [--debug] [dir] [-h || --help] <command(s)>

	Options:
	--debug :: use Rhino debugger instead of normal shell
	[dir] :: use specified directory (defaults to current directory)
	-h || --help :: show usage instructions

	Commands (in execution order):
	-b || --build :: shortcut for all commands marked with *
	-c || --clean* :: delete build and dist
	-u || --update :: update specified lib or all libs
	-g || --api* :: generate and add api src files to srcs as configured
	-f || --files :: custom build with specified srcs (comma separated arg string)
	-a || --analyze* :: check definitions, dependencies, conventions and jshint
	-t || --test* :: run specified unit test or all tests from test
	-v || --version :: change version to specified string
	-j || --jsdoc :: generate doc with comma separated file args or libs and srcs
	-m || --compile* :: concatenate *.js from libs and srcs and minify it
	-s || --less* :: compile configured or *.less to *.css in build
	-l || --localize* :: localize configured or *-l10n* to build
	-p || --copy* :: copy all but build excludes into build
	-e || --templates* :: package build/templates subdirectories into json files
	-i || --dist* :: copy all but dist excludes from build to dist
	-n || --manifest* :: create app cache manifest(s) from dist files
	-d || --deploy :: deploy dist to s3 bucket defined by config

# Config
Configuration consists of conventional defaults defined in [bob-config.json](bob-config.json) which can be extended and overridden by `~/.bob/bob-config.json` and `<project>/bob-config.json`.

*TODO: Document configuration options and defaults*

# License
Copyright (c) 2013 [Ex Machina](http://exmg.tv).

Released under MIT License. Enjoy and Fork!

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
