#nBob
<img align="right" height="200" src="https://raw.githubusercontent.com/exmg/nbob/master/bob.jpg" title="Bob the builder" />
[Ex Machina](http://exmg.tv)'s second generation frontend build tool, based on Node and V8.

## Table of Contents

* [About](#about)
* [Installation](#installation)
* [Usage](#usage)
* [Config](#config)
* [Processors](#processors)
* [Conventions](#conventions)
* [Changelog](#changelog)
* [License](#license)

## About
nBob is designed and built based on the following values:

* DRY (Do not Repeat Yourself)
  * Minimal project configuration
  * Efficient Processor plugin API
* Performance
  * Intermediate build artifact cache enables incremental builds
  * Processor Batches can be distributed across multiple CPU cores
* Predictability
  * Single mode (no development vs production), source maps can be used for debugging
  * Just like plain HTML/CSS/JS, build on browser reload and show any errors there as well

## Installation
Start by [installing Node](http://nodejs.org) if you don't have that yet.

Then install nBob through NPM; open a terminal or command prompt and type the following on your command line:

On OS X and Linux:

	$ sudo npm install -g nbob

On Windows:

	> npm install -g nbob

If an update is available then nBob will notify you.

## Usage
Running nbob in your terminal with invalid or incomplete arguments will result in it's help being displayed:

	$ nbob

	nBob v<version>

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

	X nbob          No command(s) specified


## Config
Configuration consists of nBob package defaults ([nbob-config.json](nbob-config.json)) which can be extended and overridden by user defaults (`~/.nbob/nbob-config.json`) and finally project configuration (`<project>/nbob-config.json`).

These configuration files are JSON files with keys generally referring to the command processors that they configure.

Most configuration sections include a `files` key that specifies an array of glob patterns for files to be included and excluded (by starting glob string with an exclamation mark `!`). For glob syntax details, please see the documentation of the used matcher: [minimatch](https://github.com/isaacs/minimatch).

### Project config
One special configuration key is `project`. You should always define project name and version in your project configuration file and optionally you might like to exclude some files or directories:

	"project": {
		"name": "awesomo",
		"version": "1.2.3",
		"files": [ "!res/theme-b/**/*" ]
	},

### Config substitution
Configuration values can also contain substitution syntax, inspired by Mustache templating, p.e:

	"make:js:concat": {
		"files": [ "{lib,src}/**/*.min.js{,.map}" ],
		"output": "{{project.name}}-{{project.version}}.min.js"
	},
	"make:js:amd": {
		"files": [ "{{make:js:concat.output}}{,.map}" ],
		"exports": []
	},

Results in project name and version being filled in to generate the JS concat output filename and the AMD using that output filename as input.

### Environment configs
Another special configuration key is `envConfigMap`. This can be used to specify a number of named environment configs. When you specify the name of such an environment config using the `--env` option your config will be extended with that environment config, p.e:

	"deploy": {
		"bucketName": "dev.playtotv.com"
	},
	"envConfigMap": {
		"staging": {
			"deploy": {
				"bucketName": "staging.playtotv.com"
			}
		}
	}

Will result with `$ nbob d` deploying to dev.playtotv.com and `$ nbob -e staging d` deploying to staging.playtotv.com.

### Command line override
If you want to quickly override a single configuration value you can use the `--option` command line option, p.e: `$ nbob -o server.port=8081 s` in case you want to run multiple nbob servers or `$ nbob -o deploy.force=true d` in case you want to force a deploy of all files (not just the changed ones).

## Processors
For now, please see processor source files for more information on how they work and [package.json](package.json) for links to third party dependencies.

*TODO: Add support for showing processor help (e.g: nbob -h make:js:minify) and copy output here for convenience*

### Pending
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

## Conventions
nBob uses the following filename and directory conventions:

* `l10n/*.json` - Localization dictionary files
* `lib/**/*.js` (and optionally `*.map`) - External JavaScript files from other projects etc. to be included into this project
* `src/**/*.js` - This project's JavaScript files
* `templates/**/*.html` - HTML template files to be compiled into directory JSON files
* `.jshintrc` and `.jshintignore` - JSHint project configuration files
* `**/*.{html,css,js,json,less}` - Respectively HTML/CSS/JS/JSON/LESS files (e.g: use extensions)
* `**/*.min.*` and `**/*.min.*.map` - Minified files and corresponding source map files
* `**/*-l10n.html` and `**/*-l10n/**/*.html` - Files to be localized

## Changelog
See [the releases page](https://github.com/exmg/nbob/releases).

## License
[MIT License](LICENSE) and copyright [Ex Machina](http://exmg.tv).
