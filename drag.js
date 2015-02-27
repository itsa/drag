"use strict";

/**
 * Provides `drag and drop` functionality, without dropzones.
 * For `dropzone`-support, you should use the module: `drag-drop`.
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * DD = require('drag')(window);
 * DD.init();
 *
 * @module drag
 * @class DD
 * @since 0.0.4
*/

var NAME = '[drag]: ',
    createHashMap = require('js-ext/extra/hashmap.js').createMap,
    DRAG = 'drag',
    DROP = 'drop',
    DRAGGABLE = DRAG+'gable',
    DEL_DRAGGABLE = 'del-'+DRAGGABLE,
    DD_MINUS = 'dd-',
    DD_DRAGGING_CLASS = DD_MINUS+DRAG+'ging',
    DD_MASTER_CLASS = DD_MINUS+'master',
    DD_HANDLE = DD_MINUS+'handle',
    DD_DROPZONE_MOVABLE = DD_MINUS+'dropzone-movable',
    CONSTRAIN_ATTR = 'constrain-selector',
    MOUSE = 'mouse',
    DROPZONE = 'dropzone',
    NO_TRANS_CLASS = 'el-notrans', // delivered by `vdom`
    HIGH_Z_CLASS = DD_MINUS+'high-z',
    REGEXP_NODE_ID = /^#\S+$/,
    EMITTER = 'emitter',
    DD_EMITTER = DD_MINUS+EMITTER,
    DD_DRAG = DD_MINUS+DRAG,
    DD_DROP = DD_MINUS+DROP,
    DD_FAKE = DD_MINUS+'fake-',
    DOWN = 'down',
    UP = 'up',
    MOVE = 'move',
    MOUSEUP = MOUSE+UP,
    MOUSEDOWN = MOUSE+DOWN,
    MOUSEMOVE = MOUSE+MOVE,
    PAN = 'pan',
    PANSTART = PAN+'start',
    PANMOVE = PAN+MOVE,
    PANEND = PAN+'end',
    DD_FAKE_MOUSEUP = DD_FAKE+MOUSEUP,
    UI = 'UI',
    DD_EFFECT_ALLOWED = DD_MINUS+'effect-allowed',
    BORDER = 'border',
    WIDTH = 'width',
    BORDER_LEFT_WIDTH = BORDER+'-left-'+WIDTH,
    BORDER_TOP_WIDTH = BORDER+'-top-'+WIDTH,
    LEFT = 'left',
    TOP = 'top',
    WINDOW = 'window',
    TRUE = 'true',
    NO_OVERFLOW = 'itsa-no-overflow',
    DD_MINUSDRAGGABLE = DD_MINUS+DRAGGABLE,
    PLUGIN_ATTRS = [DD_MINUS+DROPZONE, CONSTRAIN_ATTR, DD_EMITTER, DD_HANDLE, DD_EFFECT_ALLOWED, DD_DROPZONE_MOVABLE];

require('polyfill');
require('js-ext');
require('./css/drag.css');

module.exports = function (window) {

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

    if (window._ITSAmodules.Drag) {
        return window._ITSAmodules.Drag; // Drag was already created
    }

    var Event = require('event-dom')(window),
        isMobile = require('useragent')(window).isMobile,
        DOCUMENT = window.document,
        bodyNode = DOCUMENT.body,
        supportHammer = !!Event.Hammer,
        mobileEvents = supportHammer && isMobile,
        DD;

    require('vdom')(window);
    require('node-plugin')(window);
    require('window-ext')(window);

    DD = {
        /**
         * Objecthash containing all specific information about the particular drag-cycle.
         * It has a structure like this:
         *
         * ddProps = {
         *     dragNode {HtmlElement} Element that is dragged
         *     x {Number} absolute x-position of the draggable inside `document` when the drag starts
         *     y {Number} absolute y-position of the draggable inside `document` when the drag starts
         *     inlineLeft {String} inline css of the property `left` when drag starts
         *     inlineTop {String} inline css of the property `top` when drag starts
         *     winConstrained {Boolean} whether the draggable should be constrained to `window`
         *     xMouseLast {Number} absolute x-position of the mouse inside `document` when the drag starts
         *     yMouseLast {Number} absolute y-position of the draggable inside `document` when the drag starts
         *     winScrollLeft {Number} the left-scroll of window when drag starts
         *     winScrollTop {Number} the top-scroll of window when drag starts
         *     constrain = { // constrain-properties when constrained to a HtmlElement
         *         xOrig {Number} x-position in the document, included with left-border-width
         *         yOrig {Number} y-position in the document, included with top-border-width
         *         x {Number} xOrig corrected with scroll-left of the constrained node
         *         y {Number} yOrig corrected with scroll-top of the constrained node
         *         w {Number} scrollWidth
         *         h {Number} scrollHeight
         *     };
         *     relatives[{ // Array with objects that represent all draggables that come along with the master-draggable (in case of multiple items), excluded the master draggable itself
         *         sourceNode {HtmlElement} original node (defined by drag-drop)
         *         dragNode {HtmlElement} draggable node
         *         shiftX {Number} the amount of left-pixels that this HtmlElement differs from the dragged element
         *         shiftY {Number} the amount of top-pixels that this HtmlElement differs from the dragged element
         *         inlineLeft {String} inline css of the property `left` when drag starts
         *         inlineTop {String} inline css of the property `top` when drag starts
         *     }]
         * }
         *
         * @property ddProps
         * @default {}
         * @type Object
         * @since 0.0.1
        */
       ddProps: {},

        /**
         * Internal hash with notifiers to response after each `Drag` event is set up, or teared down.
         * You can use this to hook in into the drag-eventcycle: the `drop`-module uses it this way.
         * Is filled by using `notify()`.
         *
         * @property _notifiers
         * @default []
         * @type Array
         * @private
         * @since 0.0.1
         */
        _notifiers: [],

        /**
        * Default function for the `*:dd-drag`-event
        *
        * @method _defFnDrag
        * @param e {Object} eventobject
        * @private
        * @since 0.0.1
        */
        _defFnDrag: function(e) {
            console.log(NAME, '_defFnDrag: default function dd-drag');
            var ddProps = this.ddProps,
                dragNode = ddProps.dragNode,
                constrainNode = ddProps.constrainNode,
                winConstrained = ddProps.winConstrained,
                x, y;
            // is the drag is finished, there will be no ddProps.defined
            // return then, to prevent any events that stayed behind
            if (!ddProps.defined) {
                return;
            }

            // caution: the user might have put the mouse out of the screen and released the mousebutton!
            // If that is the case, the a mouseup-event should be initiated instead of draggin the element
            if (e.buttons===0) {
                // no more button pressed
                /**
                * Fired when the mouse comes back into the browser-window while dd-drag was busy yet no buttons are pressed.
                * This is a correction to the fact that the mouseup-event wasn't noticed because the mouse was outside the browser.
                *
                * @event dd-fake-mouseup
                * @private
                * @since 0.1
                */
                Event.emit(dragNode, DD_FAKE_MOUSEUP);
            }
            else {
                console.log(NAME, '_defFnDrag: dragging:');
                if (constrainNode) {
                    ddProps.constrain.x = ddProps.constrain.xOrig - constrainNode.scrollLeft;
                    ddProps.constrain.y = ddProps.constrain.yOrig - constrainNode.scrollTop;
                }

                x = ddProps.x+e.xMouse+(winConstrained ? ddProps.winScrollLeft : window.getScrollLeft())-e.xMouseOrigin;
                y = ddProps.y+e.yMouse+(winConstrained ? ddProps.winScrollTop : window.getScrollTop())-e.yMouseOrigin;

                dragNode.setXY(x, y, ddProps.constrain, true);

                ddProps.relatives && ddProps.relatives.forEach(
                    function(item) {
                        item.dragNode.setXY(x+item.shiftX, y+item.shiftY, null, true);
                    }
                );
                ddProps.winConstrained || dragNode.forceIntoView(true);
                constrainNode && dragNode.forceIntoNodeView(constrainNode);
            }
        },

        /**
         * Default function for the `*:dd-drop`-event
         *
         * @method _defFnDrop
         * @param e {Object} eventobject
         * @private
         * @since 0.0.1
         */
        _defFnDrop: function(e) {
            console.log(NAME, '_defFnDrop');
            var dragNode = e.target,
                removeClasses = function (node) {
                    node.removeClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS, DEL_DRAGGABLE, DD_MASTER_CLASS]);
                };

            PLUGIN_ATTRS.forEach(function(attribute) {
                var data = '_del_'+attribute;
                if (dragNode.getData(data)) {
                    delete dragNode.plugin.dd.model[attribute];
                    dragNode.removeData(data);
                }
            });
            removeClasses(dragNode);
            e.relatives && e.relatives.forEach(
                function(node) {
                    removeClasses(node);
                }
            );
        },

        /**
         * Default function for the `*:dd`-event
         *
         * @method _defFnStart
         * @param e {Object} eventobject
         * @private
         * @since 0.0.1
         */
        _defFnStart: function(e) {
            var instance = this,
                customEvent;
            customEvent = e.emitter + ':'+DD_DRAG;
            console.log(NAME, '_defFnStart: default function UI:dd-start. Defining customEvent '+customEvent);
            Event.defineEvent(customEvent).defaultFn(instance._defFnDrag.bind(instance));
            DOCUMENT.getAll('.'+DD_MASTER_CLASS).removeClass(DD_MASTER_CLASS);
            instance._initializeDrag(e);
        },

      /**
        * Defines the definition of the `dd` event: the first phase of the drag-eventcycle (dd, *:dd-drag, *:dd-drop)
        *
        * @method _defineDDStart
        * @param emitterName {String} the emitterName, which leads into the definition of event `emitterName:dd`
        * @private
        * @since 0.0.1
        */
        _defineDDStart: function(emitterName) {
            console.log(NAME, '_defineDDStart');
            var instance = this;
            // by using dd before dd-drag, the user can create a `before`-subscriber to dd
            // and define e.emitter and/or e.relatives before going into `dd-drag`
            Event.defineEvent(emitterName+':dd')
                .defaultFn(instance._defFnStart.bind(instance))
                .preventedFn(instance._prevFnStart.bind(instance));
        },

       /**
         * Default function for the `*:dd-drag`-event
         *
         * @method _initializeDrag
         * @param e {Object} eventobject
         * @private
         * @since 0.0.1
         */
        _initializeDrag: function(e) {
            console.log(NAME, '_initializeDrag '+e.xMouseOrigin);
            var instance = this,
                dragNode = e.target,
                constrain = dragNode.getAttr(CONSTRAIN_ATTR),
                ddProps = instance.ddProps,
                emitterName = e.emitter,
                moveEv, x, y, byExactId, match, constrainNode, winConstrained, winScrollLeft, winScrollTop,
                xOrig, yOrig;

            // define ddProps --> internal object with data about the draggable instance
            ddProps.dragNode = dragNode;
            ddProps.x = x = dragNode.left;
            ddProps.y = y = dragNode.top;
            ddProps.inlineLeft = dragNode.getInlineStyle(LEFT);
            ddProps.inlineTop = dragNode.getInlineStyle(TOP);
            ddProps.winConstrained = winConstrained = (constrain===WINDOW);
            ddProps.xMouseLast = x;
            ddProps.yMouseLast = y;

            if (constrain) {
                if (winConstrained) {
                    ddProps.winScrollLeft = winScrollLeft = window.getScrollLeft();
                    ddProps.winScrollTop = winScrollTop = window.getScrollTop();
                    ddProps.constrain = {
                        x: winScrollLeft,
                        y: winScrollTop,
                        w: window.getWidth(),
                        h: window.getHeight()
                    };
                    // if constrained to window:
                    // set a class that makes overflow hidden --> this will prevent
                    // some browsers from scrolling the window when a pressed mouse
                    // gets out of the window
                    bodyNode.setClass(NO_OVERFLOW);
                }
                else {
                    byExactId = REGEXP_NODE_ID.test(constrain);
                    constrainNode = dragNode.parentNode;
                    while (constrainNode.matchesSelector && !match) {
                        match = byExactId ? (constrainNode.id===constrain.substr(1)) : constrainNode.matchesSelector(constrain);
                        // if there is a match, then make sure x and y fall within the region
                        if (match) {
                            ddProps.constrainNode = constrainNode;
                            xOrig = constrainNode.left + parseInt(constrainNode.getStyle(BORDER_LEFT_WIDTH), 10);
                            yOrig = constrainNode.top + parseInt(constrainNode.getStyle(BORDER_TOP_WIDTH), 10);
                            ddProps.constrain = {
                                xOrig: xOrig,
                                yOrig: yOrig,
                                x: xOrig - constrainNode.scrollLeft,
                                y: yOrig - constrainNode.scrollTop,
                                w: constrainNode.scrollWidth,
                                h: constrainNode.scrollHeight
                            };
                        }
                        else {
                            constrainNode = constrainNode.parentNode;
                        }
                    }
                }
            }

            // create listener for `mousemove` and transform it into the `*:dd:drag`-event
            moveEv = Event.after(mobileEvents ? PANMOVE : MOUSEMOVE, function(e2) {
                if (typeof e2.center==='object') {
                    e2.clientX = e2.center.x;
                    e2.clientY = e2.center.y;
                }
                if (!e2.clientX) {
                    return;
                }
                // move the object
                e.xMouse = e2.clientX;
                e.yMouse = e2.clientY;
                /**
                * Emitted during the drag-cycle of a draggable Element (while it is dragged).
                *
                * @event *:dd-drag
                * @param e {Object} eventobject including:
                * @param e.target {HtmlElement} the HtmlElement that is being dragged
                * @param e.currentTarget {HtmlElement} the HtmlElement that is delegating
                * @param e.sourceTarget {HtmlElement} the deepest HtmlElement where the mouse lies upon
                * @param e.dd {Promise} Promise that gets fulfilled when dragging is ended. The fullfilled-callback has no arguments.
                * @param e.xMouse {Number} the current x-position in the window-view
                * @param e.yMouse {Number} the current y-position in the window-view
                * @param e.clientX {Number} the current x-position in the window-view
                * @param e.clientY {Number} the current y-position in the window-view
                * @param e.xMouseOrigin {Number} the original x-position in the document when drag started (incl. scrollOffset)
                * @param e.yMouseOrigin {Number} the original y-position in the document when drag started (incl. scrollOffset)
                * @param [e.relatives] {NodeList} an optional list that the user could set in a `before`-subscriber of the `dd`-event
                *        to inform which nodes are related to the draggable node and should be dragged as well.
                * @since 0.1
                */
                Event.emit(dragNode, emitterName+':'+DD_DRAG, e);
                e.dd.callback();
            });

            // prepare dragNode class for the right CSS:
            dragNode.setClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS]);

            Event.onceAfter([mobileEvents ? PANEND : MOUSEUP, DD_FAKE_MOUSEUP], function(e3) {
                moveEv.detach();
                // set mousepos for the last time:
                if (typeof e3.center==='object') {
                    e3.clientX = e3.center.x;
                    e3.clientY = e3.center.y;
                }
                e.xMouse = e3.clientX;
                e.yMouse = e3.clientY;
                // invoke all teardown notifiers:
                instance._notifiers.forEach(
                    function(notifier) {
                        notifier.s || notifier.cb.call(notifier.o, e, ddProps);
                    }
                );

                if (constrain && ddProps.winConstrained) {
                    // if constrained to window:
                    // remove overflow=hidden from the bodynode
                    bodyNode.removeClass(NO_OVERFLOW);
                }

                instance.ddProps = {};
                /**
                * Emitted when drag-cycle of a draggable Element is ended.
                *
                * @event *:dd-drop
                * @param e {Object} eventobject including:
                * @param e.target {HtmlElement} the HtmlElement that is being dragged
                * @param e.currentTarget {HtmlElement} the HtmlElement that is delegating
                * @param e.sourceTarget {HtmlElement} the deepest HtmlElement where the mouse lies upon
                * @param e.dd {Promise} Promise that gets fulfilled when dragging is ended. The fullfilled-callback has no arguments.
                * @param e.xMouse {Number} the current x-position in the window-view
                * @param e.yMouse {Number} the current y-position in the window-view
                * @param e.clientX {Number} the current x-position in the window-view
                * @param e.clientY {Number} the current y-position in the window-view
                * @param e.xMouseOrigin {Number} the original x-position in the document when drag started (incl. scrollOffset)
                * @param e.yMouseOrigin {Number} the original y-position in the document when drag started (incl. scrollOffset)
                * @param [e.relatives] {NodeList} an optional list that the user could set in a `before`-subscriber of the `dd`-event
                *        to inform which nodes are related to the draggable node and should be dragged as well.
                * @since 0.1
                */
                Event.emit(dragNode, emitterName+':'+DD_DROP, e);
                e.dd.fulfill();
            });

            dragNode.setXY(ddProps.xMouseLast, ddProps.yMouseLast, ddProps.constrain, true);

            if (e.relatives) {
                // relatives are extra HtmlElements that should be moved aside with the main dragged element
                // e.relatives is a selector, e.relativeNodes will be an array with nodes
                e.relativeNodes = [];
                dragNode.setClass(DD_MASTER_CLASS);
                dragNode.setClass(DD_MASTER_CLASS);
                ddProps.relatives = [];
                e.relatives.forEach(
                    function(node) {
                        var item;
                        if (node !== dragNode) {
                            item = {
                                dragNode: node,
                                shiftX: node.left - x,
                                shiftY: node.top - y,
                                inlineLeft: node.getInlineStyle(LEFT),
                                inlineTop: node.getInlineStyle(TOP)
                            };
                            item.dragNode.setClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS]);
                            ddProps.relatives.push(item);
                            e.relativeNodes.push(item.dragNode);
                        }
                    }
                );
            }
            // invoke all setup notifiers:
            instance._notifiers.forEach(
                function(notifier) {
                    notifier.s && notifier.cb.call(notifier.o, e, ddProps);
                }
            );
        },

        /**
         * Prevented function for the `*:dd-start`-event
         *
         * @method _prevFnStart
         * @param e {Object} eventobject
         * @private
         * @since 0.0.1
         */
        _prevFnStart: function(e) {
            console.log(NAME, '_prevFnStart');
            e.dd.reject();
        },

      /**
        * Engine behind the drag-drop-cycle.
        * Sets up a `mousedown` listener to initiate a drag-drop eventcycle. The eventcycle start whenever
        * one of these events happens on a HtmlElement with the attribute `dd-draggable="true"`.
        * The drag-drop eventcycle consists of the events: `dd-start`, `emitterName:dd-drag` and `emitterName:dd-drop`
        *
        *
        * @method _setupMouseEv
        * @private
        * @since 0.0.1
        */
        _setupMouseEv: function() {
            console.log(NAME, '_setupMouseEv: setting up mousedown event');
            var instance = this,
                nodeTargetFn,
                delegatedTargetFn;

            nodeTargetFn = function(e) {
                var node = e.target,
                    handle, availableHandles, insideHandle, emitterName;

                // first check if there is a handle to determine if the drag started here:
                handle = node.getAttr(DD_HANDLE);
                if (handle) {
                    availableHandles = node.getAll(handle);
                    insideHandle = false;
                    availableHandles.some(function(handleNode) {
                        insideHandle = handleNode.contains(e.sourceTarget);
                        return insideHandle;
                    });
                    if (!insideHandle) {
                        return;
                    }
                }

                // initialize ddProps: have to do here, because the event might not start because it wasn't inside the handle when it should be
                instance.ddProps = {
                    defined: true,
                    dragOverList: []
                };

                // prevent the emitter from resetting e.target to e.sourceTarget:
                e._noResetSourceTarget = true;
                // add `dd`-Promise to the eventobject --> this Promise will be resolved once the pointer has released.
                e.dd = Promise.manage();
                // define e.setOnDrag --> users
                e.setOnDrag = function(callbackFn) {
                    e.dd.setCallback(callbackFn);
                };
                // store the orriginal mouseposition:
                e.xMouseOrigin = e.clientX + window.getScrollLeft();
                e.yMouseOrigin = e.clientY + window.getScrollTop();

                //set the emitterName:
                emitterName = e.target.getAttr(DD_EMITTER) || UI;
                // now we can start the eventcycle by emitting emitterName:dd:
                /**
                * Emitted when a draggable Element's drag-cycle starts. You can use a `before`-subscriber to specify
                * e.relatives, which should be a nodelist with HtmlElements, that should be dragged togehter with the master
                * draggable Element.
                *
                * @event *:dd
                * @param e {Object} eventobject including:
                * @param e.target {HtmlElement} the HtmlElement that is being dragged
                * @param e.currentTarget {HtmlElement} the HtmlElement that is delegating
                * @param e.sourceTarget {HtmlElement} the deepest HtmlElement where the mouse lies upon
                * @param e.dd {Promise} Promise that gets fulfilled when dragging is ended. The fullfilled-callback has no arguments.
                * @param e.xMouse {Number} the current x-position in the window-view
                * @param e.yMouse {Number} the current y-position in the window-view
                * @param e.clientX {Number} the current x-position in the window-view
                * @param e.clientY {Number} the current y-position in the window-view
                * @param e.xMouseOrigin {Number} the original x-position in the document when drag started (incl. scrollOffset)
                * @param e.yMouseOrigin {Number} the original y-position in the document when drag started (incl. scrollOffset)
                * @param [e.relatives] {NodeList} an optional list that the user could set in a `before`-subscriber of the `dd`-event
                *        to inform which nodes are related to the draggable node and should be dragged as well.
                * @since 0.1
                */
                instance._defineDDStart(emitterName);
                Event.emit(e.target, emitterName+':dd', e);
            };

            delegatedTargetFn = function(e, cssSelector) {
                var container = e.target,
                    nodelist = container.getAll(cssSelector),
                    foundNode;
                nodelist.some(
                    function(node) {
                        (node.contains(e.sourceTarget)) && (foundNode=node);
                        return foundNode;
                    }
                );
                if (foundNode) {
                    // e.currentTarget = container;
                    e.target = foundNode;
                    // Mark the delegated node, so it has the same style as [draggable]:
                    foundNode.setClass(DEL_DRAGGABLE);
                    // We must transport the other relevant dd-attributes (and constrain-selector)
                    // which we will remove when finished dragging:
                    PLUGIN_ATTRS.forEach(function(attribute) {
                        var attr = container.getAttr(attribute);
                        if (attr && !foundNode.hasAttr(attribute)) {
                            foundNode.setData('_del_'+attribute, attr);
                            foundNode.plugin.dd.model[attribute] = attr;
                        }
                    });
                    nodeTargetFn(e);
                }
            };
            Event.after(mobileEvents ? PANSTART : MOUSEDOWN, function(e) {
                var draggableAttr = e.target.getAttr(DD_MINUSDRAGGABLE);
                if (typeof e.center==='object') {
                    e.clientX = e.center.x;
                    e.clientY = e.center.y;
                }
                (draggableAttr===TRUE) ? nodeTargetFn(e) : delegatedTargetFn(e, draggableAttr);
            }, '['+DD_MINUSDRAGGABLE+']');

        },

       /**
         * Initializes dragdrop. Needs to be invoked, otherwise DD won't run.
         *
         * @method init
         * @param dragableElement {HtmlElement} HtmlElement that is checked for its allowed effects
         * @return {Boolean} if copy-dragables are allowed
         * @since 0.0.1
         */
        init: function() {
            console.log(NAME, 'init');
            var instance = this;
            if (!instance._inited) {
                instance._setupMouseEv(); // engine behind the dragdrop-eventcycle
                if (mobileEvents) {
                    Event.before(['touchstart', 'touchmove'], function(ev) {
                        (instance.ddProps.size()>0) && ev.preventDefault();
                    });
                }
                Event.defineEvent('UI:'+DD_DROP)
                     .defaultFn(instance._defFnDrop.rbind(instance));
            }
            instance._inited = true;
        },

        /**
         * Creates a notifier to response after each `Drag` event is set up, or teared down.
         * You can use this to hook in into the drag-eventcycle: the `drop`-module uses it this way.
         *
         * @static
         * @method notify
         * @param callback {Function} subscriber: will be invoked after every drag-event is set up.
         *                 Recieves 2 arguments: the `eventobject` and the internal property: `ddProps`
         * @param context {Object} context of the callback
         * @param setup {Boolean} wheter the callback should be invoked on setup (true) or teardown (false)
         * @return {Object} handle with a method `detach()` which you can use to remove it from the `notifier-hash`
         * @since 0.0.1
        */
        notify: function(callback, context, setup) {
            console.log(NAME, 'notify');
            var notifier = {
                cb: callback,
                o: context,
                s: setup
            };
            this._notifiers.push(notifier);
            return {
                detach: function() {
                    this._notifiers.remove(notifier);
                }
            };
        }

    };

    DOCUMENT.definePlugin('dd', null, {
        attrs: {
            draggable: 'string',
            handle: 'string',
            emitter: 'string'
        },
        defaults: {
            draggable: 'true'
        }
    });

    window._ITSAmodules.Drag = DD;

    return DD;
};