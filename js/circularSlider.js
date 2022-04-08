(function(window, document, $) {

var plugin_count = 0

var create_tick = function(x, y, angle, cl, inside = false) {
    /* create_tick
     *
     * JQuery cannot handle SVG directly because SVG elements lie in a 
     * different namespace than HTML elements. Therefore, we need to 
     * create SVG elements first, and then append them. This function 
     * creates ticks.
     */
    if (inside) {
        angle += Math.PI
    }
    var t = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    t.setAttributeNS(null, "class", cl)
    t.setAttributeNS(null, "x", x)
    t.setAttributeNS(null, "y", y)
    t.setAttributeNS(null, "style", "transform: translate(-50%, -100%) rotate(" + angle + "rad)")
    return $(t)
}

var create_break = function(x, y, angle, cl, text) {
    /* create_break
     *
     * JQuery cannot handle SVG directly because SVG elements lie in a 
     * different namespace than HTML elements. Therefore, we need to 
     * create SVG elements first, and then append them. This function 
     * creates breaks.
     */
    var t = document.createElementNS("http://www.w3.org/2000/svg", "text")
    t.setAttributeNS(null, "class", cl)
    t.setAttributeNS(null, "x", x)
    t.setAttributeNS(null, "y", y)
    t.setAttributeNS(null, "style", "transform: rotate(" + angle + "rad)")
    t.appendChild(document.createTextNode(text))
    return $(t)
}

var angular_dist = function(a, b) {
    /* Compute the distance between two angles */
    return Math.min(Math.abs(b - a), Math.abs(b - (a + 2 * Math.PI)), Math.abs((b + 2 * Math.PI) - a))
}

var arc_length = function(from, to) {
    /* Compute the length of an arc */
    if (from > to)
        from = -(2 * Math.PI - from)
    return to - from
}

var parse_length = function(length, viewport) {
    /* Convert a CSS length to px
     *
     * Based on the following documents:
     * https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units
     * https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width
     * https://www.w3.org/TR/SVG2/coords.html
     *
     * In particular, for percentages, the stroke-width is computed with 
     * respect to the normalised diagonal length of the viewport. The 
     * normalised diagonal is the diagonal divided by sqrt(2).
     *
     * Conversion factors have been precomputed.
     */
    if (typeof(length) == "number")
        return length
    else if (typeof(length) != "string") {
        console.warn("The length should be either a number or a string, not a" + typeof(length))
        return undefined
    }
    var value = parseFloat(length)
    var unit = length.replace(value, "")
    if (unit == "") // assume it's already in px
        return value
    var px = undefined
    switch (unit) {
        case "cm":
            px = value / 37.8
            break
        case "mm":
            px = value / 3.78
            break
        case "Q":
            px = value / 0.945
            break
        case "in":
            px = value / 96.012
            break
        case "pc":
            px = value / 16.002
            break
        case "pt":
            px = value / 1.3335
            break
        case "px":
            px = value
            break
        case "%":
            if (viewport === undefined) {
                console.warn("You have to provide the viewport as an argument when the length is a percentage.")
                break
            }
            px = value / 100 * Math.sqrt(viewport.width.baseVal.value**2 + viewport.height.baseVal.value**2) / Math.sqrt(2)
            break
        default:
            console.warn("The unit" + unit + "could not be recognised.")
    }
    return px
}

class CircularSlider {
    /* CircularSlider
     *
     * Design improvements for the future:
     * - Use JQuery's event delegation
     * - Add classes cisl-event-*
     * - Add a method to update the config dynamically
     */
    constructor(input, options = {}, plugin_count) {
        this.$input = $(input)
        this.$input.hide()

        // User configuration
        var config = {
            height: 600,
            width: 600,
            min: 0,
            max: 2 * Math.PI,
            from: 0, // initial values for from and to
            to: Math.PI / 4,
            step: (2 * Math.PI) / 50, // DOC: can be null, in which case we've got a continuous slider
            breaks_n: 60,
            major_breaks_every: 5, // put a major break (and a label) every x minor breaks
            breaks_altitude: 30, // recommended: width / 20
            ruler_inside: true, // whether the ruler should be drawn inside the circle
            labels_altitude: 10, // recommended: breaks_altitude - 5
            digits: 2, // how many digits should labels and breaks have
            prefix: "",
            postfix: "",
            values_sep: ":"
        }
        var data_config = {
            height: this.$input.data("height"),
            width: this.$input.data("width"),
            min: this.$input.data("min"),
            max: this.$input.data("max"),
            from: this.$input.data("from"),
            to: this.$input.data("to"),
            step: this.$input.data("step"),
            breaks_n: this.$input.data("breaks-n"),
            major_breaks_every: this.$input.data("major-breaks-every"),
            breaks_altitude: this.$input.data("breaks-altitude"),
            ruler_inside: this.$input.data("ruler-inside"),
            labels_altitude: this.$input.data("labels-altitude"),
            digits: this.$input.data("digits"),
            prefix: this.$input.data("prefix"),
            postfix: this.$input.data("postfix"),
            values_sep: this.$input.data("values-sep")
        }
        for (var prop in data_config) {
            if (data_config.hasOwnProperty(prop) && (data_config[prop] === undefined || data_config[prop] === "")) {
                delete data_config[prop]
            }
        }
        $.extend(config, data_config)
        $.extend(config, options)
        this.config = CircularSlider.validate_config(config)

        // TODO: allow for initial rotation of the ruler
        var cisl_id = "#cisl-"
        if (this.$input.attr("id") != undefined && this.$input.attr("id") != "") {
            cisl_id += this.$input.attr("id")
        } else if (this.$input.data("input-id") != undefined && this.$input.data("input-id") != "") {
            cisl_id += this.$input.data("input-id")
        } else {
            cisl_id += plugin_count
        }
        this.cisl_id = cisl_id
        this.draw_slider()

        // Set the positions of the moving parts
        this.angle_from = null
        this.angle_to = null
        this.update_slider_value(this.config.from, this.config.to)

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
                $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label").not(".cisl-label-from-to").off("mousemove touchmove mouseup touchend")
                if (typeof this.onFinish === "function") {
                    this.onFinish()
                }
            }.bind(this))
            $(window).on("mousemove touchmove", function(e_move) {
                if (e_move.pageX == 0 && e_move.originalEvent.touches === undefined) {
                    var pageX = 0
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                } else {
                    var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                }
                var new_angle = this.get_angle_from_page_coords(pageX, pageY)
                if ($(e_down.target).hasClass("cisl-handle-to") || $(e_down.target).hasClass("cisl-label-to")) {
                    this.update_slider(this.angle_from, new_angle)
                } else if ($(e_down.target).hasClass("cisl-handle-from") || $(e_down.target).hasClass("cisl-label-from")) {
                    this.update_slider(new_angle, this.angle_to)
                }
            }.bind(this))
        }.bind(this))
        $(cisl_id + " .cisl-rails," + cisl_id + " .cisl-bar," + cisl_id + " .cisl-label-from-to").on("mousedown touchstart", function(e_down) {
            e_down.preventDefault()
            var pageX = e_down.pageX || e_down.originalEvent.touches[0].pageX
            var pageY = e_down.pageY || e_down.originalEvent.touches[0].pageY
            var angle_down = this.get_angle_from_page_coords(pageX, pageY)
            var angle_from_down = this.angle_from
            var angle_to_down = this.angle_to
            var slice_from = arc_length(angle_from_down, angle_down)
            var slice_to = arc_length(angle_down, angle_to_down)
            $(e_down.target).focus()
            if (typeof this.onStart === "function") {
                this.onStart()
            }
            $(window).on("mouseup touchend", function(e_up) {
                $(cisl_id + " .cisl-rails," + cisl_id + " .cisl-bar," + cisl_id + " .cisl-label-from-to").off("mousemove touchmove mouseup touchend")
                if (typeof this.onFinish === "function") {
                    this.onFinish()
                }
            }.bind(this))
            $(window).on("mousemove touchmove", function(e_move) {
                if (e_move.pageX == 0 && e_move.originalEvent.touches === undefined) {
                    var pageX = 0
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                } else {
                    var pageX = e_move.pageX || e_move.originalEvent.touches[0].pageX
                    var pageY = e_move.pageY || e_move.originalEvent.touches[0].pageY
                }
                var angle_from = this.get_angle_from_page_coords(pageX, pageY) - slice_from
                var angle_to = this.get_angle_from_page_coords(pageX, pageY) + slice_to
                this.update_slider(angle_from, angle_to)
            }.bind(this))
        }.bind(this))
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label," + cisl_id + " .cisl-bar").on("keydown", function(e_press) {
            e_press.preventDefault()
            var scale = false // whether to move (false) or to expand/contract (true)
            switch (e_press.which) {
                case 38: // up
                    scale = true
                case 37: // left
                    var weight = -1
                    break
                case 40: // down
                    scale = true
                case 39: // right
                    var weight = 1
                    break
                default:
                    return
            }
            if (e_press.shiftKey) {
                weight *= 10
            }
            if (this.config.step === null) {
                weight *= Math.PI / 50 // advance 1 or 10 percent
            } else if (e_press.ctrlKey) {
                weight = arc_length(this.value2angle(this.config.min), this.value2angle(this.config.min + weight * this.config.step)) // advance 1 or 10 steps
            }
            if (typeof this.onStart === "function") {
                this.onStart()
            }
            if ($(e_press.target).hasClass("cisl-handle-to") || $(e_press.target).hasClass("cisl-label-to")) {
                this.update_slider(this.angle_from, this.angle_to + weight)
            } else if ($(e_press.target).hasClass("cisl-handle-from") || $(e_press.target).hasClass("cisl-label-from")) {
                this.update_slider(this.angle_from + weight, this.angle_to)
            } else if ($(e_press.target).hasClass("cisl-bar") || $(e_press.target).hasClass("cisl-label-from-to")) {
                if (scale)
                    this.update_slider(this.angle_from - weight, this.angle_to + weight)
                else
                    this.update_slider(this.angle_from + weight, this.angle_to + weight)
            }
            if (typeof this.onFinish === "function") {
                this.onFinish()
            }
        }.bind(this))
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-bar," + cisl_id + " .cisl-rails").on("wheel", function(e_wheel) {
            e_wheel.preventDefault()
            var weight = 0.01 * e_wheel.originalEvent.deltaY
            if (typeof this.onStart === "function") {
                this.onStart()
            }
            this.update_slider(this.angle_from - weight * Math.PI / 50, this.angle_to + weight * Math.PI / 50) // zoom in/out 1 percent
            if (typeof this.onFinish === "function") {
                this.onFinish()
            }
        }.bind(this))

        // Detect resizes
        $(window).resize(function() {
            $(cisl_id + " .cisl-tick-major").remove()
            $(cisl_id + " .cisl-tick-minor").remove()
            $(cisl_id + " .cisl-break-major").remove()
            this.border_shape_params = this.get_border_shape_params()
            this.draw_ruler()
            this.update_slider(this.angle_from, this.angle_to)
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
                x: this.$container.offset().left + this.$rails[0].cx.baseVal.value,
                y: this.$container.offset().top + this.$rails[0].cx.baseVal.value
            },
            rel_center: {
                /* Center relative to the container */
                x: this.$rails[0].cx.baseVal.value,
                y: this.$rails[0].cx.baseVal.value
            },
            // TODO: parse units and convert to px
            radius: this.$rails[0].r.baseVal.value,
            border_width: parse_length(this.$rails_border.css("stroke-width"), this.$rails_border[0].viewportElement)
        }
        return p
    }

    get_coords_on_border = function(angle, altitude = 0) {
        /* Given the angle, get the coordinates on the rails
         *
         * It should be different for each shape of the rails. Maybe I 
         * should create another class, one for each shape of the rails, 
         * and use its methods.
         */
        var x = (this.border_shape_params.radius + altitude) * Math.cos(angle - Math.PI / 2) + this.border_shape_params.rel_center.x
        var y = (this.border_shape_params.radius + altitude) * Math.sin(angle - Math.PI / 2) + this.border_shape_params.rel_center.y
        return [x, y]
    }

    get_rotation_on_border = function(angle) {
        /* Given the angle, return the rotation on the border */
        return angle
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

    angle2value = function(angle) {
        /* Given an angle, return the closest admissible value, given 
         * the step */
        var value = this.config.min + angle * (this.config.max - this.config.min) / (2 * Math.PI)
        if (this.config.step === null)
            return value
        return this.config.step * Math.round(value / this.config.step)
    }

    value2angle = function(value) {
        /* Given a value, return the corresponding angle */
        return 2 * Math.PI * (value - this.config.min) / (this.config.max - this.config.min)
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
        return this.value2angle(this.angle2value(angle))
    }

    draw_slider = function() {
        var cisl_id = this.cisl_id
        this.$input.after(
            '<svg id=' + cisl_id.replace(/^#/, "") + ' class="cisl-container" height=' + this.config.height + ' width=' + this.config.width + '>' +
            '<foreignObject width=100% height=100%>' +
            '<span class="cisl-label cisl-label-from cisl--style"></span>' +
            '<span class="cisl-label cisl-label-to cisl--style"></span>' +
            '<span class="cisl-label cisl-label-from-to cisl--style"></span>' +
            '</foreignObject>' +
            '<defs>' +
            '<linearGradient id="cisl-gradient" x2="0" y2="1">' +
                '<stop offset="-50%" stop-color="#dedede" />' +
                '<stop offset="150%" stop-color="#fff" />' +
            '</linearGradient>' +
            '</defs>' +
            '<circle class="cisl-rails-border cisl--style" ' +
                'cx=50% cy=50% r=38% fill="transparent">' +
            '</circle>' +
            '<circle class="cisl-rails cisl--style" ' +
                'cx=50% cy=50% r=38% fill="transparent">' +
            '</circle>' +
            '<path class="cisl-bar cisl--style" fill="transparent" tabindex="3" />' +
            '<rect class="cisl-handle cisl-handle-from cisl--style" tabindex="1" />' +
            '<rect class="cisl-handle cisl-handle-to cisl--style" tabindex="2" />' +
            '</svg>'
        )
        // Store the slider elements
        this.$container = $(cisl_id)
        this.$rails = $(cisl_id + " .cisl-rails")
        this.$rails_border = $(cisl_id + " .cisl-rails-border")
        this.$ruler = $(cisl_id + " .cisl-ruler")
        this.$bar = $(cisl_id + " .cisl-bar")
        this.$handle_from = $(cisl_id + " .cisl-handle-from")
        this.$handle_to = $(cisl_id + " .cisl-handle-to")
        this.$label_from = $(cisl_id + " .cisl-label-from")
        this.$label_to = $(cisl_id + " .cisl-label-to")
        this.$label_from_to = $(cisl_id + " .cisl-label-from-to")
        // Store the border params
        this.border_shape_params = this.get_border_shape_params()
        // Draw the ruler
        this.draw_ruler()
    }

    draw_ruler = function() {
        var inside = this.config.ruler_inside
        var breaks_altitude = inside ? -this.config.breaks_altitude : this.config.breaks_altitude
        var angle_tick = this.adjust_angle(0)
        var coord_tick = this.get_coords_on_border(angle_tick, (1 - 2 * inside) * this.border_shape_params.border_width / 2)
        var first_tick = create_tick(coord_tick[0], coord_tick[1], angle_tick, "cisl-tick-major cisl--style", inside).insertBefore(this.$rails_border)
        var coord_break = this.get_coords_on_border(angle_tick, breaks_altitude)
        create_break(coord_break[0], coord_break[1], angle_tick, "cisl-break-major cisl--style", this.format_label(this.angle2value(angle_tick))).insertBefore(this.$rails_border)
        for (var i = 1; i < this.config.breaks_n; i++) {
            angle_tick = this.adjust_angle(i * 2 * Math.PI / this.config.breaks_n)
            coord_tick = this.get_coords_on_border(angle_tick, (1 - 2 * inside) * this.border_shape_params.border_width / 2)
            coord_break = this.get_coords_on_border(angle_tick, breaks_altitude)
            if (i % this.config.major_breaks_every == 0) {
                create_tick(coord_tick[0], coord_tick[1], angle_tick, "cisl-tick-major cisl--style", inside).insertBefore(this.$rails_border)
                create_break(coord_break[0], coord_break[1], angle_tick, "cisl-break-major cisl--style", this.format_label(this.angle2value(angle_tick))).insertBefore(this.$rails_border)
            } else {
                create_tick(coord_tick[0], coord_tick[1], angle_tick, "cisl-tick-minor cisl--style", inside).insertBefore(this.$rails_border)
            }
        }
    }

    update_slider_value = function(value_from, value_to) {
        return this.update_slider(this.value2angle(value_from), this.value2angle(value_to))
    }

    update_slider = function(angle_from, angle_to) {
        angle_from = this.adjust_angle(angle_from)
        angle_to = this.adjust_angle(angle_to)
        var coord_from = this.get_coords_on_border(angle_from)
        var coord_to = this.get_coords_on_border(angle_to)
        this.update_handles(coord_from, coord_to, angle_from, angle_to) // put the handles in the correct place
        this.update_bar(coord_from, coord_to, angle_from, angle_to) // put the bar in the correct place
        this.update_labels(angle_from, angle_to) // put the labels in the correct place
        this.angle_from = angle_from
        this.angle_to = angle_to
        this.$input.val(this.get_value_string())
    }

    update_labels = function(angle_from, angle_to, collapse_between = Math.PI / 20, hide_between = Math.PI / 20) {
        if (angular_dist(angle_from, angle_to) >= collapse_between) {
            var coord_from = this.get_coords_on_border(angle_from, this.config.labels_altitude)
            var coord_to = this.get_coords_on_border(angle_to, this.config.labels_altitude)
            this.$label_from.show()
            this.$label_to.show()
            this.$label_from_to.hide()
            this.$label_from.css({
                "left": coord_from[0],
                "top": coord_from[1],
                "transform": "translate(-50%,-100%) rotate(" + angle_from + "rad)"
            })
            this.$label_from.html(this.config.prefix + this.format_label(this.angle2value(angle_from)) + this.config.postfix)
            this.$label_to.css({
                "left": coord_to[0],
                "top": coord_to[1],
                "transform": "translate(-50%,-100%) rotate(" + angle_to + "rad)"
            })
            this.$label_to.html(this.config.prefix + this.format_label(this.angle2value(angle_to)) + this.config.postfix)
            // Hide breaks covered by the labels
            if (!this.config.ruler_inside) {
                var outer_this = this
                this.$container.children(".cisl-break-major").each(function(i, e) {
                    if (angular_dist(angle_from, outer_this.value2angle(parseFloat($(this).html()))) < hide_between || angular_dist(angle_to, outer_this.value2angle(parseFloat($(this).html()))) < hide_between)
                        $(this).hide()
                    else
                        $(this).show()
                })
            }
        } else {
            this.$label_from.hide()
            this.$label_to.hide()
            this.$label_from_to.show()
            var angle_from_to = angle_from + arc_length(angle_from, angle_to) / 2
            var coord_from_to = this.get_coords_on_border(angle_from_to, this.config.labels_altitude)
            this.$label_from_to.css({
                "left": (coord_from_to[0] + coord_from_to[0]) / 2,
                "top": (coord_from_to[1] + coord_from_to[1]) / 2,
                "transform": "translate(-50%,-100%) rotate(" + angle_from_to + "rad)"
            })
            this.$label_from_to.html(this.config.prefix + this.format_label(this.angle2value(angle_from)) + this.config.values_sep + this.format_label(this.angle2value(angle_to)) + this.config.postfix)
            // Hide breaks covered by the labels
            if (!this.config.ruler_inside) {
                var outer_this = this
                if (arc_length(angle_from, angle_to) > Math.PI) {
                    angle_from -= Math.PI
                    angle_to -= Math.PI
                }
                this.$container.children(".cisl-break-major").each(function(i, e) {
                    if (angular_dist(angle_from, outer_this.value2angle(parseFloat($(this).html()))) < 1.5 * hide_between || angular_dist(angle_to, outer_this.value2angle(parseFloat($(this).html()))) < 1.5 * hide_between)
                        $(this).hide()
                    else
                        $(this).show()
                })
            }
        }
    }

    update_handles = function(coord_from, coord_to, angle_from, angle_to) {
        this.$handle_from.attr({
            "x": coord_from[0],
            "y": coord_from[1],
            "style": 'transform: translate(-50%,-50%) rotate(' + angle_from + 'rad)'
        })
        this.$handle_to.attr({
            "x": coord_to[0],
            "y": coord_to[1],
            "style": 'transform: translate(-50%,-50%) rotate(' + angle_to + 'rad)'
        })
    }

    update_bar = function(coord_from, coord_to, angle_from, angle_to) {
        var d = "M " + coord_from[0] + " " + coord_from[1] + " " +
            "A " + this.border_shape_params.radius + " " + this.border_shape_params.radius + " " +
            "0 " + ((arc_length(angle_from, angle_to) <= Math.PI) ? "0 " : "1 ") + "1 " +
            coord_to[0] + " " + coord_to[1] + " " +
            "A " + this.border_shape_params.radius + " " + this.border_shape_params.radius + " " +
            "0 " + ((arc_length(angle_to, angle_from) <= Math.PI) ? "0 " : "1 ") + "1 " +
            coord_from[0] + " " + coord_from[1]
        var dasharray = arc_length(angle_from, angle_to) * this.border_shape_params.radius + " " + 2 * Math.PI * this.border_shape_params.radius
        this.$bar.attr({
            "d": d,
            "stroke-dasharray": dasharray
        })
    }

    remove = function() {
        var cisl_id = this.cisl_id
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label").not(".cisl-label-from-to").off("mousedown touchstart")
        $(cisl_id + " .cisl-rails," + cisl_id + " .cisl-bar," + cisl_id + " .cisl-label-from-to").off("mousedown touchstart")
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-label," + cisl_id + " .cisl-bar").off("keydown")
        $(cisl_id + " .cisl-handle," + cisl_id + " .cisl-bar," + cisl_id + " .cisl-rails").off("wheel")
        this.$input.show()
        $.data(this.$input, "circularSlider", null)
    }

    get_value_string = function() {
        return this.angle2value(this.angle_from) + this.config.values_sep + this.angle2value(this.angle_to)
    }

    get_value_array = function() {
        return [this.angle2value(this.angle_from), this.angle2value(this.angle_to)]
    }

    format_label = function(n) {
        // return Math.trunc(n * Math.pow(10, this.config.digits)) / Math.pow(10, this.config.digits)
        return n.toFixed(this.config.digits)
    }

    static validate_config = function(config) {
        /* Validate the config
         *
         * Check the config values and either fix them with a warning or 
         * throw an error.
         */
        // Check that we have enough steps
        if ((config.max - config.min) / config.step < 3) {
            throw Error("Not enough steps: at least three are required; either increase the range of the slider or decrease the step size.")
        }
        // Check that height == width
        if (config.height != config.width) {
            console.warn("Width cannot be different from height; I'm now setting both to the minimum between them. Please try again when ellipses will be supported.")
            config.height = config.width = Math.min(config.height, config.width)
        }
        return config
    }
}

$.fn.circularSlider = function(options) {
    return this.each(function() {
        if (!$.data(this, "circularSlider")) {
            $.data(this, "circularSlider", new CircularSlider(this, options, plugin_count++))
        }
    })
}

})(window, document, jQuery)
