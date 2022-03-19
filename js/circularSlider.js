class CircularSlider {
    constructor(id) {
        id = "#" + id.replace(/^#/, "");
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

        this.$input = $(id);
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

        // Draw the ruler
        this.ruler_min = 0
        this.ruler_max = 6 * Math.PI
        this.ruler_step = Math.PI / 59.5 // can be null, in which case we've got a continuous slider
        this.ruler_nbreaks = 20
        this.ruler_mbreaks = 3
        this.ruler_digits = 2 // decimal places in the breaks
        // TODO validate: at least 3 steps
        // this.ruler_offset = 0 // XXX config: Initial rotation of the ruler
        this.update_ruler()

        // Set the positions of the moving parts
        this.angle_from = null
        this.angle_to = null
        this.update_slider(0, Math.PI/3) // XXX config: initial positions

        // Bind the events
        // TODO onclick, move the closest handle towards the clicked 
        // point.
        $(cisl_id + " .cisl-to," + cisl_id + " .cisl-label-to").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            $(cisl_id + " .cisl-to").focus()
            $(window).on("mouseup touchend", function(e_up) {
                $(window).off("mousemove touchmove")
            })
            $(window).on("mousemove touchmove", function(e_move) {
                var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                var angle_to = this.get_rails_angle(pageX, pageY)
                this.update_slider(this.angle_from, angle_to)
            }.bind(this))
        }.bind(this))
        $(cisl_id + " .cisl-from," + cisl_id + " .cisl-label-from").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            $(cisl_id + " .cisl-from").focus()
            $(window).on("mouseup touchend", function(e_up) {
                $(window).off("mousemove touchmove")
            })
            $(window).on("mousemove touchmove", function(e_move) {
                var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                var angle_from = this.get_rails_angle(pageX, pageY)
                this.update_slider(angle_from, this.angle_to)
            }.bind(this))
        }.bind(this))
        $(cisl_id + " .cisl-bar-cover-cover," + cisl_id + " .cisl-label-from-to").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            $(cisl_id + " .cisl-bar-cover-cover").focus()
            var pageX = e_down.pageX || e_down.originalEvent.touches[0].pageX
            var pageY = e_down.pageY || e_down.originalEvent.touches[0].pageY
            var angle_down = CircularSlider.normalise_angle(this.get_rails_angle(pageX, pageY), this.angle_to)
            var angle_from_down = CircularSlider.normalise_angle(this.angle_from, this.angle_to)
            var angle_to_down = this.angle_to
            if (angle_from_down < angle_down && angle_down < angle_to_down) {
                var slice_from = angle_down - angle_from_down
                var slice_to = angle_to_down - angle_down
                $(window).on("mouseup touchend", function(e_up) {
                    $(window).off("mousemove touchmove")
                })
                $(window).on("mousemove touchmove", function(e_move) {
                    var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                    var angle_from = this.get_rails_angle(pageX, pageY) - slice_from
                    var angle_to = this.get_rails_angle(pageX, pageY) + slice_to
                    this.update_slider(angle_from, angle_to)
                }.bind(this))
            }
        }.bind(this))
        $(cisl_id + " .cisl-to").on("keydown", function(e_press) {
            if (e_press.which == 39) {
                var modifier = 1
                if (e_press.shiftKey)
                    modifier = 10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from, this.angle_to + modifier * Math.PI / 50) // advance 1 percent
                else
                    this.update_slider(this.angle_from, this.angle_to + this.value2angle(modifier * this.ruler_step))
            } else if (e_press.which == 37) {
                var modifier = -1
                if (e_press.shiftKey)
                    modifier = -10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from, this.angle_to + modifier * Math.PI / 50) // advance 1 percent
                else
                    this.update_slider(this.angle_from, this.angle_to + this.value2angle(modifier * this.ruler_step))
            }
        }.bind(this))
        $(cisl_id + " .cisl-from").on("keydown", function(e_press) {
            if (e_press.which == 39) {
                var modifier = 1
                if (e_press.shiftKey)
                    modifier = 10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from + modifier * Math.PI / 50, this.angle_to) // advance 1 percent
                else
                    this.update_slider(this.angle_from + this.value2angle(modifier * this.ruler_step), this.angle_to)
            } else if (e_press.which == 37) {
                var modifier = -1
                if (e_press.shiftKey)
                    modifier = -10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from + modifier * Math.PI / 50, this.angle_to)
                else
                    this.update_slider(this.angle_from + this.value2angle(modifier * this.ruler_step), this.angle_to)
            }
        }.bind(this))
        $(cisl_id + " .cisl-bar-cover-cover").on("keydown", function(e_press) {
            if (e_press.which == 39) {
                var modifier = 1
                if (e_press.shiftKey)
                    modifier = 10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from + modifier * Math.PI / 50, this.angle_to + modifier * Math.PI / 50) // advance 1 percent
                else
                    this.update_slider(this.angle_from + this.value2angle(modifier * this.ruler_step), this.angle_to + this.value2angle(modifier * this.ruler_step))
            } else if (e_press.which == 37) {
                var modifier = -1
                if (e_press.shiftKey)
                    modifier = -10
                if (this.ruler_step === null)
                    this.update_slider(this.angle_from + modifier * Math.PI / 50, this.angle_to + modifier * Math.PI / 50) // advance 1 percent
                else
                    this.update_slider(this.angle_from + this.value2angle(modifier * this.ruler_step), this.angle_to + this.value2angle(modifier * this.ruler_step))
            }
        }.bind(this))
    }

    get_rails_params = function() {
        /* Get the relevant parameters for the rails
         *
         * In case of circular rails, we'd need the center and radius; 
         * for elliptical rails, the center and the axes; and so on.
         */
        var p = {
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

    get_rails_coords = function(angle, outer = false) {
        /* Given the angle, get the coordinates on the rails
         *
         * It should be different for each shape of the rails. Maybe I 
         * should create another class, one for each shape of the rails, 
         * and use its methods.
         */
        // TODO: cache the params
        var p = this.get_rails_params()
        var x = (outer ? p.outer_radius : p.radius) * Math.cos(angle - Math.PI / 2) + p.rel_center.x
        var y = (outer ? p.outer_radius : p.radius) * Math.sin(angle - Math.PI / 2) + p.rel_center.y
        return [x, y]
    }

    get_rails_angle = function(x, y) {
        /* Given the coordinates of a point in the document, get the 
         * angle
         */
        var p = this.get_rails_params()
        var angle = Math.PI/2 + Math.atan((y - p.abs_center.y) / (x - p.abs_center.x))
        if (x < p.abs_center.x)
            angle = angle + Math.PI
        return angle
    }

    angle2value = function(angle) {
        /* Given an angle, return the closest admissible value, given 
         * the step */
        var value = angle * (this.ruler_max - this.ruler_min) / (2 * Math.PI)
        if (this.ruler_step === null)
            return value
        return this.ruler_step * Math.round(value / this.ruler_step)
    }

    value2angle = function(value) {
        /* Given a value, return the corresponding angle */
        return 2 * Math.PI * value / (this.ruler_max - this.ruler_min)
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
        if (this.ruler_step === null)
            return angle
        return this.value2angle(this.angle2value(angle))
    }

    update_slider = function(angle_from, angle_to) {
        angle_from = this.adjust_angle(angle_from)
        angle_to = this.adjust_angle(angle_to)
        var coord_from = this.get_rails_coords(angle_from)
        var coord_to = this.get_rails_coords(angle_to)
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
    }

    update_labels = function(angle_from, angle_to, between = Math.PI / 20, sep = ":") {
        var coord_from = this.get_rails_coords(angle_from, true)
        var coord_to = this.get_rails_coords(angle_to, true)
        if (CircularSlider.angular_dist(angle_from, angle_to) >= between) {
            this.$label_from.show()
            this.$label_to.show()
            this.$label_from_to.hide()
            this.$label_from.css({
                "left": coord_from[0],
                "top": coord_from[1],
                "transform": "translate(-50%, -100%) rotate(" + angle_from + "rad)"
            })
            this.$label_from.html(this.format_label(this.angle2value(angle_from)))
            this.$label_to.css({
                "left": coord_to[0],
                "top": coord_to[1],
                "transform": "translate(-50%, -100%) rotate(" + angle_to + "rad)"
            })
            this.$label_to.html(this.format_label(this.angle2value(angle_to)))
        } else {
            this.$label_from.hide()
            this.$label_to.hide()
            this.$label_from_to.show()
            this.$label_from_to.css({
                "left": (coord_from[0] + coord_to[0]) / 2,
                "top": (coord_from[1] + coord_to[1]) / 2,
                "transform": "translate(-50%, -100%) rotate(" + (CircularSlider.arc_length(angle_from, angle_to) <= Math.PI ? (angle_from + CircularSlider.angular_dist(angle_from, angle_to) / 2) : (angle_from - CircularSlider.angular_dist(angle_from, angle_to))) + "rad)"
            })
            this.$label_from_to.html(this.format_label(this.angle2value(angle_from)) + sep + this.format_label(this.angle2value(angle_to)))
        }
    }

    update_ruler = function() {
        this.$ruler.html("")
        for (var i = 0; i < this.ruler_nbreaks; i++) {
            var angle_tick = this.adjust_angle(i * 2 * Math.PI / this.ruler_nbreaks)
            var coord_tick = this.get_rails_coords(angle_tick, true)
            $('<span class="cisl-tick-minor cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)"></span>').appendTo(this.$ruler)
            if (i % this.ruler_mbreaks == 0) {
                $('<span class="cisl-tick-major cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)"></span>').appendTo(this.$ruler)
                $('<span class="cisl-break-major cisl--style" style="left: ' + coord_tick[0] + '; top: ' + coord_tick[1] + '; transform: translate(-50%, -100%) rotate(' + angle_tick + 'rad)">' + this.format_label(this.angle2value(angle_tick)) + '</span>').appendTo(this.$ruler)
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

    get_value = function(sep = ":") { // XXX config: sep
        return this.angle2value(this.angle_from) + sep + this.angle2value(this.angle_to)
    }

    format_label = function(n) {
        return Math.trunc(n * Math.pow(10, this.ruler_digits)) / Math.pow(10, this.ruler_digits)
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
