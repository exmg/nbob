<img align="right" height="200" src="https://raw.githubusercontent.com/exmg/nbob/master/bob.jpg" title="Bob the builder" />

nBob
====
[Ex Machina](http://exmg.tv)'s second generation frontend build tool, based on Node and V8.

nBob is designed and built with based on the current values:

* DRY (Do not Repeat Yourself)
  * Minimal project configuration
  * Efficient Processor plugin API
* Performance
  * Intermediate build artifact cache enables incremental builds
  * Processor Batches can be distributed across multiple CPU cores
* Predictability
  * Develop and test with exact same artifacts as in production (source maps are used for debugging)
  * Build on request (e.g: browser reload), not on save (optionally you can use live reload)

# Installation
Start by [installing Node](http://nodejs.org) if you don't have that yet.

Then install nBob through NPM; open a terminal or command prompt and then type the following on your command line:

On OS X and Linux:

	$ sudo npm install -g nbob

On Windows:

	> npm install -g nbob

Likewise you can later update nbob by substituting 'install' by 'update'.

# Usage
Running nbob in your terminal with invalid or incomplete arguments will result in it's help being displayed:

	Usage: nbob [options] <commands>

	Commands:
	  init
	    nbob        *Create nbob-config.json
	    hint        *Create .jshintrc and .jshintignore
	    aws         *Create ~/.aws/credentials
	  update
	    api         Update EM api directory
	    doc         *Update doc directory
	    l10n        Update l10n directory
	    lib         *Update lib directory
	  clean         Remove build and dist directories
	  make
	    include     *Include files
	    l10n        Localize files
	    images
	      png       *Compress PNG images
	    html
	      minify    Minify HTML
	      templates Concatenate templates
	    css
	      less      Compile LESS to CSS
	      sass      *Compile SASS to CSS
	    js
	      hint      Analyze JS with JSHint
	      es6       *Transpile ES6 to ES5
	      minify    Minify JS
	      concat    Concatenate JS files
	      amd       Optimize EM AMD modules
	      test      *Run tests
	    substitute
	      path      Substitute in file paths
	      text      Substitute in text files
	    dist        Write files to dist directory
	  server        Make and host files
	  deploy        Make and copy to S3

	Options:
	  -d, --dir     Use specified working directory (default: <current working directory>)
	  -e, --env     Use specified environment config overrides
	  -l, --level   Use specified log level (spam/debug/info/ok/warn/error/silent) (default: info)
	  -o, --option  Override specified option in config (e.g: -o server.port=8081)
	  -r, --reload  *Run live-reload server on dist directory
	  -s, --sync    *Run browser-sync server on dist directory

	*) Not yet implemented

	Note: Like options, commands can be abbreviated, per example:
	Full length:    nbob --env=staging update:api deploy
	Abbreviated:    nbob -e staging u:a d

# Config
Configuration consists of conventional defaults defined in [nbob-config.json](nbob-config.json) which can be extended and overridden by `~/.nbob/nbob-config.json` and `<project>/nbob-config.json`.

*TODO: Document project config*
*TODO: Document config substitution syntax*
*TODO: Document --env and --option config overriding*

# Processors
For now, please see processor source files for more information on how they work and [package.json](package.json) for links to third party dependencies.

*TODO: Add support for showing processor help (e.g: nbob -h make:js:minify) and copy output here for convenience*

## Pending
Here are some links to third party tools that might be used for pending processor implementations:

* Documentation
  * [jsdoc3](https://github.com/jsdoc3/jsdoc)
  * [yuidoc](http://yui.github.io/yuidoc)
  * [docco](http://jashkenas.github.io/docco)
  * [doxx](https://github.com/FGRibreau/doxx)
* Image compression
  * [node-tinypng](https://github.com/manuelvanrijn/node-tinypng)
  * [node-pngquant-native](https://github.com/xiangshouding/node-pngquant-native)
* CSS pre-processing
  * [sass](https://github.com/andrew/node-sass)
* ES6 transpiling
  * [traceur](https://github.com/google/traceur-compiler)
  * Or something smaller/simpler for basics features like: Class, Module, Promise
* JS Testing
  * [mocha](http://visionmedia.github.io/mocha)
* Live Reload
  * [tiny-lr](https://github.com/mklabs/tiny-lr)
* Browser Sync
  * [browser-sync](https://github.com/shakyshane/browser-sync)

# Conventions

*TODO: Document conventions*
*TODO: Show or link to some examples*

# License
Copyright (c) 2014 [Ex Machina](http://exmg.tv).

Released under MIT License. Enjoy and Fork!

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
