"use strict";

/**
 * Provides `drag and drop` functionality
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Drag = require('drag')(window);
 * Draf.init();
 *
 * @module drag
 * @class DD
 * @since 0.0.4
*/

var NAME = '[drag]: ',
    DRAG = 'drag',
    DROP = 'drop',
    DRAGGABLE = DRAG+'gable',
    DEL_DRAGGABLE = 'del-'+DRAGGABLE,
    DD_MINUS = 'dd-',
    DD_DRAGGING_CLASS = DD_MINUS+DRAG+'ging',
    DD_MASTER_CLASS = DD_MINUS+'master',
    DD_HANDLE = DD_MINUS+'handle',
    DD_DROPZONE_MOVABLE = DD_MINUS+'dropzone-movable',
    CONSTRAIN_ATTR = 'xy-constrain',
    PROXY = 'proxy',
    MOUSE = 'mouse',
    DATA_KEY = 'dragDrop',
    DD_EFFECT_ALLOWED = DD_EFFECT_ALLOWED,
    DROPZONE = 'dropzone',
    DROPZONE_DROP = DROPZONE+'-'+DROP,
    DD_DROPZONE = DD_MINUS+DROPZONE,
    NO_TRANS_CLASS = 'el-notrans', // delivered by `dom-ext`
    DD_HIDDEN_SOURCE_CLASS = DD_MINUS+'hidden-source',
    INVISIBLE_CLASS = 'el-invisible', // delivered by `dom-ext`
    DD_TRANSITION_CLASS = DD_MINUS+'transition',
    DD_OPACITY_CLASS = DD_MINUS+'opacity',
    HIGH_Z_CLASS = DD_MINUS+'high-z',
    DD_DROPACTIVE_CLASS = 'dropactive',
    REGEXP_MOVE = /\bmove\b/i,
    REGEXP_COPY = /\bcopy\b/i,
    REGEXP_NODE_ID = /^#\S+$/,
    REGEXP_ALL = /\b(all|true)\b/i,
    REGEXP_COPY = /\bcopy\b/i,
    EMITTERNAME = 'emittername',
    REGEXP_EMITTER = /\bemittername=(\w+)\b/,
    DD_EMITTERNAME = DD_MINUS+EMITTERNAME,
    PX = 'px',
    COPY = 'copy',
    MOVE = 'move',
    DD_DRAG = DD_MINUS+DRAG,
    DROPZONE_OUT = DROPZONE+'-out',
    DD_DROP = DD_MINUS+DROP,
    UI_DD_START = 'UI:dd',
    DD_FAKE = DD_MINUS+'fake-',
    DOWN = 'down',
    UP = 'up',
    KEY = 'key',
    MOUSEUP = MOUSE+UP,
    MOUSEDOWN = MOUSE+DOWN,
    MOUSEMOVE = MOUSE+'move',
    DD_FAKE_MOUSEUP = DD_FAKE+MOUSEUP,
    DD_FAKE_MOUSEMOVE = DD_FAKE+MOUSEMOVE,
    UI = 'UI',
    DROPZONE_BRACKETS = '[' + DROPZONE + ']',
    DD_EFFECT_ALLOWED = DD_MINUS+'effect-allowed',
    BORDER = 'border',
    WIDTH = 'width',
    BORDER_LEFT_WIDTH = BORDER+'-left-'+WIDTH,
    BORDER_RIGHT_WIDTH = BORDER+'-right-'+WIDTH,
    BORDER_TOP_WIDTH = BORDER+'-top-'+WIDTH,
    BORDER_BOTTOM_WIDTH = BORDER+'-bottom-'+WIDTH,
    LEFT = 'left',
    TOP = 'top',
    WINDOW = 'window',
    POSITION = 'position',
    ABSOLUTE = 'absolute',
    TRANS_END = 'transitionend',
    TRUE = 'true',
    DD_MINUSDRAGGABLE = DD_MINUS+DRAGGABLE,
    PLUGIN_ATTRS = [DD_MINUS+DROPZONE, CONSTRAIN_ATTR, DD_EMITTERNAME, DD_HANDLE, DD_EFFECT_ALLOWED, DD_DROPZONE_MOVABLE],
    LATER = require('utils').later;

require('polyfill/polyfill-base.js');
require('js-ext');
require('./css/drag-drop.css');

module.exports = function (window) {
    var Event = require('event-dom')(window),
        NodePlugin = require('dom-ext')(window).Plugins.NodePlugin,
        ctrlPressed = false,
        initialised = false,
        dropEffect = MOVE,
        Drag, NodeDD, NodeDropzone;

    require('window-ext')(window);

    Drag = {
       ddProps: {},

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
                    ddProps.constrain.x = ddProps.constrain.xOrig - constrainNode.getScrollLeft();
                    ddProps.constrain.y = ddProps.constrain.yOrig - constrainNode.getScrollTop();
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
            var instance = this,
                dragNode = e.copyTarget,
                removeClasses = function (node) {
                    node.removeClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS, DEL_DRAGGABLE]);
                };

            PLUGIN_ATTRS.forEach(function(attribute) {
                var data = '_del_'+attribute;
                if (dragNode.getData(data)) {
                    dragNode.removeAttr(attribute);
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
         * Default function for the `UI:dd-start`-event
         *
         * @method _defFnDrag
         * @param e {Object} eventobject
         * @private
         * @since 0.0.1
         */
        _defFnStart: function(e) {
            var instance = this,
                customEvent;
            e.emitterName = e.emitterName || e.target.getAttr(DD_EMITTERNAME) || UI,
            customEvent = e.emitterName + ':'+DD_DRAG;
            console.log(NAME, '_defFnStart: default function UI:dd-start. Defining customEvent '+customEvent);
            Event.defineEvent(customEvent).defaultFn(instance._defFnDrag.bind(instance));
            window.document.getAll('.'+DD_MASTER_CLASS).removeClass(DD_MASTER_CLASS);
            instance._initializeDrag(e);
        },

      /**
        * Defines the definition of the `dd-start` event: the first phase of the drag-eventcycle (dd-start, *:dd-drag, *:dd-drop)
        *
        * @method _defineDDStart
        * @param e {Object} eventobject
        * @private
        * @since 0.0.1
        */
        _defineDDStart: function() {
            console.log(NAME, '_defineDDStart');
            var instance = this;
            // by using dd-start before dd-drag, the user can create a `before`-subscriber to dd-start
            // and define e.emitterName and/or e.relatives before going into `dd-drag`
            Event.defineEvent(UI_DD_START)
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
                sourceNode = e.target,
                constrain = sourceNode.getAttr(CONSTRAIN_ATTR),
                ddProps = instance.ddProps,
                emitterName = e.emitterName,
                moveEv, dragNode, x, y, byExactId, match, constrainNode, winConstrained, winScrollLeft, winScrollTop,
                inlineLeft, inlineTop, xOrig, yOrig, dropzones;

            // define ddProps --> internal object with data about the draggable instance
            ddProps.sourceNode = sourceNode;
            ddProps.dragNode = dragNode = sourceNode;
            ddProps.x = x = sourceNode.getX();
            ddProps.y = y = sourceNode.getY();
            ddProps.inlineLeft = inlineLeft = sourceNode.getInlineStyle(LEFT);
            ddProps.inlineTop = inlineTop = sourceNode.getInlineStyle(TOP);
            ddProps.winConstrained = winConstrained = (constrain===WINDOW);
            ddProps.xMouseLast = x;
            ddProps.yMouseLast = y;

            e.dragTarget = sourceNode; // equals e.target, but the event dd-drop-zone has e.target set to dragNode, which might be a copy
            e.copyTarget = dragNode;
            if (constrain) {
                if (ddProps.winConstrained) {
                    ddProps.winScrollLeft = winScrollLeft = window.getScrollLeft();
                    ddProps.winScrollTop = winScrollTop = window.getScrollTop();
                    ddProps.constrain = {
                        x: winScrollLeft,
                        y: winScrollTop,
                        w: window.getWidth(),
                        h: window.getHeight()
                    };
                }
                else {
                    byExactId = REGEXP_NODE_ID.test(constrain);
                    constrainNode = sourceNode.parentNode;
                    while (constrainNode.matchesSelector && !match) {
                        match = byExactId ? (constrainNode.id===constrain.substr(1)) : constrainNode.matchesSelector(constrain);
                        // if there is a match, then make sure x and y fall within the region
                        if (match) {
                            ddProps.constrainNode = constrainNode;
                            xOrig = constrainNode.getX() + parseInt(constrainNode.getStyle(BORDER_LEFT_WIDTH), 10);
                            yOrig = constrainNode.getY() + parseInt(constrainNode.getStyle(BORDER_TOP_WIDTH), 10);
                            ddProps.constrain = {
                                xOrig: xOrig,
                                yOrig: yOrig,
                                x: xOrig - constrainNode.getScrollLeft(),
                                y: yOrig - constrainNode.getScrollTop(),
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
            moveEv = Event.after(MOUSE+MOVE, function(e2) {
                if (!e2.clientX) {
                    return;
                }
                // move the object
                e.xMouse = e2.clientX;
                e.yMouse = e2.clientY;
                /**
                * Fired when the checkbox changes its value<br />
                * Listen for this event instead of 'checkedChange',
                * because this event is also fired when the checkbox changes its 'disabled'-state
                * (switching value null/boolean)
                *
                * @event valuechange
                * @param e {EventFacade} Event Facade including:
                * @param e.newVal {Boolean|null} New value of the checkbox; will be 'null' when is disabled.
                * @param e.prevVal {Boolean|null} Previous value of the checkbox; will be 'null' when was disabled.
                * @since 0.1
                */
                Event.emit(sourceNode, emitterName+':'+DD_DRAG, e);
                e.dd.callback();
            });

            // prepare dragNode class for the right CSS:
            dragNode.setClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS]);

            Event.onceAfter([MOUSE+UP, DD_FAKE_MOUSEUP], function(e3) {
                moveEv.detach();
                // set mousepos for the last time:
                e.xMouse = e3.clientX;
                e.yMouse = e3.clientY;
                // invoke all teardown notifiers:
                instance._notifiers.forEach(
                    function(notifier) {
                        notifier.s || notifier.cb.call(notifier.o, e, ddProps);
                    }
                );
                instance.ddProps = {};
                /**
                * Fired when the checkbox changes its value<br />
                * Listen for this event instead of 'checkedChange',
                * because this event is also fired when the checkbox changes its 'disabled'-state
                * (switching value null/boolean)
                *
                * @event valuechange
                * @param e {EventFacade} Event Facade including:
                * @param e.newVal {Boolean|null} New value of the checkbox; will be 'null' when is disabled.
                * @param e.prevVal {Boolean|null} Previous value of the checkbox; will be 'null' when was disabled.
                * @since 0.1
                */
                Event.emit(sourceNode, emitterName+':'+DD_DROP, e);
                e.dd.fulfill();
            });

            dragNode.setXY(ddProps.xMouseLast, ddProps.yMouseLast, ddProps.constrain, true);

            if (e.relatives) {
                // relatives are extra HtmlElements that should be moved aside with the main dragged element
                // e.relatives is a selector, e.relativeNodes will be an array with nodes
                e.relativeNodes = [];
                e.relativeCopyNodes = [];
                sourceNode.setClass(DD_MASTER_CLASS);
                dragNode.setClass(DD_MASTER_CLASS);
                ddProps.relatives = [];
                e.relatives.forEach(
                    function(node) {
                        var item;
                        if (node !== sourceNode) {
                            item = {
                                sourceNode: node,
                                dragNode: node,
                                shiftX: node.getX() - x,
                                shiftY: node.getY() - y,
                                inlineLeft: node.getInlineStyle(LEFT),
                                inlineTop: node.getInlineStyle(TOP)
                            };
                            item.dragNode.setClass([NO_TRANS_CLASS, HIGH_Z_CLASS, DD_DRAGGING_CLASS]);
                            ddProps.relatives.push(item);
                            e.relativeNodes.push(item.sourceNode);
                            e.relativeCopyNodes.push(item.dragNode);
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
         * Internal hash with notifiers to response after each `Drag` event is set up, or teared down.
         * You can use this to hook in into the drag-eventcycle: the `drop`-module uses it this way.
         * Is filled by using `notify()`.
         *
         * @property _notifiers
         * @private
         * @since 0.0.1
         */
        _notifiers: [],

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
        * Engine behinf the dragdrop-cycle.
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
                    handle, availableHandles, insideHandle;

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
                // now we can start the eventcycle by emitting UI:dd:
                /**
                * Fired when the checkbox changes its value<br />
                * Listen for this event instead of 'checkedChange',
                * because this event is also fired when the checkbox changes its 'disabled'-state
                * (switching value null/boolean)
                *
                * @event valuechange
                * @param e {EventFacade} Event Facade including:
                * @param e.newVal {Boolean|null} New value of the checkbox; will be 'null' when is disabled.
                * @param e.prevVal {Boolean|null} Previous value of the checkbox; will be 'null' when was disabled.
                * @since 0.1
                */
                Event.emit(e.target, UI_DD_START, e);
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
                    e.currentTarget = container;
                    e.target = foundNode;
                    // Mark the delegated node, so it has the same style as [draggable]:
                    foundNode.setClass(DEL_DRAGGABLE);
                    // We must transport the other relevant dd-attributes (and xy-constrain)
                    // which we will remove when finished dragging:
                    PLUGIN_ATTRS.forEach(function(attribute) {
                        var attr = container.getAttr(attribute);
                        if (attr && !foundNode.hasAttr(attribute)) {
                            foundNode.setData('_del_'+attribute, attr);
                            foundNode.setAttr(attribute, attr);
                        }
                    });
                    nodeTargetFn(e);
                }
            };

            Event.after(MOUSEDOWN, function(e) {
                var draggableAttr = e.target.getAttr(DD_MINUSDRAGGABLE);
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
            if (!instance.initialised) {
                instance._defineDDStart();
                instance._setupMouseEv(); // engine behind the dragdrop-eventcycle
                Event.defineEvent('UI:'+DD_DROP)
                     .defaultFn(instance._defFnDrop.rbind(instance));
            }
            instance.initialised = true;
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

    NodeDD = NodePlugin.subClass(
        function (config) {
            var instance = this;
            config || (config={});
            instance[DD_MINUSDRAGGABLE] = true;
            instance[DD_MINUS+DROPZONE] = config.dropzone;
            instance[CONSTRAIN_ATTR] = config.constrain;
            instance[DD_EMITTERNAME] = config.emitterName;
            instance[DD_HANDLE] = config.handle;
            instance[DD_EFFECT_ALLOWED] = config.effectAllowed;
            instance[DD_DROPZONE_MOVABLE] = config.dropzoneMovable;
        }
    );

    NodeDropzone = NodePlugin.subClass(
        function (config) {
            var dropzone = TRUE,
                emitterName;
            config || (config={});
            if (config.copy && !config.move) {
                dropzone = COPY;
            }
            else if (!config.copy && config.move) {
                dropzone = MOVE;
            }
            (emitterName=config.emitterName) && (dropzone+=' '+EMITTERNAME+'='+emitterName);
            this.dropzone = dropzone;
        }
    );

    return {
        Drag: Drag,
        Plugins: {
            NodeDD: Drag.NodeDD,
            NodeDropzone: NodeDropzone
        }
    };
};