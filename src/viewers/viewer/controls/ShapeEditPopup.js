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

import Overlay from 'ol/Overlay.js';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import {getTopLeft, getTopRight} from 'ol/extent';
import Line from '../geom/Line';
import {isArray,
        sendEventNotification} from '../utils/Misc';
import Ui from '../../../utils/ui';
import {IMAGE_COMMENT_CHANGE, IMAGE_CONFIRM_CHANGE} from "../../../events/events";

/**
 * @classdesc
 * Implements a leaner version of the standard open layers select without an extra
 * layer
 *
 * @extends {ol.interaction.Interaction}
 */
class ShapeEditPopup extends Overlay {
    /**
     * @constructor
     * 
     * @param {source.Regions} regions_reference a reference to Regions
     */
    constructor(regions_reference) {
        var els = document.querySelectorAll('.shape-edit-popup');
        let popup = document.createElement('div');
        popup.className = 'shape-edit-popup';
        popup.innerHTML = `
        <div>
            <div> Class:
                <select id="roiClass">
                    <option value="OTHER" selected>OTHER</option>
                    <option value="ASC-US">ASC-US</option>
                    <option value="ASC-H">ASC-H</option>
                    <option value="LSIL">LSIL</option>
                    <option value="HSIL">HSIL</option>
                    <option value="SCC">SCC</option>
                    <option value="TR">TR</option>
                    <option value="M">M</option>
                    <option value="AM">AM</option>
                    <option value="BV">BV</option>
                    <option value="CMV">CMV</option>
                    <option value="HSV">HSV</option>
                    <option value="IM">IM</option>
                    <option value="S">S</option>
                    <option value="AGC(NSL)-CC">AGC(NSL)-CC</option>
                    <option value="AGC(NSL)-E">AGC(NSL)-E</option>
                    <option value="AGC(NSL)-US">AGC(NSL)-US</option>
                    <option value="AGC(FN)-CC">AGC(FN)-CC</option>
                    <option value="AGC(FN)-US">AGC(FN)-US</option>
                    <option value="AIS-CC">AIS-CC</option>
                    <option value="AIS-E">AIS-E</option>
                    <option value="AIS-OT">AIS-OT</option>
                </select>
            </div>
            <div><input readonly class='shape-popup-coords'/></div>
            <div><input readonly class='shape-popup-area'/></div>
            <div><input readonly class='shape-popup-owner'/></div>
            <div class='hr-popup-confirm'>
                <hr/>
                <button type="button" class='btn btn-primary shape-popup-confirm'>Confirm</button>
            </div>
<!--            enable/disable roi,不需要注释掉-->
<!--            <a href="#" class="shape-edit-popup-closer" class="shape-edit-popup-closer"></a>-->
        </div>`;
        // add flag to the event so that the Hover interaction can ignore it
        popup.onpointermove = function(e) {
            e.isOverShapeEditPopup = true;
        };

        super({
            element: popup,
            insertFirst: false,
            autoPan: false,
        });

        // TODO: Don't need to store all of these!
        this.popup = popup;
        this.regions = regions_reference;
        this.viewer_ = regions_reference.viewer_;
        this.map = regions_reference.viewer_.viewer_;
        // Need to add to map before we can bindListeners() to DOM elements
        this.map.addOverlay(this);

        let curStep=Window.image_info_['curStep'];
        let isAdmin=Window.image_info_['isAdmin'];
        if (isAdmin && curStep==2)
            $('.hr-popup-confirm').css('display','block')
        else
            $('.hr-popup-confirm').css('display','none')

        // this.textInput = this.popup.querySelectorAll('.shape-popup-edit-text')[0];
        this.roiClass = this.popup.querySelectorAll('#roiClass')[0];
        this.coordsInput = this.popup.querySelectorAll('.shape-popup-coords')[0];
        this.areaInput = this.popup.querySelectorAll('.shape-popup-area')[0];
        // this.popupCloser = this.popup.querySelectorAll('.shape-edit-popup-closer')[0];
        this.popupOwner = this.popup.querySelectorAll('.shape-popup-owner')[0];
        this.btnConfirm = this.popup.querySelectorAll('.shape-popup-confirm')[0];
        this.bindListeners(this);
    };

    /**
     * Shows the popup Overlay above the Feature with text & coordinates
     * from the feature.
     *
     * @param {ol.Feature} feature
     */
    showPopupForShape(feature) {
        // Hide any current Hover popup
        this.map.getOverlays().forEach(o => o.setPosition(undefined));
        let text = "";

        let style = feature.getStyle();
        if (typeof(style) === 'function') style = style(1);
        // we can have an array of styles (due to arrows)
        if (isArray(style))
            style = style[0];
        let textStyle = style instanceof Style ? style.getText() : null;
        // For non-labels (not showing text) we need to use 'oldText'
        if (textStyle === null && feature['oldText'] instanceof Text) {
            textStyle = feature['oldText'];
        }
        if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
            text = textStyle.getText();
        }

        // so we know which shape we're editing...
        this.shapeId = feature.getId();

        // this.textInput.value = text;
        this.roiClass.value = text;
        let perms=feature['permissions']
        if (!!perms){
            if (!perms['canEdit'])
                this.roiClass.disabled='disabled'
        }
        // console.log('feature',feature)
        this.popupOwner.value='Owner: ' +feature['owner'];

        // show if feature is visible
        if (this.regions.renderFeature(feature)) {
            this.updatePopupCoordinates(feature.getGeometry());
        }
    }

    /**
     * Updates the Text input value in the Popup if current shapeId is in
     * the list of shape_ids (but doesn't show the popup
     * if it's not already visible);
     *
     * @param {Array} shape_ids List of ['roi:shape'] ids
     */
    updatePopupText(shape_ids, text) {
        if (this.shapeId && shape_ids.indexOf(this.shapeId) > -1) {
            // this.textInput.value = text;
            this.roiClass.value = text;
        }
    }

    /**
     * Update visibility of Popup, according to the current shapeId;
     */
    updatePopupVisibility() {
        if (this.shapeId) {
            let feature = this.regions.getFeatureById(this.shapeId);
            if (feature && this.regions.renderFeature(feature)) {
                this.updatePopupCoordinates(feature.getGeometry());
            } else {
                this.setPosition(undefined);
            }
        }
    }

    /**
     * Hides the popup and clears the shapeId.
     * If shapeId is specified, only hide if this matches current shapeId.
     *
     * @param {string} shapeId Optional: in the form of 'roi:shape' ID
     */
    hideShapeEditPopup(shapeId) {
        if (shapeId === this.shapeId || shapeId === undefined) {
            this.shapeId = undefined;
            this.setPosition(undefined);
        }
    }

    /**
     * When dragging (translating) or modifying we want to update the display
     * and position of the popup.
     *
     * @param {ol.Geometry} geom The shape geometry we're editing
     */
    updatePopupCoordinates(geom) {
        let extent = geom.getExtent();
        let x = (getTopLeft(extent)[0] + getTopRight(extent)[0]) / 2;
        let y = getTopLeft(extent)[1];

        // If it's a Line, popup is on upper end of the line
        if (geom instanceof Line) {
            let coords = geom.getLineCoordinates();
            if (coords[1] < coords[3]) {
                x = coords[2];
            } else if (coords[1] > coords[3]) {
                x = coords[0]
            }
        }

        let coordsText = '';
        if (geom.getDisplayCoords) {
            coordsText = geom.getDisplayCoords()
                .map(kv => `${ kv[0] }: ${ kv[1] }`)
                .join(', ');
        }

        let areaText = "";
        let areaLength = this.regions.getLengthAndAreaForShape(geom);
        if (this.regions.viewer_ && areaLength) {
            let unit = this.regions.viewer_.image_info_['pixel_size']['symbol_x'] || 'px';
            ['Area', 'Length'].forEach(dim => {
                if (areaLength.hasOwnProperty(dim)) {
                    areaText += `${ dim }: ${ areaLength[dim] } ${ unit }${ dim == 'Area' ? '²' : ''}`;
                }
            })
        }
        this.coordsInput.value = coordsText;
        this.areaInput.value = areaText;

        if (this.regions.enable_shape_popup) {
            this.setPosition([x, y]);
        }
    }

    /**
     * Add Listeners for events.
     */
    bindListeners(scope) {
        let inputTimeout;
        // this.textInput.onkeyup = (event) => {
        //
        //     // Use a de-bounce to automatically save when user stops typing
        //     if (inputTimeout) {
        //         clearTimeout(inputTimeout);
        //         inputTimeout = undefined;
        //     }
        //     inputTimeout = setTimeout(() => {
        //         let value = event.target.value;
        //         // Handled by Right panel UI, regions-edit.js
        //         sendEventNotification(
        //             this.viewer_,
        //             "IMAGE_COMMENT_CHANGE",
        //             {
        //                 shapeId: this.shapeId,
        //                 Text: value,
        //             }
        //         );
        //     }, 500);
        // }

        this.roiClass.onchange = (event) => {

            // Use a de-bounce to automatically save when user stops typing
            if (inputTimeout) {
                clearTimeout(inputTimeout);
                inputTimeout = undefined;
            }
            inputTimeout = setTimeout(() => {
                let value = event.target.value;
                // Handled by Right panel UI, regions-edit.js
                sendEventNotification(
                    this.viewer_,
                    "IMAGE_COMMENT_CHANGE",
                    {
                        shapeId: this.shapeId,
                        Text: value,
                    }
                );
            }, 500);
        }

        // let feature = this.regions.getFeatureById(this.shapeId)
        this.btnConfirm.onclick = (event) => {
            let feature = scope.regions.getFeatureById(this.shapeId);
            feature['TheC']=1
            // Handled by Right panel UI, regions-edit.js
            sendEventNotification(
                this.viewer_,
                "IMAGE_CONFIRM_CHANGE",
                {
                    shapeId: this.shapeId
                }
            );
        }

        // this.popupCloser.onclick = (event) => {
        //     this.setPosition(undefined);
        //     event.target.blur();
        //
        //     Ui.showModalMessage(`<p>ROI popups disabled.</p>
        //     <p>To re-enable popups, right-click on the image and use the context menu.</p>`, "OK");
        //
        //     sendEventNotification(
        //         this.viewer_,
        //         "ENABLE_SHAPE_POPUP",
        //         {enable: false}
        //     );
        //     return false;
        // };
    }

    /**
     * Removes listeners added above
     */
    unbindListeners() {
        // this.textInput.onkeyup = null;
        // this.popupCloser.onclick = null;
        this.roiClass.onchange=null;
        this.btnConfirm.onclick=null;
    }

    /**
     * a sort of destructor - remove the overlay from the map
     */
    disposeInternal() {
        this.unbindListeners();
        this.setPosition(undefined);
        this.map.removeOverlay(this);
        this.map = null;
    }
}

export default ShapeEditPopup;
