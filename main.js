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
], function(
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

    // largely copied from https://github.com/minrk/nbextension-scratchpad/
    var Gotoerror = function (nb) {
        var gotoerror = this;
        
        this.element = $("<div id='nbextension-gotoerror'>");
        this.close_button = $("<i>").addClass("fa fa-window-close gotoerror-btn gotoerror-close");
        this.element.append(this.close_button);
        this.close_button.click(function () {
            gotoerror.collapse();
        });
        this.element.append($("<div id='gotoerror-filename'>").addClass('gotoerror-filename'));
        this.element.append($("<div id='gotoerror-code'>").addClass('gotoerror-code'));
        this.collapse();
    
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

    Gotoerror.prototype.expand = function (file_path) {
        this.collapsed = false;
        var site_height = $("#site").height();
        this.element.animate({
            height: site_height,
        }, 200);
        this.close_button.show();
        
        $("#gotoerror-filename").text(file_path);
        var base_url = utils.get_body_data('baseUrl');
        var config = new configmod.ConfigSection('edit', {base_url: base_url});
        config.load();
        var common_config = new configmod.ConfigSection('common', {base_url: base_url});
        common_config.load();
        var contents = new contents_service.Contents({
            base_url: base_url,
            common_config: common_config
        });
        $("#gotoerror-code").text('');
        this.editor = new editmod.Editor('#gotoerror-code', {
            base_url: base_url,
            events: events,
            contents: contents,
            file_path: file_path,
            config: config,
        });
        this.editor.codemirror.setOption("readOnly", true)
        this.editor.load();
        this.editor.codemirror.setCursor(300);
        
        $("#notebook-container").css('margin-left', 0);
    };

    Gotoerror.prototype.collapse = function () {
        this.collapsed = true;
        $("#notebook-container").css('margin-left', 'auto');
        this.element.animate({
            height: 0,
        }, 100);
        this.close_button.hide();
    };

    var apply_patches = function () {

        // override
        outputarea.OutputArea.prototype.append_error = function (json) {
            var tb = json.traceback;
            if (tb !== undefined && tb.length > 0) {
                var toinsert = this.create_output_area()
                var subarea = this.create_output_subarea({}, "output_text", 'text/plain');
                var len = tb.length;
                var s
                
                for (var i=0; i<len; i++) {
                    var ansi_re = /\x1b\[(.*?)([@-~])/g;
                    s = tb[i] + '\n';
                    var start = ansi_re.exec(s);
                    var end = ansi_re.exec(s);
                    
                    // grab filename
                    if (start && end) {
                        var formated_filename = s.substring(start.index, end.index + end[0].length);
                        var filename = s.substring(start.index + start[0].length, end.index);
                        
                        // if it is in site-packages, create a link to it
                        var match = filename.search('site-packages');
                        if (match > -1) {
                            var file_path = filename.substring(match).replace(/\\/g, '/');
                            var eol = s.search('\\n')
                            var rest_of_line = utils.fixConsole(s.substring(end.index + end[0].length, eol));
                            var line = $('<pre/>');
                            var link = $('<span/>');
                            link.html(utils.fixConsole(formated_filename));
                            link.click(new Function('gotoerror.expand("'+ file_path +'")'));
                            link.append(rest_of_line);
                            line.append(link);
                            subarea.append(line);
                            s = s.substring(eol+1);
                        }
                    }
                    
                    // add the rest of the lines
                    subarea.append($("<pre/>").html(utils.fixConsole(s)));
                }
                
                subarea.append('\n');
                toinsert.append(subarea);
                toinsert.addClass('output_error');
                this._safe_append(toinsert);
            }
        };
    }
    
    function setup_gotoerror () {
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

        // load when the kernel's ready
        if (Jupyter.notebook.kernel) {
            setup_gotoerror();
        } else {
            events.on('kernel_ready.Kernel', setup_gotoerror);
        }
    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});