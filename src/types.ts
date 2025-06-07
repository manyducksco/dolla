import type * as CSS from "csstype";
import type { Markup, MarkupNode } from "./core/markup.js";
import { Signal } from "./core/signals.js";
import { Mixin } from "./core/nodes/html.js";
import type { Context } from "./core/context.js";

export type Env = "production" | "development";

/**
 * Represents everything that can be handled as a DOM node.
 * These are all the items considered valid to pass as children to any element.
 */
export type Renderable =
  | string
  | number
  | Node
  | Markup
  | MarkupNode
  | false
  | null
  | undefined
  | Signal<any>
  | (string | number | Node | Markup | MarkupNode | false | null | undefined | Signal<any>)[];

/**
 *
 */
export type View<P> = (this: Context, props: P, context: Context) => Renderable;

/**
 *
 */
export type Store<Options, Value> = (this: Context, options: Options, context: Context) => Value;

/*==================================*\
||            JSX Types             ||
\*==================================*/

type MaybeSignal<T> = T | Signal<T> | Signal<T | undefined>;

type OptionalProperty<T> = MaybeSignal<T>;
type RequiredProperty<T> = T | Signal<T>;

type AutocapitalizeValues = "off" | "on" | "none" | "sentences" | "words" | "characters";
type ContentEditableValues = true | false | "true" | "false" | "plaintext-only" | "inherit";
type ClassListValues = string | ClassMap | Array<string | ClassMap | (string | ClassMap)[]>;
type DirValues = "ltr" | "rtl" | "auto";
type EnterKeyHintValues = "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
type HiddenValues = true | false | "until-found";
type InputModeValues = "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";

/**
 * Properties common to all Elements.
 */
export interface ElementProps {
  /**
   * Sets the value as an HTML attribute.
   */
  [key: `attr:${string}`]: OptionalProperty<any>;

  /**
   * Sets the value directly on the HTMLElement as a property.
   */
  [key: `prop:${string}`]: OptionalProperty<any>;

  /**
   * Attaches an event listener to the element (with `addEventListener`).
   */
  [key: `on:${string}`]: OptionalProperty<EventHandler<Event>>;

  /**
   * HTML attributes to assign to the element.
   */
  // attributes?: OptionalProperty<Record<string, any>>;

  /**
   * Object of event listeners.
   */
  // eventListeners?: OptionalProperty<Record<string, EventHandler<Event>>>; // TODO: Define full types for events in this object.

  /**
   * CSS classes to be applied to this element. In addition to the standard space-separated list of class names,
   * this property also supports a class map object with class names as keys and booleans as values.
   * Class names in a class map will be applied to the element while their values are true. Also supports an
   * array of strings and class maps.
   *
   * @alias className
   *
   * @example
   * <div class="one-class" />
   *
   * <div class={"one-class"} />
   *
   * <div class={["array", "of", "classes"]} />
   *
   * <div class={{ applied: true, notApplied: false }} />
   *
   * <div class={["class", "class2", { "conditional": $value }]} />
   */
  class?: OptionalProperty<ClassListValues>;

  /**
   * CSS classes to be applied to this element. In addition to the standard space-separated list of class names,
   * this property also supports a class map object with class names as keys and booleans as values.
   * Class names in a class map will be applied to the element while their values are true. Also supports an
   * array of strings and class maps.
   *
   * @alias class
   *
   * @example
   * <div className="one-class" />
   *
   * <div className={"one-class"} />
   *
   * <div className={["array", "of", "classes"]} />
   *
   * <div className={{ applied: true, notApplied: false }} />
   *
   * <div className={["class", "class2", { "conditional": $value }]} />
   */
  className?: OptionalProperty<ClassListValues>;

  // TODO: elementTiming (experimental; Chrome-only?)

  /**
   * A unique string to identify this element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/id
   */
  id?: OptionalProperty<string>;

  /**
   * Renders a string of HTML as the children of this element.
   * Equivalent to setting `innerHTML` on a DOM element.
   *
   * `NOTE` This property does no sanitization. If it's in the string, it's in the DOM. Be mindful when handling user-generated content.
   */
  innerHTML?: OptionalProperty<string>;

  /**
   * Specifies the element's [WAI-ARIA role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/role
   */
  role?: OptionalProperty<string>;

  /**
   * Scroll position from the left (on the X axis), if this element is scrollable.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft
   */
  scrollLeft?: OptionalProperty<number>;

  /**
   * Scroll position from the top (on the Y axis) if this element is scrollable.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop
   */
  scrollTop?: OptionalProperty<number>;

  /**
   * Specifies whether an element's content should be translated when the page is localized.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate
   */
  translate?: OptionalProperty<boolean>;

  /*=================================*\
  ||     Attribute-aliased Props     ||
  \*=================================*/

  /* This section includes props that don't truly exist as props on DOM nodes, but instead map to HTML attributes.
     These attributes can be set through props on Markup elements. */

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts
   */
  exportParts?: OptionalProperty<string>;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/part
   */
  part?: OptionalProperty<string>;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/slot
   */
  slot?: OptionalProperty<string>;

  /**
   * Enables or disables checking for spelling errors in an element's content.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/spellcheck
   */
  spellCheck?: OptionalProperty<boolean>;

  /**
   * Inline styles applied to the element. Can be passed as a string or as an object.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/style
   */
  style?:
    | string
    | CSSProperties
    | Signal<string>
    | Signal<CSSProperties>
    | Signal<string | CSSProperties>
    | Signal<string | undefined>
    | Signal<CSSProperties | undefined>
    | Signal<string | CSSProperties | undefined>;

  /*=================================*\
  ||              Events             ||
  \*=================================*/

  /**
   * Fired when a CSS animation unexpectedly aborts.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationcancel_event
   */
  onAnimationCancel?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a CSS animation completes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event
   */
  onAnimationEnd?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when an iteration of a CSS animation completes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationiteration_event
   */
  onAnimationIteration?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a CSS animation starts.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationstart_event
   */
  onAnimationStart?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a pointing device's non-primary button is pressed and released while the pointer is inside the element.
   * With a mouse, this would typically be any button other than left click.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event
   */
  onAuxClick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the element has lost focus. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event
   */
  onBlur?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when a pointing device is pressed and released while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
   */
  onClick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device is pressed and released while the pointer is outside the element.
   *
   * NOTE: This is a custom event that isn't supported natively by browsers.
   */
  onClickOutside?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a text composition system (such as a Chinese/Japanese IME) completes or cancels the current composition session.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event
   */
  onCompositionEnd?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when a text composition system (such as a Chinese/Japanese IME) starts a new composition session.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event
   */
  onCompositionStart?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when a new character is received from a session in a text composition system (such as a Chinese/Japanese IME).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionupdate_event
   */
  onCompositionUpdate?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when the user attempts to open a context menu. Typically triggered by clicking the right mouse button.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
   */
  onContextMenu?: OptionalProperty<EventHandler<PointerEvent>>;

  // onContextMenu: Deliberately unimplemented due to lack of support in iOS Safari and by extension all iOS webviews.

  /**
   * Fired when a pointing device button is rapidly clicked twice while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event
   */
  onDblClick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the element has received focus. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event
   */
  onFocus?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element has received focus. Fired after `onFocus`. Unlike `onFocus`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event
   */
  onFocusIn?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element has lost focus. Fired after `onBlur`. Unlike `onBlur`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event
   */
  onFocusOut?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element enters or exits fullscreen mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenchange_event
   */
  onFullscreenChange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the browser can't switch to fullscreen mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenerror_event
   */
  onFullscreenError?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a key on the keyboard is pressed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
   */
  onKeyDown?: OptionalProperty<EventHandler<KeyboardEvent>>;

  /**
   * Fired when a key on the keyboard is released.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
   */
  onKeyUp?: OptionalProperty<EventHandler<KeyboardEvent>>;

  /**
   * Fired when a pointing device button is pressed while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event
   */
  onMouseDown?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device enters the bounds of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event
   */
  onMouseEnter?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device leaves the bounds of an element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event
   */
  onMouseLeave?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device is moved while inside the bounds of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
   */
  onMouseMove?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device leaves the bounds of an element or one of its children. Unlike `onMouseLeave`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseout_event
   */
  onMouseOut?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device enters the bounds of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseover_event
   */
  onMouseOver?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device button is released while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event
   */
  onMouseUp?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the browser determines there are unlikely to be any more pointer events.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
   */
  onPointerCancel?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer becomes active inside the bounds of an element.
   * For a mouse, this is when a button is pressed. For a touchscreen, this is when a finger makes contact.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event
   */
  onPointerDown?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved into the boundary of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerenter_event
   */
  onPointerEnter?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved outside the boundary of an element or one of its children.
   * For a mouse, this is when a button is released. For a touchscreen, this is when a finger leaves the screen.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerleave_event
   */
  onPointerLeave?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer changes coordinates inside the bounds of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event
   */
  onPointerMove?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is no longer in contact with an element or its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerout_event
   */
  onPointerOut?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved into the boundary of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerover_event
   */
  onPointerOver?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is no longer active.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerup_event
   */
  onPointerUp?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when an element has been scrolled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event
   */
  onScroll?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when scrolling has completed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event
   */
  onScrollEnd?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when one or more touch points have been disrupted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchcancel_event
   */
  onTouchCancel?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are removed from the touch surface.
   * NOTE: This does not mean all touches are finished in the case of a multitouch gesture.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchend_event
   */
  onTouchEnd?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are moved along the touch surface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchmove_event
   */
  onTouchMove?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are placed on the touch surface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchstart_event
   */
  onTouchStart?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when a CSS transition is cancelled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitioncancel_event
   */
  onTransitionCancel?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition has completed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event
   */
  onTransitionEnd?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition is first created.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionrun_event
   */
  onTransitionRun?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition starts playing (after any `transition-delay` has elapsed).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionstart_event
   */
  onTransitionStart?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a wheel button on a pointing device is rotated.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
   */
  onWheel?: OptionalProperty<EventHandler<WheelEvent>>;

  /*=================================*\
  ||         Event Properties        ||
  \*=================================*/

  /**
   * Fired when a CSS animation unexpectedly aborts.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationcancel_event
   */
  onanimationcancel?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a CSS animation completes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event
   */
  onanimationend?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when an iteration of a CSS animation completes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationiteration_event
   */
  onanimationiteration?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a CSS animation starts.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationstart_event
   */
  onanimationstart?: OptionalProperty<EventHandler<AnimationEvent>>;

  /**
   * Fired when a pointing device's non-primary button is pressed and released while the pointer is inside the element.
   * With a mouse, this would typically be any button other than left click.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event
   */
  onauxclick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the element has lost focus. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event
   */
  onblur?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when a pointing device is pressed and released while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
   */
  onclick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device is pressed and released while the pointer is outside the element.
   *
   * NOTE: This is a custom event that isn't supported natively by browsers.
   */
  onclickoutside?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a text composition system (such as a Chinese/Japanese IME) completes or cancels the current composition session.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event
   */
  oncompositionend?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when a text composition system (such as a Chinese/Japanese IME) starts a new composition session.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event
   */
  oncompositionstart?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when a new character is received from a session in a text composition system (such as a Chinese/Japanese IME).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionupdate_event
   */
  oncompositionupdate?: OptionalProperty<EventHandler<CompositionEvent>>;

  /**
   * Fired when the user attempts to open a context menu. Typically triggered by clicking the right mouse button.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
   */
  oncontextmenu?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointing device button is rapidly clicked twice while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event
   */
  ondblclick?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the element has received focus. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event
   */
  onfocus?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element has received focus. Fired after `onFocus`. Unlike `onFocus`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event
   */
  onfocusin?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element has lost focus. Fired after `onBlur`. Unlike `onBlur`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event
   */
  onfocusout?: OptionalProperty<EventHandler<FocusEvent>>;

  /**
   * Fired when an element enters or exits fullscreen mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenchange_event
   */
  onfullscreenchange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the browser can't switch to fullscreen mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenerror_event
   */
  onfullscreenerror?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a key on the keyboard is pressed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
   */
  onkeydown?: OptionalProperty<EventHandler<KeyboardEvent>>;

  /**
   * Fired when a key on the keyboard is released.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
   */
  onkeyup?: OptionalProperty<EventHandler<KeyboardEvent>>;

  /**
   * Fired when a pointing device button is pressed while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event
   */
  onmousedown?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device enters the bounds of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event
   */
  onmouseenter?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device leaves the bounds of an element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event
   */
  onmouseleave?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device is moved while inside the bounds of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
   */
  onmousemove?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device leaves the bounds of an element or one of its children. Unlike `onMouseLeave`, this event does bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseout_event
   */
  onmouseout?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device enters the bounds of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseover_event
   */
  onmouseover?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when a pointing device button is released while the pointer is inside the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event
   */
  onmouseup?: OptionalProperty<EventHandler<MouseEvent>>;

  /**
   * Fired when the browser determines there are unlikely to be any more pointer events.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
   */
  onpointercancel?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer becomes active inside the bounds of an element.
   * For a mouse, this is when a button is pressed. For a touchscreen, this is when a finger makes contact.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event
   */
  onpointerdown?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved into the boundary of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerenter_event
   */
  onpointerenter?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved outside the boundary of an element or one of its children.
   * For a mouse, this is when a button is released. For a touchscreen, this is when a finger leaves the screen.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerleave_event
   */
  onpointerleave?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer changes coordinates inside the bounds of an element or one of its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event
   */
  onpointermove?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is no longer in contact with an element or its children.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerout_event
   */
  onpointerout?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is moved into the boundary of an element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerover_event
   */
  onpointerover?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when a pointer is no longer active.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerup_event
   */
  onpointerup?: OptionalProperty<EventHandler<PointerEvent>>;

  /**
   * Fired when an element has been scrolled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event
   */
  onscroll?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when scrolling has completed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event
   */
  onscrollend?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when one or more touch points have been disrupted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchcancel_event
   */
  ontouchcancel?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are removed from the touch surface.
   * NOTE: This does not mean all touches are finished in the case of a multitouch gesture.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchend_event
   */
  ontouchend?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are moved along the touch surface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchmove_event
   */
  ontouchmove?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when one or more touch points are placed on the touch surface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchstart_event
   */
  ontouchstart?: OptionalProperty<EventHandler<TouchEvent>>;

  /**
   * Fired when a CSS transition is cancelled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitioncancel_event
   */
  ontransitioncancel?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition has completed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event
   */
  ontransitionend?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition is first created.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionrun_event
   */
  ontransitionrun?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a CSS transition starts playing (after any `transition-delay` has elapsed).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionstart_event
   */
  ontransitionstart?: OptionalProperty<EventHandler<TransitionEvent>>;

  /**
   * Fired when a wheel button on a pointing device is rotated.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
   */
  onwheel?: OptionalProperty<EventHandler<WheelEvent>>;
}

export interface HTMLElementProps extends ElementProps {
  /**
   * Sets the key a user can press to jump to this element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/accessKey
   */
  accessKey?: OptionalProperty<string>;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autocapitalize
   */
  autocapitalize?: OptionalProperty<AutocapitalizeValues>;

  /**
   * Indicates that this element should be focused as soon as it is connected to the DOM.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autofocus
   */
  autofocus?: OptionalProperty<boolean>;

  /**
   * Makes the element's content editable by the user. This is commonly used as the basis for web-based text editors.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/contentEditable
   */
  contentEditable?: OptionalProperty<ContentEditableValues>;

  /**
   * Specifies text directionality of the content of this element. Some languages, such as Arabic, are written from right to left (specified here as "rtl").
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dir
   */
  dir?: OptionalProperty<DirValues>;

  /**
   * Indicates that this element is draggable, that is, that the user can initiate a drag and drop operation with it.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  draggable?: OptionalProperty<boolean>;

  /**
   * Provides a hint for on-screen keyboards about what will happen when the Enter key is pressed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/enterKeyHint
   */
  enterKeyHint?: OptionalProperty<EnterKeyHintValues>;

  /**
   * Indicates that the browser should not render this content. Maps to the `hidden` attribute.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden
   */
  hidden?: OptionalProperty<HiddenValues>;

  /**
   * Indicates that this element is completely non-interactive. Elements receive no user input events while inert.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
   */
  inert?: OptionalProperty<boolean>;

  /**
   * Provides a hint about the type of data that might be entered while editing the element.
   * Can affect the display of virtual keyboards.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inputMode
   */
  inputMode?: OptionalProperty<InputModeValues>;

  /**
   * The base language of the element's attributes and text content.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lang
   */
  lang?: OptionalProperty<string>;

  // TODO: Allow nonce? This seems to be primarily used to inject scripts, which generally isn't done done in an SPA.
  // nonce?: string | Readable<string> | Readable<string | undefined>;

  /**
   * TODO: Add support. Currently experimental.
   */
  // popover?: never;

  /**
   * This element's position in the tab order, or the order this element will be focused as the user cycles through elements with the tab key.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/tabIndex
   */
  tabIndex?: OptionalProperty<number>;

  /**
   * The title of the element, which is typically displayed in a tooltip when the user hovers the mouse over the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/title
   */
  title?: OptionalProperty<string>;

  /*=================================*\
  ||     Attribute-aliased Props     ||
  \*=================================*/

  /* This section includes props that don't truly exist as props on DOM nodes, but instead map to HTML attributes.
     These attributes can be set through props on Markup elements. */

  // TODO: `is` (https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/is)

  // TODO: `item*` microdata attributes

  /*=================================*\
  ||              Events             ||
  \*=================================*/

  /**
   * Fired when the value of an `<input>` or `<textarea>` element (or any element with `contentEditable` enabled) is about to be modified.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforeinput_event
   */
  onBeforeInput?: OptionalProperty<EventHandler<InputEvent>>;

  /**
   * Fired when the user modifies the value of an `<input>`, `<textarea>` or `<select>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
   */
  onChange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user copies some content to the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/copy_event
   */
  onCopy?: OptionalProperty<EventHandler<ClipboardEvent>>;

  /**
   * Fired when the user cuts some content to the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/cut_event
   */
  onCut?: OptionalProperty<EventHandler<ClipboardEvent>>;

  /**
   * Fired periodically as the user is dragging in the context of a drag and drop operation.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drag_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDrag?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a drag operation ends.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragend_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDragEnd?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content enters a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragenter_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDragEnter?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content leaves a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragleave_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDragLeave?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired periodically as the user is dragging an element or content over a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDragOver?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a user begins dragging an element or content.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragstart_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDragStart?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content is dropped onto a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drop_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  onDrop?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a resource failed to load, for example, if the `src` can't be resolved on an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event
   */
  onError?: OptionalProperty<EventHandler<UIEvent | Event>>;

  /**
   * Fired when a resource failed to load, for example, if the `src` can't be resolved on an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/input_event
   */
  onInput?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a resource was successfully loaded, for example, when the `src` is loaded for an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event
   */
  onLoad?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user pastes some content from the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/paste_event
   */
  onPaste?: OptionalProperty<EventHandler<ClipboardEvent>>;

  /*=================================*\
  ||        Event Properties         ||
  \*=================================*/

  /**
   * Fired when the value of an `<input>` or `<textarea>` element (or any element with `contentEditable` enabled) is about to be modified.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforeinput_event
   */
  onbeforeinput?: OptionalProperty<EventHandler<InputEvent>>;

  /**
   * Fired when the user modifies the value of an `<input>`, `<textarea>` or `<select>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
   */
  onchange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user copies some content to the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/copy_event
   */
  oncopy?: OptionalProperty<EventHandler<ClipboardEvent>>;

  /**
   * Fired when the user cuts some content to the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/cut_event
   */
  oncut?: OptionalProperty<EventHandler<ClipboardEvent>>;

  /**
   * Fired periodically as the user is dragging in the context of a drag and drop operation.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drag_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondrag?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a drag operation ends.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragend_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondragend?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content enters a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragenter_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondragenter?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content leaves a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragleave_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondragleave?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired periodically as the user is dragging an element or content over a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondragover?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a user begins dragging an element or content.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragstart_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondragstart?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a dragged element or content is dropped onto a drop target.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drop_event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   */
  ondrop?: OptionalProperty<EventHandler<DragEvent>>;

  /**
   * Fired when a resource failed to load, for example, if the `src` can't be resolved on an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event
   */
  onerror?: OptionalProperty<EventHandler<UIEvent | Event>>;

  /**
   * Fired when a resource failed to load, for example, if the `src` can't be resolved on an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/input_event
   */
  oninput?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a resource was successfully loaded, for example, when the `src` is loaded for an `<image>` element. This event does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event
   */
  onload?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user pastes some content from the clipboard.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/paste_event
   */
  onpaste?: OptionalProperty<EventHandler<ClipboardEvent>>;
}

export interface SVGElementProps extends ElementProps {
  /**
   * A mixin function or an array of mixin functions to be applied to this element.
   */
  mixin?: Mixin<SVGElement> | Mixin<SVGElement>[];
}

/**
 * Mapping of event props to event names.
 */
export const eventPropsToEventNames = {
  // ----- Element events ----- //

  onAnimationCancel: "animationcancel",
  onAnimationEnd: "animationend",
  onAnimationIteration: "animationiteration",
  onAnimationStart: "animationstart",
  onAuxClick: "auxclick",
  onBlur: "blur",
  onClick: "click",
  onCompositionEnd: "compositionend",
  onCompositionStart: "compositionstart",
  onCompositionUpdate: "compositionupdate",
  onDoubleClick: "dblclick",
  onFocus: "focus",
  onFocusIn: "focusin",
  onFocusOut: "focusout",
  onFullscreenChange: "fullscreenchange",
  onFullscreenError: "fullscreenerror",
  onKeyDown: "keydown",
  onKeyUp: "keyup",
  onMouseDown: "mousedown",
  onMouseEnter: "mouseenter",
  onMouseLeave: "mouseleave",
  onMouseMove: "mousemove",
  onMouseOut: "mouseout",
  onMouseOver: "mouseover",
  onMouseUp: "mouseup",
  onPointerCancel: "pointercancel",
  onPointerDown: "pointerdown",
  onPointerEnter: "pointerenter",
  onPointerLeave: "pointerleave",
  onPointerMove: "pointermove",
  onPointerOut: "pointerout",
  onPointerOver: "pointerover",
  onPointerUp: "pointerup",
  onScroll: "scroll",
  onScrollEnd: "scrollend",
  onTouchCancel: "touchcancel",
  onTouchEnd: "touchend",
  onTouchMove: "touchmove",
  onTouchStart: "touchstart",
  onTransitionCancel: "transitioncancel",
  onTransitionEnd: "transitionend",
  onTransitionRun: "transitionrun",
  onTransitionStart: "transitionstart",
  onWheel: "wheel",

  // ----- HTMLElement events ----- //

  onBeforeInput: "beforeinput",
  onChange: "change",
  onCopy: "copy",
  onCut: "cut",
  onDrag: "drag",
  onDragEnd: "dragend",
  onDragEnter: "dragenter",
  onDragLeave: "dragleave",
  onDragOver: "dragover",
  onDragStart: "dragstart",
  onDrop: "drop",
  onError: "error",
  onInput: "input",
  onLoad: "load",
  onPaste: "paste",

  // ----- HTMLMediaElement events ----- //

  onAbort: "abort",
  onCanPlay: "canplay",
  onCanPlayThrough: "canplaythrough",
  onDurationChange: "durationchange",
  onEmptied: "emptied",
  onEncrypted: "encrypted",
  onEnded: "ended",
  onLoadedData: "loadeddata",
  onLoadedMetadata: "loadedmetadata",
  onLoadStart: "loadstart",
  onPause: "pause",
  onPlay: "play",
  onPlaying: "playing",
  onProgress: "progress",
  onRateChange: "ratechange",
  onSeeked: "seeked",
  onSeeking: "seeking",
  onStalled: "stalled",
  onSuspend: "suspend",
  onTimeUpdate: "timeupdate",
  onVolumeChange: "volumechange",
  onWaiting: "waiting",

  // ----- HTMLFormElement events ----- //

  onFormData: "formdata",
  onReset: "reset",
  onSubmit: "submit",

  // ----- HTMLInputElement events ----- //

  onInvalid: "invalid",
  onSelect: "select",
};

/**
 * The set of HTML attributes supported by all HTML elements.
 */
export interface HTMLGlobalAttributes {
  /**
   * The accesskey global attribute provides a hint for generating a keyboard shortcut
   * for the current element. The attribute value must consist of a single printable character
   * (which includes accented and other characters that can be generated by the keyboard).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/accesskey
   */
  accesskey: string;

  /**
   * The autocapitalize global attribute is an enumerated attribute that controls whether and
   * how text input is automatically capitalized as it is entered/edited by the user.
   *
   * The attribute must take one of the following values:
   *   - `off` or `none`: No autocapitalization is applied (all letters default to lowercase)
   *   - `on` or `sentences`: The first letter of each sentence defaults to a capital letter; all other letters default to lowercase
   *   - `words`: The first letter of each word defaults to a capital letter; all other letters default to lowercase
   *   - `characters`: All letters should default to uppercase
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autocapitalize
   */
  autocapitalize: "off" | "on" | "none" | "sentences" | "words" | "characters";

  /**
   * The `autofocus` attribute allows the author to indicate that an element
   * is to be focused as soon as the page is loaded or as soon as the dialog within
   * which it finds itself is shown, allowing the user to just start typing without
   * having to manually focus the main element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autofocus
   */
  autofocus: boolean;

  /**
   * CSS classes to be applied to this element. In addition to the standard space-separated list of class names,
   * this attribute is expanded in Dolla to also support a class map object with class names as keys and booleans as values.
   * Class names in a class map will be applied to the element while their values are true. Also supports an
   * array of strings and class maps.
   *
   * @example
   * <div class="one-class" />
   *
   * <div class={["array", "of", "classes"]} />
   *
   * <div class={{ applied: true, notApplied: false }} />
   *
   * <div class={["class", "class2", { "conditional": $value }]} />
   */
  class: string | ClassMap | Array<string | ClassMap | (string | ClassMap)[]>;

  /**
   * Specifies whether the element's content can be edited.
   *
   * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-contenteditable
   */
  contenteditable: "" | "true" | "false";

  /**
   * Specifies the element's text directionality.
   *
   * @see https://html.spec.whatwg.org/multipage/dom.html#attr-dir
   */
  dir: "ltr" | "rtl" | "auto";

  /**
   * Specifies whether the element is draggable for use with the [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API).
   *
   * @see https://html.spec.whatwg.org/multipage/dnd.html#attr-draggable
   */
  draggable: "true" | "false";

  /**
   * The `enterkeyhint` attribute defines what action label (or icon) to present for the enter key on virtual keyboards.
   * This allows authors to customize the presentation of the enter key in order to make it more helpful for users.
   *
   * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-enterkeyhint
   */
  enterkeyhint: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";

  /**
   * The `hidden` global attribute is a Boolean attribute indicating that the element is not yet,
   * or is no longer, relevant. For example, it can be used to hide elements of the page that can't
   * be used until the login process has been completed. Browsers won't render elements with the `hidden` attribute set.
   *
   * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-hidden
   */
  hidden: boolean;

  /**
   * The `id` defines an identifier (ID) which must be unique in the whole document. Its purpose is
   * to identify the element when linking, scripting, or styling with CSS.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
   */
  id: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute
   */
  inert: boolean;

  /**
   * The `inputmode` content attribute is an enumerated attribute that specifies what kind of input mechanism would be most helpful for users entering content.
   */
  inputmode: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";

  /**
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#attr-is
   */
  is: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
   */
  itemid: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
   */
  itemprop: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
   */
  itemref: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
   */
  itemscope: boolean;

  /**
   * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
   */
  itemtype: string;

  /**
   * The `lang` global attribute helps define the language of an element: the language that non-editable elements are written in,
   * or the language that the editable elements should be written in by the user. The attribute contains a single "language tag"
   * in the format defined in [RFC 5646: Tags for Identifying Languages (also known as BCP 47)](https://datatracker.ietf.org/doc/html/rfc5646).
   *
   * @example
   * ```html
   * <span lang="ja">おはようございます</span>
   * ```
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang
   */
  lang: string;

  /**
   * @see https://html.spec.whatwg.org/multipage/urls-and-fetching.html#attr-nonce
   */
  nonce: string;

  /**
   * Specifies if the element is to have its spelling and grammar checked.
   *
   * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-spellcheck
   */
  spellcheck: "" | "true" | "false";

  /**
   * Inline CSS styles.
   */
  style: CSSProperties;

  /**
   * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
   */
  tabindex: number;

  /**
   * The `title` attribute represents advisory information for the element, such as would be appropriate for a tooltip.
   * On a link, this could be the title or a description of the target resource; on an image, it could be the image credit
   * or a description of the image; on a paragraph, it could be a footnote or commentary on the text; on a citation,
   * it could be further information about the source; on interactive content, it could be a label for, or instructions for,
   * use of the element; and so forth.
   *
   * @see https://html.spec.whatwg.org/multipage/dom.html#attr-title
   */
  title: string;

  /**
   * The `translate` global attribute is an enumerated attribute that is used to specify whether an element's _translatable attribute_
   *  values and its `Text` node children should be translated when the page is localized, or whether to leave them unchanged.
   *
   * @see https://html.spec.whatwg.org/multipage/dom.html#attr-translate
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate
   */
  translate: "" | "yes" | "no";
}

export interface Styles extends CSS.Properties, CSS.PropertiesHyphen {
  [key: string]: any;
}

export type CSSProperties = {
  [K in keyof Styles]: OptionalProperty<Styles[K]>;
};

export interface ClassMap {
  [className: string]: MaybeSignal<any>;
}

export type EventHandler<E> = (event: E) => void;

export interface PropertiesOf<E extends HTMLElement> extends HTMLElementProps {
  /**
   * For TypeScript support; child elements passed through JSX.
   */
  children?: any;

  /**
   * Receives a reference to the DOM node when rendered.
   */
  ref?:
    | ((value: E | undefined) => void)
    | ((value: HTMLElement | undefined) => void)
    | ((value: Element | undefined) => void)
    | ((value: Node | undefined) => void);

  /**
   * A mixin function or an array of mixin functions to be applied to this element.
   */
  mixin?: Mixin<E> | Mixin<E>[];
}

/**
 * The following elements are defined based on the WHATWG HTML spec:
 * https://html.spec.whatwg.org/multipage/#toc-semantics
 **/

/*====================================*\
|| 4.3                       Sections ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The `article` element represents a complete, or self-contained, composition in a document, page, application,
   * or site and that is, in principle, independently distributable or reusable, e.g. in syndication. This could be a forum post,
   * a magazine or newspaper article, a blog entry, a user-submitted comment, an interactive widget or gadget,
   * or any other independent item of content.
   *
   * When `article` elements are nested, the inner `article` elements represent articles that are in principle
   * related to the contents of the outer article. For instance, a blog entry on a site that accepts user-submitted
   * comments could represent the comments as `article` elements nested within the `article` element for the blog entry.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-article-element
   */
  article: PropertiesOf<HTMLElement>;

  /**
   * The `section` element represents a generic section of a document or application. A section, in this context,
   * is a thematic grouping of content, typically with a heading.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-section-element
   */
  section: PropertiesOf<HTMLElement>;

  /**
   * The `nav` element represents a section of a page that links to other pages or to parts within the page: a section with navigation links.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-nav-element
   */
  nav: PropertiesOf<HTMLElement>;

  /**
   * The `aside` element represents a section of a page that consists of content that is tangentially related
   * to the content around the `aside` element, and which could be considered separate from that content.
   * Such sections are often represented as sidebars in printed typography.
   *
   * The element can be used for typographical effects like pull quotes or sidebars, for advertising,
   * for groups of nav elements, and for other content that is considered separate from the main content of the page.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-aside-element
   */
  aside: PropertiesOf<HTMLElement>;

  /**
   * A heading for a top-level section.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h1: PropertiesOf<HTMLHeadingElement>;

  /**
   * A heading for a subsection.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h2: PropertiesOf<HTMLHeadingElement>;

  /**
   * A heading for a sub-subsection.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h3: PropertiesOf<HTMLHeadingElement>;

  /**
   * A heading for a sub-sub-subsection.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h4: PropertiesOf<HTMLHeadingElement>;

  /**
   * A heading for a sub-sub-sub-subsection.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h5: PropertiesOf<HTMLHeadingElement>;

  /**
   * A heading for a sub-sub-sub-subsection.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
   */
  h6: PropertiesOf<HTMLHeadingElement>;

  /**
   * The `hgroup` element represents a heading and related content. The element may be used to group an
   * `h1`–`h6` element with one or more `p` elements containing content representing a subheading,
   * alternative title, or tagline.
   *
   * @example
   * ```html
   * <hgroup>
   *   <h1>Dr. Strangelove</h1>
   *   <p>Or: How I Learned to Stop Worrying and Love the Bomb</p>
   * </hgroup>
   * ```
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-hgroup-element
   */
  hgroup: PropertiesOf<HTMLElement>;

  /**
   * The `header` element represents a group of introductory or navigational aids.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-header-element
   */
  header: PropertiesOf<HTMLElement>;

  /**
   * The `footer` element represents a footer for its nearest ancestor `article`, `aside`, `nav`, or `section`,
   * or for the `body` element if there is no such ancestor. A footer typically contains information about
   * its section such as who wrote it, links to related documents, copyright data, and the like.
   *
   * When the `footer` element contains entire sections, they represent appendices, indices, long colophons,
   * verbose license agreements, and other such content.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-footer-element
   */
  footer: PropertiesOf<HTMLElement>;

  /**
   * The `address` element represents the contact information for its nearest `article` or `body` element ancestor.
   * If that is the `body` element, then the contact information applies to the document as a whole.
   *
   * @see https://html.spec.whatwg.org/multipage/sections.html#the-address-element
   */
  address: PropertiesOf<HTMLElement>;
}

/*====================================*\
|| 4.4               Grouping content ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The `p` element represents a paragraph.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element
   */
  p: PropertiesOf<HTMLParagraphElement>;

  /**
   * The `hr` element represents a paragraph-level thematic break, e.g. a scene change in a story,
   * or a transition to another topic within a section of a reference book.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-hr-element
   */
  hr: PropertiesOf<HTMLHRElement>;

  /**
   * The `pre` element represents a block of preformatted text, in which structure is represented
   * by typographic conventions rather than by elements.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
   */
  pre: PropertiesOf<HTMLPreElement>;

  /**
   * The `blockquote` element represents a section that is quoted from another source.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-blockquote-element
   */
  blockquote: HTMLQuoteElementProps;

  /**
   * The `ol` element represents a list of items, where the items have been intentionally ordered,
   * such that changing the order would change the meaning of the document.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-ol-element
   */
  ol: HTMLOListElementProps;

  /**
   * The `ul` element represents a list of items, where the order of the items is not important —
   * that is, where changing the order would not materially change the meaning of the document.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-ul-element
   */
  ul: PropertiesOf<HTMLUListElement>;

  /**
   * The `menu` element represents a toolbar consisting of its contents, in the form of
   * an unordered list of items (represented by `li` elements), each of which represents
   * a command that the user can perform or activate.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-menu-element
   */
  menu: PropertiesOf<HTMLMenuElement>;

  /**
   * The `li` element represents a list item. If its parent element is an `ol`, `ul`, or `menu` element,
   * then the element is an item of the parent element's list.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-li-element
   */
  li: PropertiesOf<HTMLLIElement>;

  /**
   * The `dl` element represents an association list consisting of zero or more name-value groups
   * (a description list). Name-value groups may be terms and definitions, metadata topics and values,
   * questions and answers, or any other groups of name-value data.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dl-element
   */
  dl: PropertiesOf<HTMLDListElement>;

  /**
   * The `dt` element represents the term, or name, part of a term-description group in a description list (`dl` element).
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dt-element
   */
  dt: PropertiesOf<HTMLElement>;

  /**
   * The `dd` element represents the description, definition, or value, part of a term-description group in a description list (`dl` element).
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dd-element
   */
  dd: PropertiesOf<HTMLElement>;

  /**
   * The `figure` element represents some [flow content](https://html.spec.whatwg.org/multipage/dom.html#flow-content-2),
   * optionally with a caption, that is self-contained (like a complete sentence) and is typically referenced as
   * a single unit from the main flow of the document.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-figure-element
   */
  figure: PropertiesOf<HTMLElement>;

  /**
   * The `figcaption` element represents a caption or legend for the rest of the contents of the
   * `figcaption` element's parent `figure` element, if any.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-figcaption-element
   */
  figcaption: PropertiesOf<HTMLElement>;

  /**
   * The `main` element represents the dominant contents of the document. A document must not
   * have more than one `main` element that does not have the `hidden` attribute specified.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-main-element
   */
  main: PropertiesOf<HTMLElement>;

  /**
   * The `div` element has no special meaning at all. It represents its children.
   *
   * Authors are strongly encouraged to window the `div` element as an element of last resort,
   * for when no other element is suitable. Use of more appropriate elements instead of the `div`
   * element leads to better accessibility for readers and easier maintainability for authors.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-div-element
   */
  div: PropertiesOf<HTMLDivElement>;
}

interface HTMLQuoteElementProps extends PropertiesOf<HTMLQuoteElement> {
  /**
   * Link to the source of the quotation. Must be a valid URL potentially surrounded by spaces.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-blockquote-cite
   */
  cite?: OptionalProperty<string>;
}

interface HTMLOListElementProps extends PropertiesOf<HTMLOListElement> {
  /**
   * Indicates that the list is a descending list (..., 3, 2, 1).
   * If the attribute is omitted, the list is an ascending list (1, 2, 3, ...).
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-reversed
   */
  reversed?: OptionalProperty<boolean>;

  /**
   * Starting value of the list.
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-start
   */
  start?: OptionalProperty<number>;

  /**
   * The `type` attribute can be used to specify the kind of marker to use in the list,
   * in the cases where that matters (e.g. because items are to be referenced by their number/letter).
   *
   * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-type
   */
  type?: OptionalProperty<"l" | "a" | "A" | "i" | "I">;
}

/*====================================*\
|| 4.5           Text-level semantics ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * Creates a hyperlink to web pages, files, email addresses, locations in the same page, or anything else a URL can address.
   *
   * Content within each `<a>` should indicate the link's destination.
   * If the `href` attribute is present, pressing the enter key while focused on the `<a>` element will activate it.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a
   */
  a: HTMLAnchorElementProps;

  /**
   * Marks text that has stress emphasis. The `<em>` element can be nested, each level of nesting indicating a greater degree of emphasis.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/em
   */
  em: PropertiesOf<HTMLElement>;

  /**
   * Indicates that its contents have strong importance, seriousness, or urgency. Browsers typically render the contents in bold type.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/strong
   */
  strong: PropertiesOf<HTMLElement>;

  /**
   * Represents side-comments and small print, like copyright and legal text.
   * Renders text within it one font-size smaller, such as from `small` to `x-small`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/small
   */
  small: PropertiesOf<HTMLElement>;

  /**
   * Renders text with a strikethrough, or a line through it. Use the `<s>` element to represent things that are no longer relevant or no longer accurate.
   * However, `<s>` is not appropriate when indicating document edits; for that, use the `<del>` and `<ins>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/s
   */
  s: PropertiesOf<HTMLElement>;

  /**
   * Used to describe a reference to a cited creative work, and must include the title of that work.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/cite
   */
  cite: PropertiesOf<HTMLElement>;

  /**
   * indicates that the enclosed text is a short inline quotation. Most modern browsers implement this by surrounding the text in quotation marks.
   * For long quotations with paragraph breaks use the `<blockquote>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/q
   */
  q: PropertiesOf<HTMLElement>;

  /**
   * Used to indicate the term being defined within the context of a definition phrase or sentence.
   * The `<p>` element, the `<dt>`/`<dd>` pairing, or the `<section>` element which is the nearest ancestor of the `<dfn>` is considered to be the definition of the term.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dfn
   */
  dfn: PropertiesOf<HTMLElement>;

  /**
   * Indicates an abbreviation or acronym. Provide a full expansion of the term in plain text on first use, along with the `<abbr>` to mark up the abbreviation.
   * This informs the user what the abbreviation or acronym means.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/abbr
   */
  abbr: HTMLAbbrElementProps;

  /**
   * Represents small annotations that are rendered above, below, or next to base text, usually used for showing the pronunciation of East Asian characters.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ruby
   */
  ruby: PropertiesOf<HTMLElement>;

  /**
   * Specifies the ruby text component of a ruby annotation, which is used to provide pronunciation, translation,
   * or transliteration information for East Asian typography. The `<rt>` element must always be contained within a `<ruby>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/rt
   */
  rt: PropertiesOf<HTMLElement>;

  /**
   * Provide a fall-back parentheses for browsers that do not support display of ruby annotations using the `<ruby>` element.
   * One `<rp>` element should contain the `<rt>` element that contains the annotation's text.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/rp
   */
  rp: PropertiesOf<HTMLElement>;

  /**
   * Wraps a piece of content, providing an additional machine-Readable version in a `value` attribute.
   * For date or time related data, a `<time>` element is preferred.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/data
   */
  data: HTMLDataElementProps;

  /**
   * Represents a specific period in time. It may include the `datetime` attribute to translate dates into machine-Readable format,
   * allowing for better search engine results or custom features such as reminders.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time
   */
  time: HTMLTimeElementProps;

  /**
   * Displays its contents styled in a fashion intended to indicate that the text is a short fragment of computer code.
   * By default, the content text is displayed using a monospace font.
   *
   * You can display larger, multi-line `<code>` snippets by wrapping them with `<pre>` tags to keep the original line breaks.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/code
   */
  code: PropertiesOf<HTMLElement>;

  /**
   * Represents the name of a variable in a mathematical expression or a programming context.
   * Represented in italics by default in most browsers.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/var
   */
  var: PropertiesOf<HTMLElement>;

  /**
   * Represents `<samp>`le output from a computer program. Displayed with a monospace font by default.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/samp
   */
  samp: PropertiesOf<HTMLElement>;

  /**
   * Represents text a user would input with keyboard, voice, or another text entry device.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/kbd
   */
  kbd: PropertiesOf<HTMLElement>;

  /**
   * Represents a superscript (like the 2 in E=mc2).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/sup
   */
  sup: PropertiesOf<HTMLElement>;

  /**
   * Represents a subscript (like the 2 in H2O).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/sub
   */
  sub: PropertiesOf<HTMLElement>;

  /**
   * The _idiomatic text_ element.
   *
   * Represents a range of text that is set off from the normal text for some reason, such as idiomatic text,
   * technical terms, taxonomical designations, among others. Historically, these have been presented using italicized type,
   * which is the original source of the `<i>` naming of this element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/i
   */
  i: PropertiesOf<HTMLElement>;

  /**
   * The _Bring Attention To_ element.
   *
   * Draws the reader's attention to the element's contents, which are not otherwise granted special importance.
   * This was formerly known as the Boldface element, and most browsers still draw the text in boldface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/b
   */
  b: PropertiesOf<HTMLElement>;

  /**
   * The _Unarticulated Annotation_ (Underline) element.
   *
   * Represents a span of inline text which should be rendered in a way that indicates that it has a non-textual annotation.
   * This is rendered by default as a simple solid underline.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/u
   */
  u: PropertiesOf<HTMLElement>;

  /**
   * The _Mark Text_ element.
   *
   * Represents text which is marked or highlighted for reference or notation purposes,
   * due to the marked passage's relevance or importance in the enclosing context.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/mark
   */
  mark: PropertiesOf<HTMLElement>;

  /**
   * The _Bidirectional Isolate__ element.
   *
   * Tells the browser's bidirectional algorithm to treat the text it contains in isolation from its surrounding text.
   * It's particularly useful when a website dynamically inserts some text and doesn't know the directionality of the text being inserted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi
   */
  bdi: PropertiesOf<HTMLElement>;

  /**
   * The _Bidirectional Text Override_ element.
   *
   * Overrides the current directionality of text, so that the text within is rendered in a different direction.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdo
   */
  bdo: PropertiesOf<HTMLElement>;

  /**
   * The _Content Span_ element.
   *
   * A generic inline container for phrasing content, which does not inherently represent anything.
   * It can be used to group elements for styling purposes (using the `class` or `id` attributes),
   * or because they share attribute values, such as `lang`. It should be used only when no other semantic element
   * is appropriate. `<span>` is very much like a `<div>` element, but `<div>` is a block-level element
   * whereas `<span>` is an inline element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span
   */
  span: PropertiesOf<HTMLSpanElement>;

  /**
   * The _Line Break_ element.
   *
   * Produces a line break (carriage-return) in text. HTML does not preserve line breaks outside a `<pre>` or element
   * with similar CSS, but they can be explicitly represented with a `<br>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/br
   */
  br: PropertiesOf<HTMLBRElement>;

  /**
   * The _Line Break Opportunity_ element.
   *
   * Represents a word break opportunity—a position within text where the browser may optionally break a line,
   * though its line-breaking rules would not otherwise create a break at that location.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/wbr
   */
  wbr: PropertiesOf<HTMLElement>;
}

interface HTMLAnchorElementProps extends PropertiesOf<HTMLAnchorElement> {
  /**
   * A hyperlink address. Must be a valid URL potentially surrounded by spaces.
   *
   * @see https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element
   */
  href?: OptionalProperty<string>;

  /**
   * Where to display the linked URL, as the name for a browsing context (a tab, window, or `<iframe>`)
   *
   * A common usage is `target: "_blank"` to cause a link to open in a new tab.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-target
   */
  target?: OptionalProperty<"_self" | "_blank" | "parent" | "_top">;

  /**
   * Causes the browser to treat the linked URL as a download. Can be used with or without a value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download
   */
  download?: OptionalProperty<string>;

  /**
   * A space-separated list of URLs. When the link is followed, the browser will send `POST` requests with the body PING to the URLs.
   * Typically for tracking.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-ping
   */
  ping?: OptionalProperty<string>;

  /**
   * The relationship of the linked URL as space-separated [link types](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-hreflang
   */
  rel?: OptionalProperty<string>;

  /**
   * Hints at the human language of the linked URL. No built-in functionality.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-hreflang
   */
  hrefLang?: OptionalProperty<string>;

  /**
   * Hints at the linked URL's format with a [MIME type](https://developer.mozilla.org/en-US/docs/Glossary/MIME_type). No built-in functionality.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-type
   */
  type?: OptionalProperty<string>;

  /**
   * How much of the [referrer](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer)
   * to send when following the link.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-referrerpolicy
   */
  referrerPolicy?: OptionalProperty<
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
  >;
}

interface HTMLAbbrElementProps extends PropertiesOf<HTMLElement> {
  /**
   * Provides an expansion for the abbreviation or acronym when a full expansion is not present.
   * This provides a hint to user agents on how to announce/display the content while informing all users what the abbreviation means.
   * If present, `title` must contain this full description and nothing else.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/abbr
   */
  title?: OptionalProperty<string>;
}

interface HTMLDataElementProps extends PropertiesOf<HTMLDataElement> {
  /**
   * Specifies the machine-Readable translation of the content of the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/data
   */
  value?: OptionalProperty<string>;
}

interface HTMLTimeElementProps extends PropertiesOf<HTMLTimeElement> {
  /**
   * Indicates the time and/or date of the element. Must be in one of the formats below:
   *
   *
   * a valid year string
   * ```
   * 2011
   * ```
   *
   * a valid month string
   * ```
   * 2011-11
   * ```
   *
   * a valid date string
   * ```
   * 2011-11-18
   * ```
   *
   * a valid yearless date string
   * ```
   * 11-18
   * ```
   *
   * a valid week string
   * ```
   * 2011-W47
   * ```
   *
   * a valid time string
   * ```
   * 14:54
   * 14:54:39
   * 14:54:39.929
   * ```
   *
   * a valid local date and time string
   * ```
   * 2011-11-18T14:54:39.929
   * 2011-11-18 14:54:39.929
   * ```
   *
   * a valid global date and time string
   * ```
   * 2011-11-18T14:54:39.929Z
   * 2011-11-18T14:54:39.929-0400
   * 2011-11-18T14:54:39.929-04:00
   * 2011-11-18 14:54:39.929Z
   * 2011-11-18 14:54:39.929-0400
   * 2011-11-18 14:54:39.929-04:00
   * ```
   *
   * a valid duration string
   * ```
   * PT4H18M3S
   * ```
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time
   */
  datetime?: OptionalProperty<string>;
}

/*====================================*\
|| 4.6                          Links ||
\*====================================*/

// --- This is just about <a> and <area> attributes in the spec.

/*====================================*\
|| 4.7                          Edits ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The _Inserted Text_ element.
   *
   * Represents a range of text that has been added to a document. You can use the `<del>` element to similarly
   * represent a range of text that has been deleted from the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ins
   */
  ins: ModElementProps;

  /**
   * The _Deleted Text_ element.
   *
   * Represents a range of text that has been deleted from a document. This can be used when blueprints "track changes"
   * or source code diff information, for example. The `<ins>` element can be used for the opposite purpose: to indicate
   * text that has been added to the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/del
   */
  del: ModElementProps;
}

interface ModElementProps extends PropertiesOf<HTMLModElement> {
  /**
   * A URL pointing to content that explains this change.
   * User agents may allow users to follow such citation links, but they are primarily intended for private use
   * (e.g., by server-side scripts collecting statistics about a site's edits), not for readers.
   */
  cite?: OptionalProperty<string>;

  /**
   * Indicates the time and/or date of the element. Must be in one of the formats below:
   *
   *
   * a valid year string
   * ```
   * 2011
   * ```
   *
   * a valid month string
   * ```
   * 2011-11
   * ```
   *
   * a valid date string
   * ```
   * 2011-11-18
   * ```
   *
   * a valid yearless date string
   * ```
   * 11-18
   * ```
   *
   * a valid week string
   * ```
   * 2011-W47
   * ```
   *
   * a valid time string
   * ```
   * 14:54
   * 14:54:39
   * 14:54:39.929
   * ```
   *
   * a valid local date and time string
   * ```
   * 2011-11-18T14:54:39.929
   * 2011-11-18 14:54:39.929
   * ```
   *
   * a valid global date and time string
   * ```
   * 2011-11-18T14:54:39.929Z
   * 2011-11-18T14:54:39.929-0400
   * 2011-11-18T14:54:39.929-04:00
   * 2011-11-18 14:54:39.929Z
   * 2011-11-18 14:54:39.929-0400
   * 2011-11-18 14:54:39.929-04:00
   * ```
   *
   * a valid duration string
   * ```
   * PT4H18M3S
   * ```
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time
   */
  datetime?: OptionalProperty<string>;
}

/*====================================*\
|| 4.8               Embedded Content ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The _Picture_ element.
   *
   * Contains zero or more `<source>` elements and one `<img>` element to offer alternative versions of an image
   * for different display/device scenarios.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture
   */
  picture: PropertiesOf<HTMLPictureElement>;

  /**
   * The _Media or Image Source_ element.
   *
   * Specifies multiple media resources for a `<picture>`, `<audio>` or `<video>` element. Commonly used to offer
   * the same media content in multiple file formats in order to provide compatibility with a broad range of browsers.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source
   */
  source: HTMLSourceElementProps;

  /**
   * The _Image Embed_ element.
   *
   * Embeds an image into the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img
   */
  img: HTMLImageElementProps;

  /**
   * The _Inline Frame_ element.
   *
   * Represents a nested [browsing context](https://developer.mozilla.org/en-US/docs/Glossary/Browsing_context),
   * embedding another HTML page into the current one.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
   */
  iframe: HTMLIFrameElementProps;

  /**
   * The _Embed External Content_ element.
   *
   * Embeds external content at the specified point in the document. This content is provided by an external
   * application or other source of interactive content such as a browser plug-in.
   *
   * Most modern browsers have deprecated and removed support for browser plug-ins, so relying upon `<embed>`
   * is generally not wise if you want your site to be operable on the average user's browser.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/embed
   */
  embed: HTMLEmbedElementProps;

  /**
   * The _External Object_ element.
   *
   * Represents an external resource, which can be treated as an image, a nested browsing context,
   * or a resource to be handled by a plugin.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/object
   */
  object: HTMLObjectElementProps;

  /**
   * The _Video Embed_ element.
   *
   * Embeds a video player. You can use `<video>` for audio content as well,
   * but the `<audio>` element may provide a more appropriate user experience.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
   */
  video: HTMLVideoElementProps;

  /**
   * The _Embed Audio_ element.
   *
   * Embeds an audio player. It may contain one or more audio sources, represented using the `src` attribute or the
   * `<source>` element: the browser will choose the most suitable one.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio
   */
  audio: HTMLMediaElementProps<HTMLAudioElement>;

  /**
   * The _Embed Text Track_ element.
   *
   * Provides subtitles or other time-based data to a parent `<video>` or `<audio>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track
   */
  track: HTMLTrackElementProps;

  /**
   * The _Image Map_ element.
   *
   * Used with `<area>` elements to define an image map. An image map allows geometric areas on an image to be
   * associated with links.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/map
   */
  map: HTMLMapElementProps;

  /**
   * The _Image Map Area_ element.
   *
   * Defines an area inside an image map that has predefined clickable areas. An image map allows geometric areas
   * on an image to be associated with links.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area
   */
  area: HTMLAreaElementProps;
}

interface HTMLMediaElementProps<T extends HTMLMediaElement> extends HTMLElementProps, PropertiesOf<T> {
  /**
   * Play the media automatically when it loads.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/autoplay
   */
  autoplay?: OptionalProperty<boolean>;

  /**
   * Display playback controls.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controls
   */
  controls?: OptionalProperty<boolean>;

  /**
   * Indicates whether to use CORS to fetch the media. If not present the media is fetched without a CORS request.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/crossOrigin
   */
  crossOrigin?: OptionalProperty<"anonymous" | "use-credentials">;

  /**
   * Indicates whether the media will start over automatically once the end is reached.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loop
   */
  loop?: OptionalProperty<boolean>;

  /**
   * Indicates whether the media element will play audio. A value of `true` will prevent audio playback.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted
   */
  muted?: OptionalProperty<boolean>;

  /**
   * Indicates whether the media element is paused.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/paused
   */
  paused?: OptionalProperty<boolean>;

  /**
   * Controls the rate at which the media is played back. 1.0 is normal speed, 0.5 is half speed and 2.0 is double speed, though any value is allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
   */
  playbackRate?: OptionalProperty<number>;

  /**
   * When `true` the pitch is adjusted to compensate for changes in `playbackRate`. Defaults to `true`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
   */
  preservesPitch?: OptionalProperty<boolean>;

  /**
   * Tells the browser what to preload before the user begins playing the media.
   *
   * - `none` will preload nothing.
   * - `metadata` will preload only metadata such as length.
   * - `auto` or `""` will allow preloading of the entire file before playback begins.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#attr-preload
   */
  preload?: OptionalProperty<"none" | "metadata" | "auto" | "">;

  /**
   * The URL of a media resource to use in the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/src
   */
  src?: OptionalProperty<string>;

  /**
   * An object containing a media resource to use in the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject
   */
  srcObject?:
    | MediaStream
    | MediaSource
    | Blob
    | File
    | Signal<MediaStream>
    | Signal<MediaStream | undefined>
    | Signal<MediaSource>
    | Signal<MediaSource | undefined>
    | Signal<Blob>
    | Signal<Blob | undefined>
    | Signal<File>
    | Signal<File | undefined>;

  /**
   * The current audio volume of the media element. Must be a number between 0 and 1.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
   */
  volume?: OptionalProperty<number>;

  /*=================================*\
  ||              Events             ||
  \*=================================*/

  /**
   * Fired when the resource was not fully loaded, but not as the result of an error.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/abort_event
   */
  onAbort?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent can play the media, but estimates that not enough data has been loaded
   * to play the media up to its end without having to stop for further buffering of content.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event
   */
  onCanPlay?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent can play the media, and estimates that enough data has been loaded
   * to play the media up to its end without having to stop for further buffering of content.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplaythrough_event
   */
  onCanPlayThrough?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the duration attribute has been updated.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/durationchange_event
   */
  onDurationChange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the media has become empty; for example, this event is sent if the media has already been loaded
   * (or partially loaded), and the `load()` method is called to reload it.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/emptied_event
   */
  onEmptied?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the media encounters some initialization data indicating it is encrypted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/encrypted_event
   */
  onEncrypted?: OptionalProperty<EventHandler<MediaEncryptedEvent>>;

  /**
   * Fired when playback or streaming has stopped because the end of the media was reached or because no further data is available.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event
   */
  onEnded?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the frame at the current playback position of the media has finished loading.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
   */
  onLoadedData?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when metadata has been loaded.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event
   */
  onLoadedMetadata?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the browser has started to load a resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadstart_event
   */
  onLoadStart?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when media is paused.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause_event
   */
  onPause?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when `paused` changes to false and media playback resumes.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event
   */
  onPlay?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired after playback is first started, and whenever it is restarted.
   * For example, it is fired when playback resumes after having been paused or delayed due to lack of data.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event
   */
  onPlaying?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired periodically as the browser loads a resource.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/progress_event
   */
  onProgress?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the playback rate has changed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ratechange_event
   */
  onRateChange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a seek operation completed, the current playback position has changed, and the Boolean `seeking` attribute is changed to `false`.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
   */
  onSeeked?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a seek operation starts, meaning the Boolean `seeking` attribute has changed to `true` and the media is seeking a new position.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking_event
   */
  onSeeking?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event
   */
  onStalled?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when media data loading has been suspended.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/suspend_event
   */
  onSuspend?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the time indicated by the `currentTime` attribute has been updated.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event
   */
  onTimeUpdate?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the volume has changed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volumechange_event
   */
  onVolumeChange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when playback has stopped because of a temporary lack of data.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event
   */
  onWaiting?: OptionalProperty<EventHandler<Event>>;

  /*=================================*\
  ||         Event Properties        ||
  \*=================================*/

  /**
   * Fired when the resource was not fully loaded, but not as the result of an error.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/abort_event
   */
  onabort?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent can play the media, but estimates that not enough data has been loaded
   * to play the media up to its end without having to stop for further buffering of content.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event
   */
  oncanplay?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent can play the media, and estimates that enough data has been loaded
   * to play the media up to its end without having to stop for further buffering of content.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplaythrough_event
   */
  oncanplaythrough?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the duration attribute has been updated.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/durationchange_event
   */
  ondurationchange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the media has become empty; for example, this event is sent if the media has already been loaded
   * (or partially loaded), and the `load()` method is called to reload it.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/emptied_event
   */
  onemptied?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the media encounters some initialization data indicating it is encrypted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/encrypted_event
   */
  onencrypted?: OptionalProperty<EventHandler<MediaEncryptedEvent>>;

  /**
   * Fired when playback or streaming has stopped because the end of the media was reached or because no further data is available.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event
   */
  onended?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the frame at the current playback position of the media has finished loading.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
   */
  onloadeddata?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when metadata has been loaded.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event
   */
  onloadedmetadata?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the browser has started to load a resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadstart_event
   */
  onloadstart?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when media is paused.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause_event
   */
  onpause?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when `paused` changes to false and media playback resumes.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event
   */
  onplay?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired after playback is first started, and whenever it is restarted.
   * For example, it is fired when playback resumes after having been paused or delayed due to lack of data.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event
   */
  onplaying?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired periodically as the browser loads a resource.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/progress_event
   */
  onprogress?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the playback rate has changed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ratechange_event
   */
  onratechange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a seek operation completed, the current playback position has changed, and the Boolean `seeking` attribute is changed to `false`.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
   */
  onseeked?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when a seek operation starts, meaning the Boolean `seeking` attribute has changed to `true` and the media is seeking a new position.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking_event
   */
  onseeking?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event
   */
  onstalled?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when media data loading has been suspended.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/suspend_event
   */
  onsuspend?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the time indicated by the `currentTime` attribute has been updated.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event
   */
  ontimeupdate?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when the volume has changed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volumechange_event
   */
  onvolumechange?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when playback has stopped because of a temporary lack of data.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event
   */
  onwaiting?: OptionalProperty<EventHandler<Event>>;
}

interface HTMLVideoElementProps extends HTMLMediaElementProps<HTMLVideoElement> {
  /**
   * The height of the video's display area in CSS pixels. This must be an absolute value; percentages are not allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The width of the video's display area in CSS pixels. This must be an absolute value; percentages are not allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * A URL for an image to show while video data is loading. If this attribute isn't specified, nothing is
   * displayed until the first frame is available, then the first frame is shown as the poster frame.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement
   */
  poster?: OptionalProperty<string | undefined>;

  /**
   * Indicates that the video is to be played _inline_, that is within the element's playback area.
   * Note that the absence of this attribute does not imply that the video will always be played in fullscreen.
   */
  playsInline?: OptionalProperty<boolean>;
}

interface HTMLSourceElementProps extends PropertiesOf<HTMLSourceElement> {
  /**
   * The [MIME type](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types) of the resource.
   */
  type?: OptionalProperty<string>;

  /**
   * URL of the media resource.
   *
   * Required if the source element's parent is an `<audio>` or `<video>` element, not allowed for `<picture>` elements.
   */
  src?: OptionalProperty<string>;

  /**
   * A list of one or more strings, separated by commas, indicating a set of possible images represented by the source for the browser to use.
   *
   * Required if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-srcset
   */
  srcset?: OptionalProperty<string>;

  /**
   * A list of source sizes that describes the final width of the image. Each source size consists of a comma-separated
   * list of media condition-length pairs. This information is used by the browser to determine, before laying the page out,
   * which image defined in `srcset` to use. Please note that `sizes` will have its effect only if width dimension
   * descriptors are provided with `srcset` instead of pixel ratio values (`200w` instead of `2x` for example).
   *
   * Allowed if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-sizes
   */
  sizes?: OptionalProperty<string>;

  /**
   * Media query of the resource's intended media.
   *
   * Allowed if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-media
   */
  media?: OptionalProperty<string>;

  /**
   * The height of the image in pixels. Must be an integer without a unit.
   *
   * Allowed if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-height
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The width of the image in pixels. Must be an integer without a unit.
   *
   * Allowed if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-width
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
}

interface HTMLImageElementProps extends PropertiesOf<HTMLImageElement> {
  /**
   * Defines an alternative text description of the image. This can be displayed visually when the image
   * cannot be loaded, but also provides a description of the content to users accessing the site with a screen reader.
   *
   * This is a required property for accessibility. If the image truly can't be described, pass an empty string.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt
   */
  alt: RequiredProperty<string>;

  /**
   * Indicates whether to use CORS to fetch the image. If not present the image is fetched without a CORS request.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
   */
  crossOrigin?: OptionalProperty<"anonymous" | "use-credentials">;

  /**
   * Tells the browser whether it should render the image synchronously (waiting for the image before displaying other content)
   * or asynchronously (displaying other content and loading image in later). Each browser has its own defaults.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
   */
  decoding?: OptionalProperty<"sync" | "async" | "auto">;

  /**
   * Provides a hint of the relative priority to use when fetching the image.
   *
   * @experimental
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-fetchpriority
   */
  // fetchpriority?: MaybeReadable<"high" | "low" | "auto" | undefined>;
  // TODO: Not supporting experimental features just yet (Firefox and Safari do not support)

  /**
   * The height of the image in CSS pixels. Must be an integer without a unit.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/height
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The width of the image in CSS pixels. Must be an integer without a unit.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/width
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * Indicates that the image is part of a [server-side map](https://en.wikipedia.org/wiki/Image_map#Server-side).
   * If so, the coordinates where the user clicked on the image are sent to the server.
   *
   * This property is only valid if this image is inside an `<a>` tag.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/isMap
   */
  isMap?: OptionalProperty<boolean>;

  /**
   * Indicates how the browser should load the image when it is located outside the viewport.
   *
   * - `eager` will load the image as soon as the `<img>` tag is processed.
   * - `lazy` will attempt to wait until just before the user scrolls the image into view.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading
   */
  loading?: OptionalProperty<"eager" | "lazy">;

  /**
   * A string indicating which referrer to use when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy
   */
  referrerPolicy?: OptionalProperty<
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
  >;

  /**
   * One or more strings separated by commas, indicating a set of source sizes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/sizes
   */
  sizes?: MaybeSignal<string>;

  /**
   * The image URL.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/src
   */
  src: RequiredProperty<string>;

  /**
   * Identifies one or more image candidate strings separated by commas. Note that the `sizes` property
   * must also be present or `srcset` will be ignored.
   *
   * @example "header640.png 640w, header960.png 960w, header1024.png 1024w"
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
   */
  srcset?: OptionalProperty<string>;

  /**
   * The partial URL (starting with #) of an [image map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/map)
   * associated with the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/useMap
   */
  useMap?: OptionalProperty<string>;
}

interface HTMLIFrameElementProps extends PropertiesOf<HTMLIFrameElement> {
  /**
   * Specifies a [feature policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Feature_Policy) for the `<iframe>`.
   * The policy defines what features are available to the `<iframe>` based on the origin of the request
   * (e.g. access to the microphone, camera, battery, web-share API, etc.).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Feature_Policy/Using_Feature_Policy#the_iframe_allow_attribute
   */
  allow?: OptionalProperty<string>;

  allowFullscreen?: OptionalProperty<boolean>;

  /**
   * The height of the frame in CSS pixels.
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The width of the frame in CSS pixels.
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * Indicates how the browser should load the iframe.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-loading
   */
  loading?: OptionalProperty<"eager" | "lazy">;

  /**
   * A targetable name for the embedded browsing context. This can be used in the `target` attribute of the
   * `<a>`, `<form>`, or `<base>` elements; the `formtarget` attribute of the `<input>` or `<button>` elements;
   * or the `windowName` parameter in the [`window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * Applies extra restrictions to the content in the frame. The value of the attribute can either be empty to apply
   * all restrictions, or [space-separated tokens to lift particular restrictions](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox).
   */
  sandbox?: OptionalProperty<string>;

  /**
   * A string indicating which referrer to send when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/referrerPolicy
   */
  referrerPolicy?: OptionalProperty<
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
  >;

  /**
   * The URL of the page to embed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/src
   */
  src?: OptionalProperty<string>;

  /**
   * Inline HTML to embed, overriding the `src` attribute. If a browser does not support the `srcdoc` attribute,
   * it will fall back to the URL in the `src` attribute.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc
   */
  srcdoc?: OptionalProperty<string>;
}

interface HTMLEmbedElementProps extends PropertiesOf<HTMLEmbedElement> {
  /**
   * The displayed height of the resource in CSS pixels.
   */
  height?: OptionalProperty<string>;

  /**
   * The displayed width of the resource in CSS pixels.
   */
  width?: OptionalProperty<string>;

  /**
   * The URL of the resource being embedded.
   */
  src?: OptionalProperty<string>;

  /**
   * The [MIME type](https://developer.mozilla.org/en-US/docs/Glossary/MIME_type) to use to select the plug-in to instantiate.
   */
  type?: OptionalProperty<string>;
}

interface HTMLObjectElementProps extends PropertiesOf<HTMLObjectElement> {
  /**
   * The displayed height of the resource, in CSS pixels. This must be an absolute value; percentages are not allowed.
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The displayed width of the resource, in CSS pixels. This must be an absolute value; percentages are not allowed.
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The address of the resource as a valid URL. At least one of `data` and `type` must be defined.
   */
  data?: OptionalProperty<string>;

  /**
   * The [MIME type](https://developer.mozilla.org/en-US/docs/Glossary/MIME_type) of the resource specified by data.
   * At least one of `data` and `type` must be defined.
   */
  type?: OptionalProperty<string>;

  /**
   * The form element, if any, that the object element is associated with (its form owner).
   * The value of the attribute must be an ID of a `<form>` element in the same document.
   */
  form?: OptionalProperty<string>;

  /**
   * The name of valid browsing context (HTML5), or the name of the control (HTML 4).
   */
  name?: OptionalProperty<string>;

  /**
   * A hash-name reference to a `<map>` element; that is a '#' followed by the value of a name of a map element.
   */
  useMap?: OptionalProperty<string>;
}

interface HTMLTrackElementProps extends PropertiesOf<HTMLTrackElement> {
  /**
   * Indicates that the track should be enabled unless the user's preferences indicate that another track
   * is more appropriate. This may only be used on one track element per media element.
   */
  default?: OptionalProperty<boolean>;

  /**
   * How the text track is meant to be used. If omitted the default kind is `subtitles`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track#attr-kind
   */
  kind?: OptionalProperty<"subtitles" | "captions" | "descriptions" | "chapters" | "metadata">;

  /**
   * A user-Readable title of the text track which is used by the browser when listing available text tracks.
   */
  label?: OptionalProperty<string>;

  /**
   * Address of the track (`.vtt` file). Must be a valid URL. This attribute must be specified and its URL value
   * must have the same origin as the document — unless the `<audio>` or `<video>` parent element of the track
   * element has a `crossorigin` attribute.
   */
  src: RequiredProperty<string>;

  /**
   * Language of the track text data. It must be a valid [BCP 47 language tag](https://r12a.github.io/app-subtags/).
   * If the `kind` attribute is set to `subtitles`, then `srclang` must be defined.
   */
  srclang?: OptionalProperty<string>;
}

interface HTMLMapElementProps extends PropertiesOf<HTMLMapElement> {
  /**
   * Gives the map a name so that it can be referenced. The attribute must be present and must have a non-empty value
   * with no space characters. The value of the name attribute must not be equal to the value of the name attribute
   * of another `<map>` element in the same document. If the `id` attribute is also specified, both attributes must
   * have the same value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/map#attr-name
   */
  name: RequiredProperty<string>;
}

interface HTMLAreaElementProps extends PropertiesOf<HTMLAreaElement> {
  /**
   * A text string alternative to display on browsers that do not display images. The text should be phrased
   * so that it presents the user with the same kind of choice as the image would offer when displayed without
   * the alternative text. This attribute is required only if the `href` attribute is used.
   */
  alt?: OptionalProperty<string>;

  /**
   * The shape of the associated hot spot.
   */
  shape?: OptionalProperty<"rect" | "circle" | "poly" | "default">;

  /**
   * Details the coordinates of the `shape` attribute in size, shape, and placement of an `<area>`.
   * This attribute must not be used if `shape` is set to `default`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area#attr-coords
   */
  coords?: OptionalProperty<string>;

  /**
   * If present, indicates that the author intends the hyperlink to be used for downloading a resource.
   * See `<a>` for [a full description of the `download` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download).
   */
  download?: OptionalProperty<string>;

  /**
   * The hyperlink target for the area. Its value is a valid URL. This attribute may be omitted; if so,
   * the `<area>` element does not represent a hyperlink.
   */
  href?: OptionalProperty<string>;

  /**
   * Contains a space-separated list of URLs to which, when the hyperlink is followed, `POST` requests with the body
   * `PING` will be sent by the browser (in the background). Typically used for tracking.
   */
  ping?: OptionalProperty<string>;

  /**
   * A string indicating which referrer to use when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area#attr-referrerpolicy
   */
  referrerPolicy?: OptionalProperty<
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
  >;

  /**
   * For anchors containing the `href` attribute, this attribute specifies the relationship of the target object
   * to the link object. The value is a space-separated list of [link types values](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types).
   * The values and their semantics will be registered by some authority that might have meaning to the document author.
   * The default relationship, if no other is given, is void. Use this attribute only if the `href` attribute is present.
   */
  rel?: OptionalProperty<string>;

  /**
   * Where to display the linked URL, as the name for a browsing context (a tab, window, or `<iframe>`)
   *
   * A common usage is `target: "_blank"` to cause a link to open in a new tab.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area#attr-target
   */
  target?: OptionalProperty<"_self" | "_blank" | "parent" | "_top">;
}

/*====================================*\
|| 4.9                   Tabular Data ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The _Table_ element.
   *
   * Represents tabular data — that is, information presented in a two-dimensional table comprised of rows and columns
   * of cells containing data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table
   */
  table: PropertiesOf<HTMLTableElement>;

  /**
   * The _Table Caption_ element.
   *
   * Specifies the caption (or title) of a table.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/caption
   */
  caption: PropertiesOf<HTMLTableCaptionElement>;

  /**
   * The _Table Column Group_ element.
   *
   * Defines a group of columns within a table.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/colgroup
   */
  colgroup: HTMLTableColgroupElementProps;

  /**
   * The _Table Column_ element.
   *
   * Defines a column within a table and is used for defining common semantics on all common cells.
   * It is generally found within a `<colgroup>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/col
   */
  col: HTMLTableColElementProps;

  /**
   * The _Table Body_ element.
   *
   * Encapsulates a set of table rows (`<tr>` elements), indicating that they comprise the body of the table (`<table>`).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/tbody
   */
  tbody: PropertiesOf<HTMLTableSectionElement>;

  /**
   * The _Table Head_ element.
   *
   * Defines a set of rows defining the head of the columns of the table.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/thead
   */
  thead: PropertiesOf<HTMLTableSectionElement>;

  /**
   * The _Table Foot_ element.
   *
   * Defines a set of rows summarizing the columns of the table.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/tfoot
   */
  tfoot: PropertiesOf<HTMLTableSectionElement>;

  /**
   * The _Table Row_ element.
   *
   * Defines a row of cells in a table. The row's cells can then be established using a mix of `<td>` (data cell)
   * and `<th>` (header cell) elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/tr
   */
  tr: PropertiesOf<HTMLTableRowElement>;

  /**
   * The _Table Data Cell_ element.
   *
   * Defines a cell of a table that contains data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/td
   */
  td: HTMLTableCellElementProps;

  /**
   * The _Table Header_ element.
   *
   * Defines a cell as header of a group of table cells. The exact nature of this group is defined by the
   * `scope` and `headers` attributes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/th
   */
  th: HTMLTableHeaderElementProps;
}

interface HTMLTableColgroupElementProps extends PropertiesOf<HTMLTableColElement> {
  /**
   * A positive integer indicating the number of consecutive columns the `<colgroup>` element spans.
   * If not present, its default value is `1`.
   *
   * The `span` attribute is not permitted if there are one or more `<col>` elements within the `<colgroup>`.
   */
  span?: OptionalProperty<number>;
}

interface HTMLTableColElementProps extends PropertiesOf<HTMLTableColElement> {
  /**
   * A positive integer indicating the number of consecutive columns the `<col>` element spans.
   * If not present, its default value is `1`.
   */
  span?: OptionalProperty<number>;
}

interface HTMLTableCellElementProps extends PropertiesOf<HTMLTableCellElement> {
  /**
   * A positive integer value that indicates for how many columns the cell extends. Its default value is `1`.
   * Values higher than 1000 will be considered as incorrect and will be set to the default value.
   */
  colSpan?: OptionalProperty<number>;

  /**
   * A non-negative integer value that indicates for how many rows the cell extends. Its default value is `1`;
   * if its value is set to `0`, it extends until the end of the table section (`<thead>`, `<tbody>`, `<tfoot>`,
   * even if implicitly defined), that the cell belongs to.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/td#attr-rowspan
   */
  rowSpan?: OptionalProperty<number>;

  /**
   * A list of space-separated strings, each corresponding to the `id` attribute of the `<th>` elements that apply to this element.
   */
  headers?: OptionalProperty<string>;
}

interface HTMLTableHeaderElementProps extends HTMLTableCellElementProps {
  /**
   * A short abbreviated description of the cell's content. Some user-agents, such as speech readers, may present this description before the content itself.
   */
  abbr?: OptionalProperty<string>;

  /**
   * Defines the cells that the `<th>` element relates to.
   *
   * - `row`: The header relates to all cells of the row it belongs to.
   * - `col`: The header relates to all cells of the column it belongs to.
   * - `rowgroup`: The header belongs to a rowgroup and relates to all of its cells. These cells can be placed to the
   *    right or the left of the header, depending on the value of the `dir` attribute in the `<table>` element.
   * - `colgroup`: The header belongs to a colgroup and relates to all of its cells.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/th#attr-scope
   */
  scope?: OptionalProperty<"row" | "col" | "rowgroup" | "colgroup">;
}

/*====================================*\
|| 4.10                         Forms ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * Contains a group of interactive elements for taking input from a user.
   * This can be anything from a chat box with a submit button to a full page tax form.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
   */
  form: FormElementProps;

  /**
   * Provides a text label that describes another element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label
   */
  label: HTMLLabelElementProps;

  input: HTMLInputElementProps;

  button: ButtonElementProps;

  select: HTMLSelectElementProps;

  datalist: PropertiesOf<HTMLDataListElement>;

  optgroup: HTMLOptGroupElementProps;

  option: HTMLOptionElementProps;

  textarea: HTMLTextAreaElementProps;

  output: HTMLOutputElementProps;

  /**
   * Displays a finite progress indicator.
   */
  progress: HTMLProgressElementProps;

  /**
   * Displays a value within a finite range. Think gas gauge or progress bar.
   * Consider the simpler [`<progress>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress) element for progress bars.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meter
   */
  meter: HTMLMeterElementProps;

  /**
   * Contains and names a group of related form controls.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/fieldset
   */
  fieldset: HTMLFieldSetElementProps;

  /**
   * Provides a caption for a parent `<fieldset>`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/legend
   */
  legend: PropertiesOf<HTMLLegendElement>;
}

type AutocompleteValues = boolean | "off" | "on";

interface FormElementProps extends PropertiesOf<HTMLFormElement> {
  /**
   * Indicates whether input elements can by default have their values automatically completed by the browser.
   * `autocomplete` attributes on form elements override it on `<form>`.
   *
   * @see \https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-autocomplete
   */
  autocomplete?: OptionalProperty<AutocompleteValues>;

  /**
   * The `name` of the form. The value must not be the empty string, and must be unique among the form elements
   * in the forms collection that it is in, if any.
   */
  name?: OptionalProperty<string>;

  rel?: OptionalProperty<string>;

  /**
   * The URL that handles the form submission.
   */
  action?: OptionalProperty<string>;

  /**
   * The [MIME type](https://en.wikipedia.org/wiki/Media_type) of the form data, when the form has a `method` of `post`.
   * Alias to `encoding`.
   */
  enctype?: OptionalProperty<"application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain" | string>;

  /**
   * The [MIME type](https://en.wikipedia.org/wiki/Media_type) of the form data, when the form has a `method` of `post`.
   * Alias to `enctype`.
   */
  encoding?: OptionalProperty<"application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain" | string>;

  /**
   * The HTTP method to use when submitting the form. A value of `"dialog"` is valid when the form is inside a `<dialog`>
   * element, where it will close the dialog and fire a `submit` event without sending data or clearing the form.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-method
   */
  method?: OptionalProperty<"post" | "POST" | "get" | "GET" | "dialog" | string>;

  /**
   * If true, prevents the form from being validated when submitted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-novalidate
   */
  noValidate?: OptionalProperty<boolean>;

  /**
   * Name of the browsing context to display the response to the form's submission.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-target
   */
  target?: OptionalProperty<"_self" | "_blank" | "_parent" | "_top" | string>;

  /*====================================*\
  || Events                             ||
  \*====================================*/

  /**
   * Fires after the entry list representing the form's data is constructed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/formdata_event
   */
  onFormData?: OptionalProperty<EventHandler<FormDataEvent>>;

  /**
   * Fires when a `<form>` is reset.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event
   */
  onReset?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fires when a `<form>` is submitted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event
   */
  onSubmit?: OptionalProperty<EventHandler<SubmitEvent>>;

  /*====================================*\
  || Event Properties                   ||
  \*====================================*/

  /**
   * Fires after the entry list representing the form's data is constructed.
   *
   * This event is not cancelable and does not bubble.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/formdata_event
   */
  onformdata?: OptionalProperty<EventHandler<FormDataEvent>>;

  /**
   * Fires when a `<form>` is reset.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event
   */
  onreset?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fires when a `<form>` is submitted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event
   */
  onsubmit?: OptionalProperty<EventHandler<SubmitEvent>>;
}

interface HTMLLabelElementProps extends PropertiesOf<HTMLLabelElement> {
  /**
   * An `id` for the element the label labels.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label#attr-for
   */
  htmlFor?: OptionalProperty<string>;

  /**
   * An `id` for the element the label labels. Alias to `htmlFor` property.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label#attr-for
   */
  for?: OptionalProperty<string>;
}

export type InputType =
  | "hidden"
  | "text"
  | "search"
  | "tel"
  | "url"
  | "email"
  | "password"
  | "date"
  | "month"
  | "week"
  | "time"
  | "datetime-local"
  | "number"
  | "range"
  | "color"
  | "checkbox"
  | "radio"
  | "file"
  | "submit"
  | "image"
  | "reset"
  | "button";

// TODO: Add complete doc comments
interface HTMLInputElementProps extends PropertiesOf<HTMLInputElement> {
  accept?: OptionalProperty<string>;
  alt?: OptionalProperty<string>;
  autocomplete?: OptionalProperty<AutocompleteValues>;
  checked?: OptionalProperty<boolean>;
  dirName?: OptionalProperty<string>;
  disabled?: OptionalProperty<boolean>;
  form?: OptionalProperty<string>;
  formAction?: OptionalProperty<string>;
  formEnctype?: OptionalProperty<string>;
  formMethod?: OptionalProperty<string>;
  formNoValidate?: OptionalProperty<boolean>;
  formTarget?: OptionalProperty<string>;
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
  list?: OptionalProperty<string>;
  max?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
  maxLength?: OptionalProperty<number>;
  min?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
  minLength?: OptionalProperty<number>;
  multiple?: OptionalProperty<boolean>;
  name?: OptionalProperty<string>;
  pattern?: OptionalProperty<string | RegExp> | OptionalProperty<string> | OptionalProperty<RegExp>;
  placeholder?: OptionalProperty<string>;
  popoverTarget?: OptionalProperty<string>;
  popoverTargetAction?: OptionalProperty<"toggle" | "show" | "hide">;
  readOnly?: OptionalProperty<boolean>;
  required?: OptionalProperty<boolean>;
  size?: OptionalProperty<number | string>;
  src?: OptionalProperty<string>;
  step?: OptionalProperty<number>;
  type?: OptionalProperty<InputType>;
  value?: OptionalProperty<string>;
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
  title?: OptionalProperty<string>;

  /*====================================*\
  || Events                             ||
  \*====================================*/

  /**
   * Fired when a submittable element has been checked for validity and doesn't satisfy its constraints.
   * When a form is submitted, `invalid` events are fired at each form control that is invalid.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/invalid_event
   */
  onInvalid?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when text has been selected.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select_event
   */
  onSelect?: OptionalProperty<EventHandler<Event>>;

  /*====================================*\
  || Event Properties                   ||
  \*====================================*/

  /**
   * Fired when a submittable element has been checked for validity and doesn't satisfy its constraints.
   * When a form is submitted, `invalid` events are fired at each form control that is invalid.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/invalid_event
   */
  oninvalid?: OptionalProperty<EventHandler<Event>>;

  /**
   * Fired when text has been selected.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select_event
   */
  onselect?: OptionalProperty<EventHandler<Event>>;
}

export type ButtonTypeValues = "submit" | "reset" | "button";

interface ButtonElementProps extends PropertiesOf<HTMLButtonElement> {
  disabled?: OptionalProperty<boolean>;
  form?: OptionalProperty<string>;
  formAction?: OptionalProperty<string>;
  formEnctype?: OptionalProperty<string>;
  formMethod?: OptionalProperty<string>;
  formNoValidate?: OptionalProperty<boolean>;
  formTarget?: OptionalProperty<string>;
  name?: OptionalProperty<string>;
  popoverTarget?: OptionalProperty<string>;
  popoverTargetAction?: OptionalProperty<"toggle" | "show" | "hide">;
  type?: OptionalProperty<ButtonTypeValues>;
  value?: OptionalProperty<string>;
}

// TODO: Add complete doc comments
interface HTMLSelectElementProps extends PropertiesOf<HTMLSelectElement> {
  autocomplete?: OptionalProperty<AutocompleteValues>;
  disabled?: OptionalProperty<boolean>;
  form?: OptionalProperty<string>;
  multiple?: OptionalProperty<boolean>;
  name?: OptionalProperty<string>;
  required?: OptionalProperty<boolean>;
  size?: OptionalProperty<number | string>;
  value?: OptionalProperty<string>;
}

// TODO: Add complete doc comments
interface HTMLOptGroupElementProps extends PropertiesOf<HTMLOptGroupElement> {
  disabled?: OptionalProperty<boolean>;
  label?: OptionalProperty<string>;
}

// TODO: Add complete doc comments
interface HTMLOptionElementProps extends PropertiesOf<HTMLOptionElement> {
  disabled?: OptionalProperty<boolean>;
  label?: OptionalProperty<string>;
  selected?: OptionalProperty<boolean>;
  value?: OptionalProperty<string>;
}

// TODO: Add complete doc comments
interface HTMLTextAreaElementProps extends PropertiesOf<HTMLTextAreaElement> {
  autocomplete?: OptionalProperty<AutocompleteValues>;
  cols?: OptionalProperty<number>;
  dirname?: OptionalProperty<string>;
  disabled?: OptionalProperty<boolean>;
  form?: OptionalProperty<string>;
  maxLength?: OptionalProperty<number>;
  minLength?: OptionalProperty<number>;
  name?: OptionalProperty<string>;
  placeholder?: OptionalProperty<string>;
  readOnly?: OptionalProperty<boolean>;
  required?: OptionalProperty<boolean>;
  rows?: OptionalProperty<number>;
  wrap?: OptionalProperty<"soft" | "hard">;
  value?: OptionalProperty<string>;
}

// TODO: Add complete doc comments
interface HTMLOutputElementProps extends PropertiesOf<HTMLOutputElement> {
  for?: OptionalProperty<string>;
  form?: OptionalProperty<string>;
  name?: OptionalProperty<string>;
}

interface HTMLProgressElementProps extends PropertiesOf<HTMLProgressElement> {
  value?: OptionalProperty<number>;
  max?: OptionalProperty<number>;
}

interface HTMLMeterElementProps extends PropertiesOf<HTMLMeterElement> {
  /**
   * The current value displayed by this meter. Must be between `min` and `max`, which default to 0 and 1 respectively.
   */
  value?: OptionalProperty<number>;

  /**
   * The minimum value this meter can display. Defaults to 0.
   */
  min?: OptionalProperty<number>;

  /**
   * The maximum value this meter can display. Defaults to 1.
   */
  max?: OptionalProperty<number>;

  /**
   * If `value` is between `min` and `low` it is considered "low". You would charge your phone
   * if your battery meter was in this range. The browser may display values in this range in red.
   */
  low?: OptionalProperty<number>;

  /**
   * If `value` is between `high` and `max` it is considered "high". You just took your phone off the charger
   * if your battery meter is in this range. The browser may display values in this range in green.
   */
  high?: OptionalProperty<number>;

  /**
   * The ideal `value`.
   */
  optimum?: OptionalProperty<number>;
}

interface HTMLFieldSetElementProps extends PropertiesOf<HTMLFieldSetElement> {
  /**
   * If true, all form controls inside this fieldset are disabled.
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The name of this group of inputs.
   */
  name?: OptionalProperty<string>;
}

/*====================================*\
|| 4.11          Interactive elements ||
\*====================================*/

// details
// summary
// dialog

export interface IntrinsicElements {
  /**
   * The _Details disclosure_ element.
   *
   * Creates a disclosure widget in which information is visible only when the widget is toggled into an "open" state.
   * A summary or label must be provided using the `<summary>` element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
   */
  details: HTMLDetailsElementProps;

  /**
   * The _Disclosure Summary_ element.
   *
   * Specifies a summary, caption, or legend for a `<details>` element's disclosure box.
   * Clicking the `<summary>` element toggles the state of the parent `<details>` element open and closed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/summary
   */
  summary: PropertiesOf<HTMLElement>;

  /**
   * The _Dialog_ element.
   *
   * Represents a dialog box or other interactive component, such as a dismissible alert, inspector, or subwindow.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
   */
  dialog: HTMLDialogElementProps;
}

interface HTMLDetailsElementProps extends PropertiesOf<HTMLDetailsElement> {
  /**
   * Indicates whether the contents of the <details> element are currently visible.
   * The details are shown when this attribute is true, hidden when false.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
   */
  open?: OptionalProperty<boolean>;

  /**
   * The `toggle` event is fired when the `open`/`closed` state of a `<details>` element is toggled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/toggle_event
   */
  ontoggle?: OptionalProperty<EventHandler<Event>>;

  /**
   * The `toggle` event is fired when the `open`/`closed` state of a `<details>` element is toggled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/toggle_event
   */
  onToggle?: OptionalProperty<EventHandler<Event>>;
}

interface HTMLDialogElementProps extends PropertiesOf<HTMLDialogElement> {
  /**
   * Indicates that the dialog is active and can be interacted with. When the `open` attribute is not set, the dialog
   * shouldn't be shown to the user. It is recommended to use the `.show()` or `.showModal()` methods to render dialogs,
   * rather than the `open` attribute.
   */
  open?: OptionalProperty<boolean>;
}

/*====================================*\
|| 4.12                     Scripting ||
\*====================================*/

// UNSUPPORTED script
// UNSUPPORTED noscript
// UNSUPPORTED template
// UNSUPPORTED slot

export interface IntrinsicElements {
  /**
   * The _Graphics Canvas_ element.
   *
   * Use it with either the [canvas scripting API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
   * or the [WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) to draw graphics and animations.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas
   */
  canvas: HTMLCanvasElementProps;
}

interface HTMLCanvasElementProps extends PropertiesOf<HTMLCanvasElement> {
  /**
   * The width of the coordinate space in CSS pixels. Defaults to 300.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#attributes
   */
  width?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;

  /**
   * The height of the coordinate space in CSS pixels. Defaults to 150.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#attributes
   */
  height?: OptionalProperty<string | number> | OptionalProperty<string> | OptionalProperty<number>;
}
