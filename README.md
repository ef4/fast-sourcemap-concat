Fast Source Map Concatenation
-----------------------------

[![Build Status](https://travis-ci.org/ef4/fast-sourcemap-concat.svg?branch=master)](https://travis-ci.org/ef4/fast-sourcemap-concat)
[![Build status](https://ci.appveyor.com/api/projects/status/0iy8on5vieoh3mp2/branch/master?svg=true)](https://ci.appveyor.com/project/embercli/fast-sourcemap-concat/branch/master)

This library lets you concatenate files (with or without their own
pre-generated sourcemaps), and get a single output file along with a
sourcemap.

It was written for use in ember-cli via broccoli-concat.

available options
-------

### `baseDir`

Type: `path`

The root directory for resolving source and map files.

If no value is given, will default to the current working directory.

### `cache`

Type: `Object`

(Optional) Used to cache encoder results. Passing this in from the outside allows for many instances of the plugin to share one cache.

### `file`

Type: `string`

The value assigned to the sourcemap's `"file"` key, as described in the [sourcemaps spec](http://sourcemaps.info/spec.html).

If no value is given, will default to the basename of `outputFile`.

### `fs`

Type: `Object`

A custom Node File System module.

If no value is given, will default to `require('fs-extra')`.

### `mapCommentType`

Type: `string`

If `'line'` is specified, `sourceMappingURL` will be written in a single-line comment (`//`).

If anything else truthy is specified, `sourceMappingURL` will be written in a block comment (`/* */`).

If no value is given, or a falsey value is given, will default to `'line'`.

### `mapFile`

Type: `string`

Filename where the concatenated sourcemap will be written.

If no value is given, will default to the value of `outputFile`, but with `'.js'` replaced by `'.map'`.

### `mapStyle`

Type: `string`

If `'data'` is specified, `sourceMappingURL` will contain a data URL instead of `mapURL`.

If `'file'` is specified, `sourceMappingURL` will contain `mapURL`.

If anything else truthy is specified, the behavior is undefined.

If no value is given, or a falsey value is given, will default to `'file'`.

### `mapURL`

Type: `string`

The value written to the `sourceMappingURL` comment.

If no value is given, will default to the basename of `mapFile`.

### `outputFile`

Type: `string`

Filename where the concatenated source code will be written.

If you don't specify this you must specify `mapURL` and `file`.

### `pluginId`

Type: `number`

A unique id for one instance of this lib. Ensures unique filenames when reporting stats via `CONCAT_STATS` env var.

### `sourceRoot`

Type: `string`

The value assigned to the sourcemap's `"sourceRoot"` key, as described in the [sourcemaps spec](http://sourcemaps.info/spec.html).

source-map dependency
---------------------

We depend on mozilla's source-map library, but only to use their
base64-vlq implementation, which is in turn based on the version in
the Closure Compiler.

We can concatenate much faster than source-map because we are
specifically optimized for line-by-line concatenation.
