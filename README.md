#nBob
<img align="right" height="200" src="https://raw.githubusercontent.com/exmg/nbob/master/bob.jpg" title="Bob the builder" />
[Ex Machina](http://exmg.tv)'s second generation frontend build tool, based on Node and V8, focussing on:

* **Ease of use**
  * Includes local build server
  * Shows build errors directly in browser
* **Performance**
  * Incremental builds
  * Multi-core processing
* **Predictability**
  * Single mode (no development vs production)
  * Build on browser reload
* **Conciseness**
  * Minimal project configuration
  * Efficient processor plugin API

See the [releases page](https://github.com/exmg/nbob/releases) for a changelog.

Licensed under [MIT License](LICENSE) and Copyright [Ex Machina](http://exmg.tv).

## Table of Contents
* [Installation](#installation)
* [Usage](#usage)
* [Config](#config)
  * [Config extension](#config-extension)
  * [Config substitution](#config-substitutions)
  * [nBob config](#nbob-config)
  * [Project config](#project-config)
  * [Environment config](#environment-config)
  * [Config option](#config-option)
* [Commands](#commands)
* [Processors](#processors)
  * [Pending processors](#pending-processors)
* [Conventions](#conventions)

## Installation
Start by [installing Node](http://nodejs.org) if you don't have that yet.

Then install nBob through NPM; open a terminal or command prompt and type the following on your command line:

On OS X and Linux:

	$ sudo npm install -g nbob

On Windows:

	> npm install -g nbob

If an update is available then nBob will notify you and you can update with the same command line as above except with `install` replaced by `update`.

[▴TOC](#table-of-contents)

## Usage
Running nbob in your terminal with invalid or incomplete arguments will result in it's help being displayed:

	nBob v<version>

	Usage: nbob [options] <commands>

	Commands:
	  init
	    nbob        Create nbob-config.json
	    hint        Create .jshintrc and .jshintignore
	    aws         Create ~/.aws/credentials
	  update
	    api         Update EM api directory
	    doc         *Update doc directory
	    l10n        Update l10n directory
	    lib         *Update lib directory
	  clean         Remove build and dist directories
	  make
	    images
	      png       *Compress PNG images
	    html
	      l10n      Localize texts
	      include   Include files
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

[▴TOC](#table-of-contents)

## Config
Configuration consists of nBob package defaults ([nbob-config.json](nbob-config.json)) which can be extended and overridden by user defaults (`~/.nbob/nbob-config.json`) and finally project configuration (`<project>/nbob-config.json`).

These configuration files are JSON files with section keys, aside from a few special ones ([nbob](#nbob-config), [project](project-config) and [envConfigMap](environment-config)), referring to the [command](#commands) that they define.

The active configuration can be further influenced by specifying options ([--env](#environment-config) and [--option](#config-option)) on your command line.

Most configuration sections include a `files` key that specifies an array of glob patterns for files to be included and excluded (by starting glob string with an exclamation mark `!`).
For glob syntax details, please see the documentation of the used matcher: [minimatch](https://github.com/isaacs/minimatch).

[▴TOC](#table-of-contents)

### Config extension
When one config object is extended by another then any new properties are added and any existing properties are overridden.

When one config array is extended by another then all items from the other array are added to the first.
However, when the extending array starts with the special item `!!` then the original array is first emptied, effectively replacing the array.

[▴TOC](#table-of-contents)

### Config substitution
Configuration values can contain substitution syntax, inspired by Mustache templating.

**Example:**
```json
{
	"make:js:concat": {
		"files": [ "{lib,src}/**/*.min.js{,.map}" ],
		"output": "{{project.name}}-{{project.version}}.min.js"
	},
	"make:js:amd": {
		"files": [ "{{make:js:concat.output}}{,.map}" ],
		"exports": []
	}
}
```

Results in project name and version being filled in to generate the JS concat output filename and the AMD using that output filename as input.

**Note:** Substitution by non-string config object values is currently also supported using Mustache partial sytax, p.e: `"files": "{{> update:l10n.files}}"`.
It is however a deprecated feature since it does not combine well with config extension and will be removed in the future.

[▴TOC](#table-of-contents)

### nBob config
The special configuration section with key `nbob` has the following options:

* `multiCore = true` - Toggles multi-core processing on or off

**Example:**
```json
{
	"nbob": {
		"multiCore": false
	}
}
```

Adding this section to your user config file (`~/.nbob/nbob-config.json`) would result in all of your builds defaulting to not using multi-core processing. This can be useful if you have found that the overhead does not outweigh the improved processing speed on your system.

[▴TOC](#table-of-contents)

### Project config
The special configuration section with key `project` has the following options:

* `name = "Unnamed"` - Used to name build artifacts, you should define this in your project config file
* `version = "0"` - Used to name build artifacts, you should define this in your project config file
* `files` - Can be used to exclude (or un-exclude) certain files or directories
* `buildDir = "build"` - Name of project subdirectory where to write build artifacts
* `distDir = "dist"` - Name of project subdirectory where to write distribution artifacts

**Example:**
```json
{
	"project": {
		"name": "awesomo",
		"version": "1.2.3",
		"files": [ "!!nbob-config.json", "!res/unused-theme/**/*" ]
	}
}
```

Results in nbob-config.json being un-excluded and the unused-theme files being excluded from all processing.

[▴TOC](#table-of-contents)

### Environment config
The special configuration section with key `envConfigMap` can be used to specify a number of named environment configs.
When you specify the name of such an environment using the `--env` option your config will be extended with that environment config.

**Example:**
```json
{
	"make:substitute:path": {
		"substitutes": {
			"SERVER": "dev-backend.playtotv.com"
		}
	},
	"deploy": {
		"bucketName": "dev.playtotv.com"
	},
	"envConfigMap": {
		"staging": {
			"make:substitute:path": {
				"substitutes": {
					"SERVER": "staging-backend.playtotv.com"
				}
			},
			"deploy": {
				"bucketName": "staging.playtotv.com"
			}
		}
	}
}
```

Will result with `$ nbob d` deploying to dev.playtotv.com and `$ nbob -e staging d` deploying to staging.playtotv.com.
It will simultaneously substitute `__SERVER__` by `dev-backend.playtotv.com` or `staging-backend.playtotv.com` in their respective environment artifacts.

[▴TOC](#table-of-contents)

### Config option
If you want to quickly override a single configuration value you can use the `--option` command line option.

**Examples:**

* `$ nbob -o server.port=8081 s` - In case you want to run multiple nbob servers
* `$ nbob -o deploy.force=true d` - In case you want to force a deploy of all files (not just the changed ones)

[▴TOC](#table-of-contents)

## Commands
Commands combine a [processor](#processors) with configuration to provide a specific type of functionality.
Their names are hierarchical, separated by colon characters `:`.
When you execute a command you will also execute all of it's subcommands.
If a Command specifies any dependencies, those commands will also be executed.
Commands and subcommands are executed in the order that they were defined (though still processed parallelly where possible).
When referenced from the command line, command names can be abbreviated.

**Example:**
```json
{
	"make:js:concat": {
		"description": "Concatenate JS files",
		"processor": "concat",
		"files": [ "{lib,src}/**/*.min.js{,.map}" ],
		"output": "{{project.name}}-{{project.version}}.min.js"
	}
}
```

Uses the generic `concat` processor to concatenate JavaScript files and their source maps.

**Note:** Through [config extension](#config-extension) not only command configs, but also their processor references can be customized. You can even add extra commands this way! Support for using your own custom processors will also be added in the near future.

[▴TOC](#table-of-contents)

## Processors
*TODO: Add support for showing processor help (e.g: nbob -h make:js:minify) and copy output here*

For now, please see processor source files for more information on how they work and [package.json](package.json) for links to used third party dependencies.

[▴TOC](#table-of-contents)

### Pending processors
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

[▴TOC](#table-of-contents)

## Conventions
nBob uses the following filename and directory conventions:

* `inc/**/*` - HTML include files
* `l10n/*.json` - Localization dictionary files
* `lib/**/*.js` (and optionally `*.map`) - External JavaScript files from other projects etc. to be included into this project
* `src/**/*.js` - This project's JavaScript files
* `templates/**/*.html` - HTML template files to be compiled into directory JSON files
* `.jshintrc` and `.jshintignore` - JSHint project configuration files
* `**/*.{html,css,js,json,less}` - Respectively HTML/CSS/JS/JSON/LESS files (e.g: use extensions)
* `**/*.min.*` and `**/*.min.*.map` - Minified files and corresponding source map files
* `**/*-l10n.html` and `**/*-l10n/**/*.html` - Files to be localized

[▴TOC](#table-of-contents)
