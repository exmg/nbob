nBob
====
nbob or nBob, short for Node Bob, is Ex Machina's frontend build tool.

It follows in the footsteps of our old Rhino JS based build tool Bob with much improved performance and many more and better third party tool integrations thanks to Node and it's plentiful eco-system.

Inspiration is being drawn from other great tools out there like gulp, brunch, grunt, yeoman and mimosa.

# Usage
Running nbob with invalid or incomplete arguments will result in help being displayed:

	nBob v0.1.1

	Usage: nbob [options] <commands>

	Commands:
	  init
	    nbob        *Create nbob-config.json
	    hint        *Create .jshintrc and .jshintignore
	  update
	    api         *Update EM api directory
	    doc         *Update doc directory
	    l10n        *Update l10n directory
	    lib         *Update lib directory
	    images      *Optimize image files
	  clean         Remove build and dist directories
	  make          Analyze, build and test
	  analyze
	    js
	      hint      Analyze JS with JSHint
	      style     *Check JS coding style
	    l10n        *Check localization
	  build
	    html
	      l10n      Localize files
	      minify    *Minify HTML
	      templates Concatenate templates
	    css
	      less      Compile LESS to CSS
	      sass      *Compile SASS to CSS
	      base64    *Inline images into CSS
	      minify    *Minify CSS
	    js
	      es6       *Transpile ES6 to ES5
	      concat    Concatenate JS files
	      amd       Optimize EM AMD modules
	      minify    *Minify JS
	    include     *Include files
	    substitute  *Substitute variables
	    dist        Write files to dist directory
	  test          *Run tests
	  serve         *Make and host files
	  deploy        *Copy a clean make to S3

	Options:
	  -d, --dir     Use specified working directory (default: <current working directory>)
	  -e, --env     *Use specified environment config overrides
	  -l, --level   Use specified log level (spam/debug/ok/info/warn/error/silent) (default: info)
	  -r, --reload  *Run live-reload server on dist directory
	  -s, --sync    *Run browser-sync server on dist directory

	*) Not yet implemented

	Note: Like options, commands can be abbreviated, per example:
	Full length:    nbob --env=staging update:api deploy
	Abbreviated:    nbob -e staging u:a d

# Config
Configuration consists of conventional defaults defined in [nbob-config.json](nbob-config.json) which can be extended and overridden by `~/.nbob/nbob-config.json` and `<project>/nbob-config.json`.

*TODO: Document configuration options and defaults*

# Processors
Please see processor source files for more information on how they work.
Also see [package.json](package.json) for exact dependencies.

Later we may add support for showing detailed help about a specified command (e.g: nbob -h build:js:minify).

While processor implementations are still in the works, here are some links to third party tools that might be used:

* Documentation
  * [jsdoc3](https://github.com/jsdoc3/jsdoc)
* JS Linting
  * [jshint](https://github.com/jshint/jshint)
* HTML minification
  * [html-minifier](https://github.com/kangax/html-minifier)
* CSS pre-processing
  * [less](http://lesscss.org)
  * [sass](https://github.com/andrew/node-sass)
* CSS minification
  * [yuicompressor](https://github.com/yui/yuicompressor)
  * [clean-css](https://github.com/GoalSmashers/clean-css)
* ES6 transpiling
  * [traceur](https://github.com/google/traceur-compiler)
  * Or something smaller/simpler for basics features like: Class, Module, Promise
* JS minification
  * [uglifyjs](https://github.com/mishoo/UglifyJS)
* Web server
  * [connect](http://www.senchalabs.org/connect) (Express is overkill)
    * Use middleware: static, directory, favicon, errorHandler
* Live Reload
  * [tiny-lr](https://github.com/mklabs/tiny-lr)
* Browser Sync
  * [browser-sync](https://github.com/shakyshane/browser-sync)

# License
Copyright (c) 2014 [Ex Machina](http://exmg.tv).

Released under MIT License. Enjoy and Fork!

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
