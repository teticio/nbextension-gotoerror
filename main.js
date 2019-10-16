var gotoerror;

define([
    'base/js/namespace',
    'jquery',
    'require',
    'notebook/js/outputarea',
    'base/js/utils',
    'base/js/events',
    'notebook/js/codecell',
], function(
    Jupyter,
    $,
    requirejs,
    outputarea,
    utils,
    events,
    codecell
) {
    "use strict";

    // largely copied from https://github.com/minrk/nbextension-scratchpad/
    var CodeCell = codecell.CodeCell;

    var Gotoerror = function (nb) {
        var gotoerror = this;
        this.notebook = nb;
        this.kernel = nb.kernel;
        this.km = nb.keyboard_manager;
        this.collapsed = true;

        this.element = $("<div id='nbextension-gotoerror'>");
        this.close_button = $("<i>").addClass("fa fa-window-close gotoerror-btn gotoerror-close");
        this.element.append(this.close_button);
        this.close_button.click(function () {
            gotoerror.collapse();
        });

        // create my cell
        var cell = this.cell = new CodeCell(nb.kernel, {
            events: nb.events,
            config: nb.config,
            keyboard_manager: nb.keyboard_manager,
            notebook: nb,
            tooltip: nb.tooltip,
        });
        cell.set_input_prompt();
        this.element.append($("<div/>").addClass('cell-wrapper').append(this.cell.element));
        cell.render();
        cell.refresh();
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

    Gotoerror.prototype.expand = function (url) {
        this.collapsed = false;
        var site_height = $("#site").height();
        this.element.animate({
            height: site_height,
        }, 200);
        this.close_button.show();
        this.cell.element.show();
        this.cell.focus_editor();
        this.cell.set_text(url);
        $("#notebook-container").css('margin-left', 0);
    };

    Gotoerror.prototype.collapse = function () {
        this.collapsed = true;
        $("#notebook-container").css('margin-left', 'auto');
        this.element.animate({
            height: 0,
        }, 100);
        this.close_button.hide();
        this.cell.element.hide();
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
                        var filename = s.substring(start.index + start[0].length, end.index);
                        
                        // if it is in site-packages, create a link to it
                        var match = filename.search('site-packages');
                        if (match > -1) {
                            var url = window.location.href.split('/')
                            url = url[0] + '//' + url[2] + '/' + filename.substring(match).replace(/\\/g, '/');
                            var eol = s.search('\\n')
                            var rest_of_line = utils.fixConsole(s.substring(end.index + end[0].length, eol));
                            var line = $('<pre/>');
                            var link = $('<span/>').addClass("ansi-green-fg");
                            link.text(filename);
                            link.click(new Function('gotoerror.expand("'+ url +'")'));
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