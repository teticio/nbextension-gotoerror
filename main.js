define([
    'base/js/namespace',
    'jquery',
    'require',
    'notebook/js/outputarea',
    'base/js/utils'
], function(
    Jupyter,
    $,
    requirejs,
    outputarea,
    utils
) {
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
                        filename = s.substring(start.index + start[0].length, end.index);
                        
                        // if it is in site-packages, create a link to it
                        if ((match = filename.search('site-packages')) > -1) {
                            url = 'http://localhost:8000/edit/ML/' + filename.substring(match);
                            eol = s.search('\\n')
                            rest_of_line = utils.fixConsole(s.substring(end.index + end[0].length, eol));
                            subarea.append('<a target="_blank" href="' + url + '" class="ansi-green-fg">' + filename + '</a>' + rest_of_line);
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
    
    function load_ipython_extension() {
        apply_patches();
    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});