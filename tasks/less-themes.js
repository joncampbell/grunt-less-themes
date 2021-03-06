/*
 * grunt-less-themes
 *
 *
 * Adapted from the grunt-contrib-less module.
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 Tyler Kellen, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

    var path = require('path'),
        less = require('less'),
        fs = require('fs');

    var _ = grunt.util._,
        async = grunt.util.async;

    var lessOptions = {
        parse: ['paths', 'optimization', 'filename', 'strictImports', 'dumpLineNumbers'],
        render: ['compress', 'cleancss', 'yuicompress', 'ieCompat']
    };

    grunt.registerMultiTask('lessThemes', 'Compile multiple themed LESS files to CSS', function () {

        var options = {
            root: './',
            output: 'generated',
            themeDir: 'themes',
            fontDir: 'fonts',
            placeholder: '{{themeName}}',
            font_placeholder: '{{fontName}}',
            themeImport: 'theme',
            fontImport: 'font'
        };

        var done = this.async();

        var options = _.extend(options, this.options()),
            srcFiles = this.files;

        lessOptions = _.extend(lessOptions, this.options().lessOptions)

        getFonts(options, function (fonts) {
            getThemes(options, function (themes) {

                async.forEachSeries(themes, function (theme, nextTheme) {
                    async.forEachSeries(fonts, function (font, nextFont) {
                        var themePath = options.root + '/' + options.themeDir + '/' + theme;
                        var fontPath = options.root + '/' + options.fontDir + '/' + font;

                        var rs = fs.createReadStream(themePath);
                        rs.pipe(fs.createWriteStream(options.themeImport));

                        rs.on('end', function () {
                            var rsFont = fs.createReadStream(fontPath);
                            rsFont.pipe(fs.createWriteStream(options.fontImport));

                            rsFont.on('end', function () {
                                async.forEachSeries(srcFiles, function (f, nextFileObj) {
                                    var destFile = options.output + '/' + f.dest.replace(options.placeholder, theme.replace(/\.[^/.]+$/, "")).replace(options.font_placeholder, font.replace(/\.[^/.]+$/, ""));

                                    var files = f.src.filter(function (filepath) {
                                        // Warn on and remove invalid source files (if nonull was set).
                                        if (!grunt.file.exists(filepath)) {
                                            grunt.log.warn('Source file "' + filepath + '" not found.');
                                            return false;
                                        } else {
                                            return true;
                                        }
                                    });

                                    if (files.length === 0) {
                                        if (f.src.length < 1) {
                                            grunt.log.warn('Destination not written because no source files were found.');
                                        }

                                        // No src files, goto next target. Warn would have been issued above.
                                        return nextFileObj();
                                    }

                                    var compiled = [];

                                    async.concatSeries(files, function (file, next) {
                                        compileLess(file, options, function (err, css) {
                                            if (!err) {
                                                compiled.push(css);
                                                next();
                                            } else {
                                                nextFileObj(err);
                                            }
                                        });
                                    }, function () {
                                        if (compiled.length < 1) {
                                            grunt.log.warn('Destination not written because compiled files were empty.');
                                        } else {
                                            grunt.file.write(destFile, compiled.join(grunt.util.normalizelf(grunt.util.linefeed)));
                                            grunt.log.writeln('File ' + destFile.cyan + ' created.');
                                        }
                                        nextFileObj();
                                    });

                                }, nextFont);
                            });
                        });
                    }, nextTheme);
                }, done);
            });
        });
    });

    var getThemes = function (options, callback) {
        var themePath = options.root + '/' + options.themeDir;

        fs.readdir(themePath, function (err, list) {
            if (err) {
                throw err;
            }
            callback(list);
        });
    };

    var getFonts = function (options, callback) {
        var fontPath = options.root + '/' + options.fontDir;

        fs.readdir(fontPath, function (err, list) {
            if (err) {
                throw err;
            }
            callback(list);
        });
    };

    var compileLess = function (srcFile, options, callback) {
        options = _.extend({
            filename: srcFile
        }, options);
        options.paths = options.paths || [path.dirname(srcFile)];

        var css;
        var srcCode = grunt.file.read(srcFile);

        var parser = new less.Parser(_.pick(options, lessOptions.parse));

        parser.parse(srcCode, function (parse_err, tree) {
            if (parse_err) {
                lessError(parse_err);
                callback(true, '');
            }

            try {
                css = tree.toCSS(_.pick(options, lessOptions.render));
                callback(null, css);
            } catch (e) {
                lessError(e);
                callback(true, css);
            }
        });
    };

    var formatLessError = function (e) {
        var pos = '[' + 'L' + e.line + ':' + ('C' + e.column) + ']';
        return e.filename + ': ' + pos + ' ' + e.message;
    };

    var lessError = function (e) {
        var message = less.formatError ? less.formatError(e) : formatLessError(e);

        grunt.log.error(message);
        grunt.fail.warn('Error compiling LESS.');
    };
};