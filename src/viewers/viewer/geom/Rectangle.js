//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

import Polygon from 'ol/geom/Polygon';
import GeometryLayout from 'ol/geom/GeometryLayout';
import {inherits} from 'ol/util';

/**
 * @classdesc
 * Rectangle is an extension of the built-in ol.geom.Polygon that will allow
 * you to create rectangles within the open layers framework.
 *
 * To be least intrusive and most compatible, we use the next obvious things
 * which is a polygon to represent the rectangle. Note that the given point
 * represents the upper left corner!
 *
 * @constructor
 * @extends {ol.geom.Polygon}
 *
 * @param {number} x the x coordinate of the upper left corner
 * @param {number} y the y coordinate of the upper left corner
 * @param {number} w the width of the rectangle
 * @param {number} h the height of the rectangle
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
const Rectangle = function(x, y, w, h, transform) {
    // preliminary checks: set sensible defaults if violated
    if (typeof x !== 'number') x = 0;
    if (typeof y !== 'number') y = 0;
    if (typeof w !== 'number' || w <= 0) w = 1;
    if (typeof h !== 'number' || h <= 0) h = 1;

    /**
     * the initial coordinates as a flat array
     * @type {Array.<number>}
     * @private
     */
    this.initial_coords_ = null;

    // set the rectangle coordinates
    var coords = [[
        [x, y],
        [x+w, y],
        [x+w, y-h],
        [x, y-h],
        [x, y]
    ]];

    /**
     * the transformation matrix of length 6
     * @type {Array.<number>|null}
     * @private
     */
    this.transform_ =
        ome.ol3.utils.Transform.convertAffineTransformIntoMatrix(transform);

    // call super and hand in our coordinate array
    // goog.base(this, coords, GeometryLayout.XY);
    Polygon.call(this, coords, GeometryLayout.XY);
    this.initial_coords_ =  this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates =
        ome.ol3.utils.Transform.applyTransform(
            this.transform_, this.initial_coords_);
}
inherits(Rectangle, Polygon);

/**
 * Gets the upper left corner coordinates as an array [x,y]
 * @return {Array.<number>} the upper left corner
 */
Rectangle.prototype.getUpperLeftCorner = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return null;

    return [flatCoords[0], flatCoords[1]];
}

/**
 * sets the upper left corner using a coordinate array [x,y]
 *
 * @param {Array.<number>} value upper left corner
 */
Rectangle.prototype.setUpperLeftCorner = function(value) {
    if (!ome.ol3.utils.Misc.isArray(value)) return;
    this.changeRectangle(value[0], value[1]);
}

/**
 * Gets the width of the rectangle
 * @return {number} the width of the rectangle
 */
Rectangle.prototype.getWidth = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return 0;

    return flatCoords[2]-flatCoords[0];
}

/**
 * Sets the width of the rectangle
 *
 * @param {number} value the width of the rectangle
 */
Rectangle.prototype.setWidth = function(value) {
    this.changeRectangle(null,null,value, null);
}

/**
 * Gets the height of the rectangle
 * @return {number} the height of the rectangle
 */
Rectangle.prototype.getHeight = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return 0;

    return Math.abs(flatCoords[5]-flatCoords[3]);
}

/**
 * Sets the height of the rectangle
 *
 * @param {number} value the height of the rectangle
 */
Rectangle.prototype.setHeight = function(value) {
    this.changeRectangle(null,null,null, value);
}

/**
 * Changes the coordinates/dimensions of an existing rectangle.
 * Used internally.
 *
 * @private
 * @param {number} x the x coordinate of the upper left corner
 * @param {number} y the y coordinate of the upper left corner
 * @param {number} w the width of the rectangle
 * @param {number} h the height of the rectangle
 */
Rectangle.prototype.changeRectangle = function(x,y,w,h) {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return;

    if (typeof(x) !== 'number') x = flatCoords[0];
    if (typeof(y) !== 'number') y = flatCoords[1];
    if (typeof(w) !== 'number') w = this.getWidth();
    if (typeof(h) !== 'number') h = this.getHeight();

    var coords = [[
        [x, y],
        [x+w, y],
        [x+w, y-h],
        [x, y-h],
        [x, y]
    ]];
    this.setCoordinates(coords);
}

/**
 * Override translation to take care of possible transformation
 *
 * @private
 */
Rectangle.prototype.translate = function(deltaX, deltaY) {
    // delegate
    if (this.transform_) {
        this.transform_[4] += deltaX;
        this.transform_[5] -= deltaY;
        this.flatCoordinates =
            ome.ol3.utils.Transform.applyTransform(
                this.transform_, this.initial_coords_);
        this.changed();
    } else ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
};

/**
 * Turns the tansformation matrix back into the ome model object
 * @return {Object|null} the ome model transformation
 */
Rectangle.prototype.getTransform = function() {
    if (!ome.ol3.utils.Misc.isArray(this.transform_)) return null;

    return {'@type': "http://www.openmicroscopy.org/Schemas/OME/2016-06#AffineTransform",
            'A00' : this.transform_[0], 'A10' : this.transform_[1],
            'A01' : this.transform_[2], 'A11' : this.transform_[3],
            'A02' : this.transform_[4], 'A12' : this.transform_[5]
    };
}

/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
Rectangle.prototype.getRectangleCoordinates = function() {
    return (
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
    );
}

/**
 * Make a complete copy of the geometry.
 * @return {Rectangle} Clone.
 */
Rectangle.prototype.clone = function() {
    var topLeft = this.getUpperLeftCorner();
    return new Rectangle(
        topLeft[0], topLeft[1], this.getWidth(), this.getHeight(),
        this.getTransform());
};

/**
 * Returns the length of the rectangle
 *
 * @return {number} the length of the rectangle
 */
Rectangle.prototype.getLength = function() {
    return ome.ol3.utils.Regions.getLength(this);
}

export default Rectangle;
