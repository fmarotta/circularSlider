class CircularSlider {
    /* CircularSlider
     *
     * Design improvements for the future:
     * - Use SVG instead of CSS tricks
     * - Function to redraw the whole thing (e.g. when css properties change)
     * - Private class methods
     */
    constructor(id, options = {}) {
        id = "#" + id.replace(/^#/, "");
        this.$input = $(id);
        this.$input.hide()

        // User configuration
        var config = {
            min: 0,
            max: 2 * Math.PI,
            from: 0, // initial values for start and to
            to: Math.PI / 4,
            step: Math.PI / 50, // DOC: can be null, in which case we've got a continuous slider
            n_breaks: 60,
            major_breaks_every: 6, // put a major break (and a label) every x minor breaks
            digits: 2, // how many digits should labels have
            prefix: "",
            postfix: "",
            values_sep: ":"
        }
        var data_config = {
            min: this.$input.data("min"),
            max: this.$input.data("max"),
            from: this.$input.data("from"),
            to: this.$input.data("to"),
            step: this.$input.data("step"),
            n_breaks: this.$input.data("n-breaks"),
            major_breaks_every: this.$input.data("major-breaks-every"),
            digits: this.$input.data("digits"),
            prefix: this.$input.data("prefix"),
            postfix: this.$input.data("postfix"),
            values_sep: this.$input.data("values-sep")
        }
        for (var prop in data_config) {
            if (data_config.hasOwnProperty(prop) && (data_config[prop] === undefined || data_config[prop] === "")) {
                delete data_config[prop];
            }
        }
        $.extend(config, data_config);
        $.extend(config, options);
        this.config = CircularSlider.validate_config(config);

        var cisl_id = id + '-cisl';
        $(id).after(
            '<span class="cisl cisl--style" id="' + cisl_id.replace(/^#/, "") + '">' +
            '<span class="cisl-ruler"></span>' +
            '<span class="cisl-label cisl-label-from cisl--style"></span>' +
            '<span class="cisl-label cisl-label-to cisl--style"></span>' +
            '<span class="cisl-label cisl-label-from-to cisl--style"></span>' +
            '<span class="cisl-line cisl-rails cisl--style"></span>' +
            '<span class="cisl-line cisl-bar cisl--style"></span>' +
            '<span class="cisl-line cisl-bar-cover cisl--style"></span>' +
            '<span class="cisl-line cisl-bar-cover-cover cisl--style" tabindex=3></span>' +
            '<span class="cisl-handle cisl-from cisl--style" tabindex="1"></span>' +
            '<span class="cisl-handle cisl-to cisl--style" tabindex="2"></span>' +
            '</span>'
        );

        this.$container = $(cisl_id);
        this.$rails = $(cisl_id + " .cisl-rails");
        this.$ruler = $(cisl_id + " .cisl-ruler");
        this.$bar = $(cisl_id + " .cisl-bar");
        this.$bar_cover = $(cisl_id + " .cisl-bar-cover");
        this.$bar_cover_cover = $(cisl_id + " .cisl-bar-cover-cover");
        this.$handle_from = $(cisl_id + " .cisl-from");
        this.$handle_to = $(cisl_id + " .cisl-to");
        this.$label_from = $(cisl_id + " .cisl-label-from");
        this.$label_from_to = $(cisl_id + " .cisl-label-from-to");
        this.$label_to = $(cisl_id + " .cisl-label-to");

        // Store the params for faster access
        this.border_shape_params = this.get_border_shape_params()

        // Draw the ruler
        // TODO: allow for initial rotation of the ruler
        this.update_ruler(this.config.n_breaks, this.config.major_breaks_every)

        // Set the positions of the moving parts
        this.angle_from = null
        this.angle_to = null
        this.update_slider(this.config.from, this.config.to)

        // Callbacks
        this.onStart = null
        this.onFinish = null

        // Bind the events
        // TODO onclick, move the closest handle towards the clicked 
        // point.
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label").not(".cisl-label-from-to").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            $(e_down.target).focus()
            if (typeof this.onStart === "function") {
                this.onStart()
            }
            $(window).on("mouseup touchend", function(e_up) {
                $(window).off("mousemove touchmove")
                if (typeof this.onFinish === "function") {
                    this.onFinish()
                }
            })
            $(window).on("mousemove touchmove", function(e_move) {
                var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                var new_angle = this.get_angle_from_page_coords(pageX, pageY)
                if ($(e_down.target).hasClass("cisl-to") || $(e_down.target).hasClass("cisl-label-to")) {
                    this.update_slider(this.angle_from, new_angle)
                } else if ($(e_down.target).hasClass("cisl-from") || $(e_down.target).hasClass("cisl-label-from")) {
                    this.update_slider(new_angle, this.angle_to)
                }
            }.bind(this))
        }.bind(this))
        $(cisl_id + " .cisl-bar-cover-cover," + cisl_id + " .cisl-label-from-to").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            var pageX = e_down.pageX || e_down.originalEvent.touches[0].pageX
            var pageY = e_down.pageY || e_down.originalEvent.touches[0].pageY
            var angle_down = CircularSlider.normalise_angle(this.get_angle_from_page_coords(pageX, pageY), this.angle_to)
            var angle_from_down = CircularSlider.normalise_angle(this.angle_from, this.angle_to)
            var angle_to_down = this.angle_to
            if (angle_from_down < angle_down && angle_down < angle_to_down) {
                var slice_from = angle_down - angle_from_down
                var slice_to = angle_to_down - angle_down
                $(e_down.target).focus()
                if (typeof this.onStart === "function") {
                    this.onStart()
                }
                $(window).on("mouseup touchend", function(e_up) {
                    $(window).off("mousemove touchmove")
                    if (typeof this.onFinish === "function") {
                        this.onFinish()
                    }
                })
                $(window).on("mousemove touchmove", function(e_move) {
                    var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                    var angle_from = this.get_angle_from_page_coords(pageX, pageY) - slice_from
                    var angle_to = this.get_angle_from_page_coords(pageX, pageY) + slice_to
                    this.update_slider(angle_from, angle_to)
                }.bind(this))
            }
        }.bind(this))
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label," + cisl_id + " .cisl-bar-cover-cover").on("keydown", function(e_press) {
            switch (e_press.which) {
                case 39: var weight = 1; break;
                case 37: var weight = -1; break;
                default: var weight = 0;
            }
            if (weight == 0) {
                return
            }
            if (typeof this.onStart === "function") {
                this.onStart()
            }
            if (e_press.shiftKey) {
                weight *= 10
            }
            if (this.config.step === null) {
                if ($(e_press.target).hasClass("cisl-to") || $(e_press.target).hasClass("cisl-label-to")) {
                    this.update_slider(this.angle_from, this.angle_to + weight * Math.PI / 50) // advance 1 percent
                } else if ($(e_press.target).hasClass("cisl-from") || $(e_press.target).hasClass("cisl-label-from")) {
                    this.update_slider(this.angle_from + weight * Math.PI / 50, this.angle_to)
                } else if ($(e_press.target).hasClass("cisl-bar-cover-cover") || $(e_press.target).hasClass("cisl-label-from-to")) {
                    this.update_slider(this.angle_from + weight * Math.PI / 50, this.angle_to + weight * Math.PI / 50) // advance 1 percent
                }
            } else {
                if ($(e_press.target).hasClass("cisl-to") || $(e_press.target).hasClass("cisl-label-to")) {
                    this.update_slider(this.angle_from, this.angle_to + this.value2angle(weight * this.config.step))
                } else if ($(e_press.target).hasClass("cisl-from") || $(e_press.target).hasClass("cisl-label-from")) {
                    this.update_slider(this.angle_from + this.value2angle(weight * this.config.step), this.angle_to)
                } else if ($(e_press.target).hasClass("cisl-bar-cover-cover") || $(e_press.target).hasClass("cisl-label-from-to")) {
                    this.update_slider(this.angle_from + this.value2angle(weight * this.config.step), this.angle_to + this.value2angle(weight * this.config.step))
                }
            }
            if (typeof this.onFinish === "function") {
                this.onFinish()
            }
        }.bind(this))
    }

    get_border_shape_params = function() {
        /* Get the relevant parameters for the rails
         *
         * In case of circular rails, we'd need the center and radius; 
         * for elliptical rails, the center and the axes; and so on.
         */
        var p = {
            shape: "circle",
            abs_center: {
                /* Center relative to the document */
                x: this.$rails.offset().left + this.$rails.width() / 2,
                y: this.$rails.offset().top + this.$rails.height() / 2
            },
            rel_center: {
                /* Center relative to the container */
                x: this.$rails.outerWidth() / 2,
                y: this.$rails.outerHeight() / 2
            },
            // The following is not good because it includes the 
            // padding, but I'm after the border only.
            // radius: (this.$rails.width() + (this.$rails.outerWidth() - this.$rails.width()) / 2) / 2
            // TODO: parse units and convert to px
            radius: (this.$rails.width() + parseFloat(this.$rails.css("border-width"))) / 2,
            outer_radius: this.$rails.width() / 2 + parseFloat(this.$rails.css("border-width"))
        }
        return p
    }

    get_coords_on_border = function(angle, outer = false) {
        /* Given the angle, get the coordinates on the rails
         *
         * It should be different for each shape of the rails. Maybe I 
         * should create another class, one for each shape of the rails, 
         * and use its methods.
         */
        var x = (outer ? this.border_shape_params.outer_radius : this.border_shape_params.radius) * Math.cos(angle - Math.PI / 2) + this.border_shape_params.rel_center.x
        var y = (outer ? this.border_shape_params.outer_radius : this.border_shape_params.radius) * Math.sin(angle - Math.PI / 2) + this.border_shape_params.rel_center.y
        return [x, y]
    }

    get_rotation_on_border = function(angle) {
        /* Given the angle, return the rotation on the border */
        return angle
    }

    get_slider_value = function(angle) {
        /* Given an angle, return the closest admissible value, given 
         * the step */
        var value = angle * (this.config.max - this.config.min) / (2 * Math.PI)
        if (this.config.step === null)
            return value
        return this.config.step * Math.round(value / this.config.step)
    }

    get_angle_from_page_coords = function(x, y) {
        /* Given the coordinates of a point in the document, get the 
         * angle
         */
        var angle = Math.PI/2 + Math.atan((y - this.border_shape_params.abs_center.y) / (x - this.border_shape_params.abs_center.x))
        if (x < this.border_shape_params.abs_center.x)
            angle = angle + Math.PI
        return angle
    }

    value2angle = function(value) {
        /* Given a value, return the corresponding angle */
        return 2 * Math.PI * value / (this.config.max - this.config.min)
    }

    adjust_angle = function(angle) {
        /* Make sure that the angle is safe and sound
         *
         * First, when dragging the bar it may happen that angle < 0 or 
         * angle > 2pi because of the slice, so we correct this. Second, 
         * if we have a step, we make sure that the angle is allowed.
         */
        if (angle < 0)
            angle = 2 * Math.PI + angle
        if (angle > 2 * Math.PI)
            angle = angle - 2 * Math.PI
        if (this.config.step === null)
            return angle
        return this.value2angle(this.get_slider_value(angle))
    }

    update_slider = function(angle_from, angle_to) {
        angle_from = this.adjust_angle(angle_from)
        angle_to = this.adjust_angle(angle_to)
        var coord_from = this.get_coords_on_border(angle_from)
        var coord_to = this.get_coords_on_border(angle_to)
        var bars_colors = this.get_bar_border_colors(angle_from, angle_to, this.$bar.css("border-top-color"))
        this.hide_conflicting_labels(angle_from, angle_to)
        this.update_labels(angle_from, angle_to)
        this.$handle_from.css({
            "left": coord_from[0],
            "top": coord_from[1],
            "transform": "translate(-50%, -50%) rotate(" + angle_from + "rad)"
        })
        this.$handle_to.css({
            "left": coord_to[0],
            "top": coord_to[1],
            "transform": "translate(-50%, -50%) rotate(" + angle_to + "rad)"
        })
        this.$bar.css({
            "border-color": bars_colors[0],
            "transform": "rotate(" + (angle_from + Math.PI/4) + "rad)"
        })
        this.$bar_cover.css({
            "border-color": this.$rails.css("border-color") + "transparent transparent transparent",
            "transform": "rotate(" + (angle_to + Math.PI/4) + "rad)"
        })
        this.$bar_cover_cover.css({
            "border-color": bars_colors[1],
            "transform": "rotate(" + (angle_from + Math.PI/4) + "rad)"
        })
        this.angle_from = angle_from
        this.angle_to = angle_to
        this.$input.val(this.get_value())
    }

    update_labels = function(angle_from, angle_to, between = Math.PI / 20, sep) {
        if (sep === undefined)
            sep = this.config.values_sep
        var coord_from = this.get_coords_on_border(angle_from, true)
        var coord_to = this.get_coords_on_border(angle_to, true)
        if (CircularSlider.angular_dist(angle_from, angle_to) >= between) {
            this.$label_from.show()
            this.$label_to.show()
            this.$label_from_to.hide()
            this.$label_from.css({
                "left": coord_from[0],
                "top": coord_from[1],
                "transform": "translate(-50%, -100%) rotate(" + angle_from + "rad)"
            })
            this.$label_from.html(this.config.prefix + this.format_label(this.get_slider_value(angle_from)) + this.config.postfix)
            this.$label_to.css({
                "left": coord_to[0],
                "top": coord_to[1],
                "transform": "translate(-50%, -100%) rotate(" + angle_to + "rad)"
            })
            this.$label_to.html(this.config.prefix + this.format_label(this.get_slider_value(angle_to)) + this.config.postfix)
        } else {
            this.$label_from.hide()
            this.$label_to.hide()
            this.$label_from_to.show()
            this.$label_from_to.css({
                "left": (coord_from[0] + coord_to[0]) / 2,
                "top": (coord_from[1] + coord_to[1]) / 2,
                "transform": "translate(-50%, -100%) rotate(" + (CircularSlider.arc_length(angle_from, angle_to) <= Math.PI ? (angle_from + CircularSlider.angular_dist(angle_from, angle_to) / 2) : (angle_from - CircularSlider.angular_dist(angle_from, angle_to))) + "rad)"
            })
            this.$label_from_to.html(this.config.prefix + this.format_label(this.get_slider_value(angle_from)) + sep + this.format_label(this.get_slider_value(angle_to)) + this.config.postfix)
        }
    }

    update_ruler = function(n_breaks, major_breaks_every) {
        this.$ruler.html("")
        for (var i = 0; i < n_breaks; i++) {
            var angle_tick = this.adjust_angle(i * 2 * Math.PI / n_breaks)
            var coord_tick = this.get_coords_on_border(angle_tick, true)
            $('<span class="cisl-tick-minor cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)"></span>').appendTo(this.$ruler)
            if (i % major_breaks_every == 0) {
                $('<span class="cisl-tick-major cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)"></span>').appendTo(this.$ruler)
                $('<span class="cisl-break-major cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)">' + this.format_label(this.get_slider_value(angle_tick)) + '</span>').appendTo(this.$ruler)
            }
        }
    }

    hide_conflicting_labels = function(angle_from, angle_to, between = Math.PI / 20) {
        var outer_this = this
        this.$ruler.children(".cisl-break-major").each(function(i, e) {
            if (CircularSlider.angular_dist(angle_from, outer_this.value2angle(parseFloat($(this).html()))) < between || CircularSlider.angular_dist(angle_to, outer_this.value2angle(parseFloat($(this).html()))) < between)
                $(this).hide()
            else
                $(this).show()
        })
    }

    get_value = function(sep) {
        if (sep === undefined)
            sep = this.config.values_sep
        return this.get_slider_value(this.angle_from) + sep + this.get_slider_value(this.angle_to)
    }

    format_label = function(n) {
        return Math.trunc(n * Math.pow(10, this.config.digits)) / Math.pow(10, this.config.digits)
    }

    get_bar_border_colors = function(angle_from, angle_to, official_color) {
        var bar_border_colors = ""
        var bar_cover_cover_border_colors = "transparent"
        var lengths = CircularSlider.arc_length(angle_from, angle_to) / (Math.PI / 2)
        if (lengths <= 1) {
            bar_border_colors = official_color + " transparent transparent transparent"
        } else if (lengths <= 2) {
            bar_border_colors = official_color + " " + official_color + " transparent transparent"
        } else if (lengths <= 3) {
            bar_border_colors = official_color + " " + official_color + " " + official_color + " transparent"
        } else {
            bar_border_colors = official_color + " " + official_color + " " + official_color + " " + official_color
            bar_cover_cover_border_colors = official_color + " transparent transparent transparent"
        }
        return [bar_border_colors, bar_cover_cover_border_colors]
    }

    static validate_config = function(config) {
        /* Validate the config
         *
         * Check the config values and either fix them with a warning or 
         * throw an error.
         */
        if ((config.max - config.min) / config.step < 3) {
            throw Error("Not enough steps: at least three are required; either increase the range of the slider or decrease the step size.")
        }
        return config
    }

    static angular_dist = function(a, b) {
        return Math.min(Math.abs(b - a), Math.abs(b - (a + 2 * Math.PI)), Math.abs((b + 2 * Math.PI) - a))
    }

    static arc_length = function(from, to) {
        if (from > to)
            from = -(2 * Math.PI - from)
        return to - from
    }

    static normalise_angle = function(from, to) {
        return from > to ? -(2 * Math.PI - from) : from
    }
}
