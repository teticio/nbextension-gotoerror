// needs to be global because we are creating Functions on the fly
var gotoerror;

define([
    'jquery',
    'require',
    'contents',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events',
    'services/config',
    'edit/js/editor',
    'notebook/js/outputarea',
    'codemirror/lib/codemirror',
], function (
    $,
    requirejs,
    contents_service,
    Jupyter,
    utils,
    events,
    configmod,
    editmod,
    outputarea,
    CodeMirror
) {
    "use strict";

    var options = {
        prefix: '',
        prefix2: '',
    };

    var Gotoerror = function (nb) {
        var gotoerror = this;
        this.events = nb.events;

        this.element = $("<div id='nbextension-gotoerror'>").addClass("input_area");
        this.close_button = $("<i>").addClass("fa fa-window-close gotoerror-close-btn");
        this.element.append(this.close_button);
        this.close_button.click(function () {
            gotoerror.collapse();
        });
        this.element.append($("<div>").addClass('gotoerror-filename'));
        this.element.append($("<div>").addClass('gotoerror-code'));
        this.collapse();

        $(window).on('resize', function (evt) {
            if (!this.collapsed) {
                $('.gotoerror-code').height($("#nbextension-gotoerror").height() - $(".gotoerror-filename").outerHeight(true));
            }
        });

        // finally, add me to the page
        $("body").append(this.element);
    };

    Gotoerror.prototype.toggle = function () {
        if (this.collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
        return false;
    };

    Gotoerror.prototype.expand = function (file_path, line_number, url) {
        this.collapsed = false;
        this.element.css('height', $("#site").height());
        this.element.css('display', 'block');
        this.close_button.show();
        $("#notebook-container").css('margin-left', 0);

        $(".gotoerror-filename").html('<a target="_blank" href="' + url + '">' + file_path.replace(/^.*[\\\/]/, '') + '</a>');
        // adjust height accordingly
        $('.gotoerror-code').height($("#nbextension-gotoerror").height() - $(".gotoerror-filename").outerHeight(true));
        var base_url = utils.get_body_data('baseUrl');
        var config = new configmod.ConfigSection('edit', { base_url: base_url });
        config.load();
        var common_config = new configmod.ConfigSection('common', { base_url: base_url });
        common_config.load();
        var contents = new contents_service.Contents({
            base_url: base_url,
            common_config: common_config,
        });
        $(".gotoerror-code").text('');
        this.editor = new editmod.Editor(".gotoerror-code", {
            base_url: base_url,
            events: events,
            contents: contents,
            file_path: file_path,
            config: config,
        });
        this.editor.codemirror.setOption('readOnly', true);
        var that = this;
        this.events.on('file_loaded.Editor', function (evt, model) {
            if (line_number) {
                that.editor.codemirror.setSelection({ line: line_number - 1, ch: 0 }, { line: line_number, ch: 0 });
            }
        });
        this.events.on('file_load_failed.Editor', function (evt, model) {
            $(".gotoerror-code").html('<div style="margin-left: 10px; font-size: 16px">Error loading file, see <a href="https://github.com/teticio/nbextension-gotoerror" target="_blank">README</a> for help</div>')
        });
        this.editor.load();
    };

    Gotoerror.prototype.collapse = function () {
        this.collapsed = true;
        $("#notebook-container").css('margin-left', 'auto');
        this.element.css('display', 'none');
        this.close_button.hide();
    };

    var apply_patches = function () {

        // override
        outputarea.OutputArea.prototype.append_error = function (json) {
            var ansi_re = /\x1b\[[^m]*m([^:]*):(\d*)/;
            var tb = json.traceback;
            if (tb !== undefined && tb.length > 0) {
                var toinsert = this.create_output_area()
                var subarea = this.create_output_subarea({}, "output_text", 'text/plain');
                var len = tb.length;
                var s

                for (var i = 0; i < len; i++) {
                    s = tb[i] + '\n';

                    // just in case anything goes wrong
                    try {
                        var match_filename = ansi_re.exec(s);

                        // grab filename
                        if (match_filename) {
                            var filename = match_filename[1];
                            var line_number = match_filename[2]
                            var root = options.prefix.replace(/\\/g, '/');
                            var root2 = options.prefix2.replace(/\\/g, '/');
                            var match = filename.search(root);
                            var match2 = filename.search(root2);

                            if (match < 0) {
                                if (match2 >= 0) {
                                    root = root2;
                                    match = match2;
                                }
                            }

                            // if it is in site-packages, create a link to it
                            if (root != '' && match >= 0) {
                                var file_path = filename.replace(root, '');
                                var url = window.location.href.split('/');
                                var url = url[0] + '//' + url[2] + ('/edit/' + file_path).replace('//', '/');
                                var eol = s.search('\\n')
                                var line = $("<pre/>");
                                var link = $("<span/>");
                                line.append(utils.fixConsole(s.substring(0, match_filename.index)));
                                link.html(utils.fixConsole(s.substring(match_filename.index, match_filename.index + match_filename[0].length)));
                                link.click(new Function("gotoerror.expand('" + file_path + "', " + line_number + ", '" + url + "')"));
                                link.css('cursor', 'pointer');
                                line.append(link);
                                line.append(utils.fixConsole(s.substring(match_filename.index + match_filename[0].length, eol)));
                                subarea.append(line);
                                s = s.substring(eol + 1);
                            }
                        }
                    } catch (err) {
                        console.error('nbextension gotoerror', 'unhandled error:', err);
                    }

                    // add the rest of the lines
                    subarea.append($("<pre/>").html(utils.fixConsole(s)));
                }

                // add stack overflow button
                try {
                    var search_text = escape(tb[tb.length - 1].replace(/\x1b\[(.*?)([@-~])/g, ''));
                    var stackoverflow_button = $("<button/>").addClass("gotoerror-stackoverflow-btn");
                    stackoverflow_button.click(function () {
                        window.open('https://www.google.com/search?q=' + search_text + '+site:stackoverflow.com');
                    });
                    stackoverflow_button.text("Search Stack Overflow");
                    subarea.append($("<p/>").html('&nbsp'));
                    subarea.append(stackoverflow_button);
                } catch (err) {
                    console.error('nbextension gotoerror', 'unhandled error:', err);
                }

                toinsert.append(subarea);
                toinsert.addClass("output_error");
                this._safe_append(toinsert);
            }
        };
    }

    function setup_gotoerror() {
        // lazy, hook it up to Jupyter.notebook as the handle on all the singletons
        gotoerror = new Gotoerror(Jupyter.notebook)
        return gotoerror;
    }

    function load_ipython_extension() {
        apply_patches();

        // add css
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = requirejs.toUrl("./gotoerror.css");
        document.getElementsByTagName("head")[0].appendChild(link);

        // setup things to run on loading config/notebook
        Jupyter.notebook.config.loaded
            .then(function update_options_from_config() {
                $.extend(true, options, Jupyter.notebook.config.data['gotoerror']);
            })
            .then(function () {
                if (Jupyter.notebook._fully_loaded) {
                    setup_gotoerror();
                }
                events.on('notebook_loaded.Notebook', setup_gotoerror);
            });
    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});