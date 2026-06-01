import type * as CSS from "csstype";
import type { Context, GenericState } from "./core/context.js";
import type { Markup, MarkupNode } from "./core/markup/types.js";
import type { Getter } from "./core/signals.js";
import { CSSTemplate } from "./core/markup/css.js";

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
  | void
  | Getter<any>
  | Renderable[];

export interface BaseProps {
  children?: Renderable;
}

export type View<Props = {}, State = GenericState> = (
  this: Context<State>,
  props: Props,
  context: Context<State>,
) => Renderable;

export type Store<Props, Value, State = Record<string | symbol, any>> = (
  this: Context<State>,
  props: Props,
  context: Context<State>,
) => Value;

export type MaybeGetter<T> = Getter<T> | T;

/*==================================*\
||            JSX Types             ||
\*==================================*/

type RequiredProperty<T> = Getter<T> | T;
type OptionalProperty<T> = Getter<T> | Getter<T | undefined> | T;

type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

type SizeProperty = OptionalProperty<string | number>;

type AutocapitalizeValues = "off" | "on" | "none" | "sentences" | "words" | "characters";
type ContentEditableValues = true | false | "true" | "false" | "plaintext-only" | "inherit";
type ClassListValues = string | ClassMap | CSSTemplate | Array<string | ClassMap | CSSTemplate | (string | ClassMap | CSSTemplate)[]>;
type DirValues = "ltr" | "rtl" | "auto";
type EnterKeyHintValues = "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
type HiddenValues = true | false | "until-found";
type InputModeValues = "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";

type EventHandlerObject<E extends Event> = {
  handleEvent: EventHandler<E>;
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
};

type TargetEvent<T extends Event, E extends EventTarget> = T & { readonly currentTarget: E };

type OnEventProps<E extends EventTarget, M> = {
  [K in keyof M & string]?:
    | EventHandler<TargetEvent<M[K] & Event, E>>
    | EventHandlerObject<TargetEvent<M[K] & Event, E>>;
} & {
  [K in keyof M & string as K extends `on${infer Rest}` ? `on:${Lowercase<Rest>}` : never]?:
    | EventHandler<TargetEvent<M[K] & Event, E>>
    | EventHandlerObject<TargetEvent<M[K] & Event, E>>;
} & {
  [K in keyof M & string as K extends `on${infer Rest}` ? `@${Lowercase<Rest>}` : never]?:
    | EventHandler<TargetEvent<M[K] & Event, E>>
    | EventHandlerObject<TargetEvent<M[K] & Event, E>>;
};

/*====================================*\
||          Event Maps               ||
\*====================================*/

interface ElementEventMap {
  /** Fired when a CSS animation is unexpectedly aborted. */
  onAnimationCancel: AnimationEvent;
  /** Fired when a CSS animation reaches the end of its active period. */
  onAnimationEnd: AnimationEvent;
  /** Fired when one iteration of a CSS animation ends and another begins. */
  onAnimationIteration: AnimationEvent;
  /** Fired when a CSS animation starts. */
  onAnimationStart: AnimationEvent;
  /** Fired when a non-primary pointing device button is pressed on an element. */
  onAuxClick: MouseEvent;
  /** Fired when an element has lost focus. */
  onBlur: FocusEvent;
  /** Fired when a pointing device button is pressed and released on an element. */
  onClick: MouseEvent;
  /** Fired when a text composition system completes composition. */
  onCompositionEnd: CompositionEvent;
  /** Fired when a text composition system starts composition. */
  onCompositionStart: CompositionEvent;
  /** Fired when a character is added to a composition session. */
  onCompositionUpdate: CompositionEvent;
  /** Fired when the right button of the mouse is clicked on an element. */
  onContextMenu: PointerEvent;
  /** Fired when a pointing device button is clicked twice on an element. */
  onDblClick: MouseEvent;
  /** Fired when an element has received focus. */
  onFocus: FocusEvent;
  /** Fired when an element is about to receive focus. */
  onFocusIn: FocusEvent;
  /** Fired when an element is about to lose focus. */
  onFocusOut: FocusEvent;
  /** Fired when an element transitions to or from fullscreen mode. */
  onFullscreenChange: Event;
  /** Fired when an element cannot be switched to fullscreen mode. */
  onFullscreenError: Event;
  /** Fired when a key is pressed. */
  onKeyDown: KeyboardEvent;
  /** Fired when a key is released. */
  onKeyUp: KeyboardEvent;
  /** Fired when a pointing device button is pressed on an element. */
  onMouseDown: MouseEvent;
  /** Fired when a pointing device is moved onto an element. */
  onMouseEnter: MouseEvent;
  /** Fired when a pointing device is moved off of an element. */
  onMouseLeave: MouseEvent;
  /** Fired when a pointing device is moved over an element. */
  onMouseMove: MouseEvent;
  /** Fired when a pointing device is moved off of an element or one of its children. */
  onMouseOut: MouseEvent;
  /** Fired when a pointing device is moved onto an element or one of its children. */
  onMouseOver: MouseEvent;
  /** Fired when a pointing device button is released on an element. */
  onMouseUp: MouseEvent;
  /** Fired when a pointer event is cancelled. */
  onPointerCancel: PointerEvent;
  /** Fired when a pointer becomes active. */
  onPointerDown: PointerEvent;
  /** Fired when a pointer is moved onto an element. */
  onPointerEnter: PointerEvent;
  /** Fired when a pointer is moved out of an element. */
  onPointerLeave: PointerEvent;
  /** Fired when a pointer changes coordinates. */
  onPointerMove: PointerEvent;
  /** Fired when a pointer is moved out of the hit-testing boundaries of an element. */
  onPointerOut: PointerEvent;
  /** Fired when a pointer is moved onto the hit-testing boundaries of an element. */
  onPointerOver: PointerEvent;
  /** Fired when a pointer button is released. */
  onPointerUp: PointerEvent;
  /** Fired when the document view or an element has been scrolled. */
  onScroll: Event;
  /** Fired when the document view or an element has completed scrolling. */
  onScrollEnd: Event;
  /** Fired when a touch point has been disrupted. */
  onTouchCancel: TouchEvent;
  /** Fired when a touch point is removed from the touch surface. */
  onTouchEnd: TouchEvent;
  /** Fired when a touch point is moved along the touch surface. */
  onTouchMove: TouchEvent;
  /** Fired when a touch point is placed on the touch surface. */
  onTouchStart: TouchEvent;
  /** Fired when a CSS transition is cancelled. */
  onTransitionCancel: TransitionEvent;
  /** Fired when a CSS transition has completed. */
  onTransitionEnd: TransitionEvent;
  /** Fired when a CSS transition is first created (before any delay begins). */
  onTransitionRun: TransitionEvent;
  /** Fired when a CSS transition has actually started (after any delay has ended). */
  onTransitionStart: TransitionEvent;
  /** Fired when the user rotates a wheel button on a pointing device. */
  onWheel: WheelEvent;
}

interface HTMLElementEventMap {
  /** Fired when the value of an input element is about to be modified. */
  onBeforeInput: InputEvent;
  /** Fired when the value of an input element has been modified. */
  onChange: Event;
  /** Fired when the user copies content to the clipboard. */
  onCopy: ClipboardEvent;
  /** Fired when the user cuts content to the clipboard. */
  onCut: ClipboardEvent;
  /** Fired when an element or text selection is being dragged. */
  onDrag: DragEvent;
  /** Fired when a drag operation ends. */
  onDragEnd: DragEvent;
  /** Fired when a dragged element or selection enters a valid drop target. */
  onDragEnter: DragEvent;
  /** Fired when a dragged element or selection leaves a valid drop target. */
  onDragLeave: DragEvent;
  /** Fired when an element or text selection is being dragged over a valid drop target. */
  onDragOver: DragEvent;
  /** Fired when the user starts dragging an element or text selection. */
  onDragStart: DragEvent;
  /** Fired when an element or text selection is dropped on a valid drop target. */
  onDrop: DragEvent;
  /** Fired when a resource failed to load, or couldn't be used. */
  onError: UIEvent | Event;
  /** Fired when the value of an input element changes. */
  onInput: InputEvent;
  /** Fired when a submittable element has been checked for validity. */
  onInvalid: Event;
  /** Fired when a resource has finished loading. */
  onLoad: Event;
  /** Fired when the user pastes content from the clipboard. */
  onPaste: ClipboardEvent;
  /** Fired when text has been selected in an input element. */
  onSelect: Event;
  /** Fired when a details element is toggled open or closed. */
  onToggle: Event;
}

interface DialogSpecificEventMap {
  /** Fired when the user cancels the dialog (e.g. presses Escape). */
  onCancel: Event;
  /** Fired when the dialog is closed. */
  onClose: Event;
}

interface FormSpecificEventMap {
  /** Fired after the entry list representing the form's data is constructed. */
  onFormData: FormDataEvent;
  /** Fired when a form is reset. */
  onReset: Event;
  /** Fired when a form is submitted. */
  onSubmit: SubmitEvent;
}

interface MediaSpecificEventMap {
  /** Fired when a resource has been fully loaded but cannot be used. */
  onAbort: Event;
  /** Fired when the user agent can play media (estimates not enough data loaded). */
  onCanPlay: Event;
  /** Fired when the user agent can play through to end without stopping. */
  onCanPlayThrough: Event;
  /** Fired when the duration attribute has been updated. */
  onDurationChange: Event;
  /** Fired when the media has become empty. */
  onEmptied: Event;
  /** Fired when the media encounters initialization data indicating it is encrypted. */
  onEncrypted: MediaEncryptedEvent;
  /** Fired when playback or streaming has stopped because the end was reached. */
  onEnded: Event;
  /** Fired when the frame at the current playback position has finished loading. */
  onLoadedData: Event;
  /** Fired when metadata has been loaded. */
  onLoadedMetadata: Event;
  /** Fired when the browser has started to load a resource. */
  onLoadStart: Event;
  /** Fired when media playback is paused. */
  onPause: Event;
  /** Fired when media playback resumes. */
  onPlay: Event;
  /** Fired after playback is first started or restarted. */
  onPlaying: Event;
  /** Fired periodically as the browser loads a resource. */
  onProgress: Event;
  /** Fired when the playback rate has changed. */
  onRateChange: Event;
  /** Fired when a seek operation completed and the seeking attribute changes to false. */
  onSeeked: Event;
  /** Fired when a seek operation starts. */
  onSeeking: Event;
  /** Fired when media data is unexpectedly not forthcoming. */
  onStalled: Event;
  /** Fired when media data loading has been suspended. */
  onSuspend: Event;
  /** Fired when the time indicated by currentTime has been updated. */
  onTimeUpdate: Event;
  /** Fired when the volume has changed. */
  onVolumeChange: Event;
  /** Fired when playback has stopped due to temporary lack of data. */
  onWaiting: Event;
}

interface VideoSpecificEventMap {
  /** Fired when the video enters picture-in-picture mode. */
  onEnterPictureInPicture: PictureInPictureEvent;
  /** Fired when the video leaves picture-in-picture mode. */
  onLeavePictureInPicture: PictureInPictureEvent;
  /** Fired when the intrinsic size of the video changes. */
  onResize: Event;
}

interface CustomEventMap {
  onClickOutside: MouseEvent;
}

type EventsFor<E extends EventTarget> = OnEventProps<E, ElementEventMap> &
  (E extends HTMLElement ? OnEventProps<E, HTMLElementEventMap> : {}) &
  (E extends HTMLFormElement ? OnEventProps<E, FormSpecificEventMap> : {}) &
  (E extends HTMLMediaElement ? OnEventProps<E, MediaSpecificEventMap> : {}) &
  (E extends HTMLVideoElement ? OnEventProps<E, VideoSpecificEventMap> : {}) &
  (E extends HTMLDialogElement ? OnEventProps<E, DialogSpecificEventMap> : {}) &
  (E extends HTMLElement ? OnEventProps<E, CustomEventMap> : {});

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
  [key: `on:${string}`]: any;

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
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover
   */
  popover?: OptionalProperty<"auto" | "hint" | "manual" | true | false>;

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
    | MaybeGetter<string>
    | MaybeGetter<string | undefined>
    | MaybeGetter<CSSProperties>
    | MaybeGetter<CSSProperties | undefined>
    | CSSTemplate
    | (string | CSSProperties | CSSTemplate)[];
}

export interface HTMLElementProps extends ElementProps {
  /**
   * Data attribute.
   */
  [key: `data-${string}`]: OptionalProperty<any>;

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
   * Stores values on the element as attributes prefixed with `data-`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
   */
  dataset?: OptionalProperty<Record<string, string>>;

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

  /**
   * A cryptographic nonce (number used once) that can be used by Content Security Policy
   * to determine whether a given fetch will be allowed to proceed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce
   */
  nonce?: OptionalProperty<string>;

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

  /**
   * Allows you to specify that a standard HTML element should behave like a registered custom element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/is
   */
  is?: OptionalProperty<string>;

  /**
   * The microdata `itemid` attribute, the unique ID of an item.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemid
   */
  itemId?: OptionalProperty<string>;

  /**
   * The microdata `itemprop` attribute, the property name of an item.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemprop
   */
  itemProp?: OptionalProperty<string>;

  /**
   * The microdata `itemref` attribute, IDs of other elements that provide additional properties.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemref
   */
  itemRef?: OptionalProperty<string>;

  /**
   * The microdata `itemscope` attribute, which creates an item.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemscope
   */
  itemScope?: OptionalProperty<boolean>;

  /**
   * The microdata `itemtype` attribute, the URL of the vocabulary that defines the item's properties.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemtype
   */
  itemType?: OptionalProperty<string>;
}



export interface Styles extends CSS.Properties, CSS.PropertiesHyphen {
  [key: string]: any;
}

export type CSSProperties = {
  [K in keyof Styles]: OptionalProperty<Styles[K]>;
};

export interface ClassMap {
  [className: string]: OptionalProperty<any>;
}

export type EventHandler<E> = (event: E) => void;

export type PropertiesOf<E extends HTMLElement> = HTMLElementProps &
  EventsFor<E> & {
    /**
     * For TypeScript support; child elements passed through JSX.
     */
    children?: any;

    /**
     * Receives a reference to the DOM node when rendered.
     * Returns a cleanup function that is called when the node is removed.
     */
    ref?: ((value: E) => () => void);
  };

/**
 * The following elements are defined based on the WHATWG HTML spec:
 * https://html.spec.whatwg.org/multipage/#toc-semantics
 **/

/*====================================*\
|| 4.2        Document metadata       ||
\*====================================*/

export interface IntrinsicElements {
  /**
   * The _External Resource Link_ element.
   *
   * Specifies relationships between the current document and an external resource.
   * Commonly used to link stylesheets, icons, preload assets, and more.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
   */
  link: HTMLLinkElementProps;

  /**
   * The _Metadata_ element.
   *
   * Represents metadata that cannot be represented by other HTML meta-related elements,
   * such as `<base>`, `<link>`, `<script>`, `<style>`, or `<title>`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
   */
  meta: HTMLMetaElementProps;

  /**
   * The _Style Information_ element.
   *
   * Contains style information for a document, or part of a document.
   * It contains CSS, which is applied to the contents of the document containing the element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
   */
  style: HTMLStyleElementProps;
}

interface HTMLLinkElementProps extends PropertiesOf<HTMLLinkElement> {
  /**
   * The URL of the linked resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-href
   */
  href?: OptionalProperty<string>;

  /**
   * The relationship of the linked document to the current document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-rel
   */
  rel?: OptionalProperty<string>;

  /**
   * The type of content to preload when `rel="preload"` or `rel="prefetch"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-as
   */
  as?: OptionalProperty<
    | "audio"
    | "document"
    | "embed"
    | "fetch"
    | "font"
    | "image"
    | "object"
    | "script"
    | "style"
    | "track"
    | "video"
    | "worker"
  >;

  /**
   * The MIME type of the linked resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-type
   */
  type?: OptionalProperty<string>;

  /**
   * The sizes of the icons for visual media.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-sizes
   */
  sizes?: OptionalProperty<string>;

  /**
   * Whether to use CORS when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin
   */
  crossOrigin?: OptionalProperty<"anonymous" | "use-credentials">;

  /**
   * The media that the linked resource applies to.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-media
   */
  media?: OptionalProperty<string>;

  /**
   * Subresource integrity hash for the linked resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-integrity
   */
  integrity?: OptionalProperty<string>;

  /**
   * Which referrer to use when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-referrerpolicy
   */
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;

  /**
   * The language of the linked resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-hreflang
   */
  hreflang?: OptionalProperty<string>;

  /**
   * Whether the linked stylesheet is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;
}

interface HTMLMetaElementProps extends PropertiesOf<HTMLMetaElement> {
  /**
   * The name of the metadata property.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * The value of the metadata property.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-content
   */
  content?: OptionalProperty<string>;

  /**
   * Defines a pragma directive.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
   */
  httpEquiv?: OptionalProperty<string>;

  /**
   * Declares the character encoding of the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-charset
   */
  charset?: OptionalProperty<string>;

  /**
   * The media that the metadata applies to.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-media
   */
  media?: OptionalProperty<string>;
}

interface HTMLStyleElementProps extends PropertiesOf<HTMLStyleElement> {
  /**
   * The media for which the style information applies.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style#attr-media
   */
  media?: OptionalProperty<string>;

  /**
   * Whether the style is blocked from applying.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style#attr-blocking
   */
  blocking?: OptionalProperty<"render">;
}

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

  /**
   * The _Search_ element.
   *
   * Represents a section of the document whose contents are intended to enable the user to search or filter
   * the document or site. This can include search results, search suggestions, or a search input.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/search
   */
  search: PropertiesOf<HTMLElement>;
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
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;
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

type HTMLMediaElementProps<T extends HTMLMediaElement> = HTMLElementProps &
  PropertiesOf<T> & {
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
      | Getter<MediaStream>
      | Getter<MediaStream | undefined>
      | Getter<MediaSource>
      | Getter<MediaSource | undefined>
      | Getter<Blob>
      | Getter<Blob | undefined>
      | Getter<File>
      | Getter<File | undefined>;

    /**
     * The current audio volume of the media element. Must be a number between 0 and 1.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
     */
    volume?: OptionalProperty<number>;
  };

interface HTMLVideoElementProps extends HTMLMediaElementProps<HTMLVideoElement> {
  /**
   * The height of the video's display area in CSS pixels. This must be an absolute value; percentages are not allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement
   */
  height?: SizeProperty;

  /**
   * The width of the video's display area in CSS pixels. This must be an absolute value; percentages are not allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement
   */
  width?: SizeProperty;

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
  height?: SizeProperty;

  /**
   * The width of the image in pixels. Must be an integer without a unit.
   *
   * Allowed if the source element's parent is a `<picture>` element, not allowed for `<audio>` or `<video>` elements.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source#attr-width
   */
  width?: SizeProperty;
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
  height?: SizeProperty;

  /**
   * The width of the image in CSS pixels. Must be an integer without a unit.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/width
   */
  width?: SizeProperty;

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
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;

  /**
   * One or more strings separated by commas, indicating a set of source sizes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/sizes
   */
  sizes?: OptionalProperty<string>;

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
  height?: SizeProperty;

  /**
   * The width of the frame in CSS pixels.
   */
  width?: SizeProperty;

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
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;

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
  height?: SizeProperty;

  /**
   * The displayed width of the resource, in CSS pixels. This must be an absolute value; percentages are not allowed.
   */
  width?: SizeProperty;

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
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;

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

interface HTMLInputElementProps extends PropertiesOf<HTMLInputElement> {
  /**
   * File types you can submit, when `type` is `"file"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-accept
   */
  accept?: OptionalProperty<string>;

  /**
   * Text to display in the browser when the image `type` is `"image"` and the image doesn't load.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-alt
   */
  alt?: OptionalProperty<string>;

  /**
   * Hint for form autofill.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-autocomplete
   */
  autocomplete?: OptionalProperty<AutocompleteValues>;

  /**
   * Whether the checkbox or radio is checked, when `type` is `"checkbox"` or `"radio"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-checked
   */
  checked?: OptionalProperty<boolean>;

  /**
   * The directionality of the form control when the form is submitted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-dirname
   */
  dirName?: OptionalProperty<string>;

  /**
   * Whether the input is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The ID of the associated form element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-form
   */
  form?: OptionalProperty<string>;

  /**
   * The URL to submit the form data to, overriding the form's `action`, when `type` is `"submit"` or `"image"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-formaction
   */
  formAction?: OptionalProperty<string>;

  /**
   * The encoding type to use when submitting the form, overriding the form's `enctype`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-formenctype
   */
  formEnctype?: OptionalProperty<string>;

  /**
   * The HTTP method to use when submitting the form, overriding the form's `method`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-formmethod
   */
  formMethod?: OptionalProperty<string>;

  /**
   * Whether to skip validation when submitting the form, overriding the form's `novalidate`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-formnovalidate
   */
  formNoValidate?: OptionalProperty<boolean>;

  /**
   * The target window for the form submission response, overriding the form's `target`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-formtarget
   */
  formTarget?: OptionalProperty<string>;

  /**
   * The height of the image button in pixels, when `type` is `"image"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-height
   */
  height?: SizeProperty;

  /**
   * The ID of a `<datalist>` element that provides autocomplete suggestions.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-list
   */
  list?: OptionalProperty<string>;

  /**
   * The maximum value allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-max
   */
  max?: SizeProperty;

  /**
   * The maximum number of characters allowed in the value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-maxlength
   */
  maxLength?: OptionalProperty<number>;

  /**
   * The minimum value allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-min
   */
  min?: SizeProperty;

  /**
   * The minimum number of characters required in the value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-minlength
   */
  minLength?: OptionalProperty<number>;

  /**
   * Whether multiple values are allowed, when `type` is `"email"` or `"file"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-multiple
   */
  multiple?: OptionalProperty<boolean>;

  /**
   * The name of the form control, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * A regular expression the value must match.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-pattern
   */
  pattern?: OptionalProperty<string | RegExp> | OptionalProperty<string> | OptionalProperty<RegExp>;

  /**
   * Text shown in the input when it is empty.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-placeholder
   */
  placeholder?: OptionalProperty<string>;

  /**
   * The ID of the element to associate the popover with.
   */
  popoverTarget?: OptionalProperty<string>;

  /**
   * The action to perform on the popover target.
   */
  popoverTargetAction?: OptionalProperty<"toggle" | "show" | "hide">;

  /**
   * Whether the input is read-only.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-readonly
   */
  readOnly?: OptionalProperty<boolean>;

  /**
   * Whether the input is required before form submission.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-required
   */
  required?: OptionalProperty<boolean>;

  /**
   * The width of the input in characters, when `type` is `"text"`, `"search"`, `"tel"`, `"url"`, `"email"`, or `"password"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-size
   */
  size?: OptionalProperty<number | string>;

  /**
   * The URL of the image to display, when `type` is `"image"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-src
   */
  src?: OptionalProperty<string>;

  /**
   * The stepping interval for numeric and date/time inputs.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-step
   */
  step?: OptionalProperty<number>;

  /**
   * The type of form control to render.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-type
   */
  type?: OptionalProperty<InputType>;

  /**
   * The value of the form control.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-value
   */
  value?: OptionalProperty<string>;

  /**
   * The width of the image button in pixels, when `type` is `"image"`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-width
   */
  width?: SizeProperty;

  /**
   * A hint about the input, displayed in a tooltip.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title
   */
  title?: OptionalProperty<string>;
}

export type ButtonTypeValues = "submit" | "reset" | "button";

interface ButtonElementProps extends PropertiesOf<HTMLButtonElement> {
  /**
   * Whether the button is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The ID of the associated form element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-form
   */
  form?: OptionalProperty<string>;

  /**
   * The URL to submit the form data to, overriding the form's `action`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-formaction
   */
  formAction?: OptionalProperty<string>;

  /**
   * The encoding type to use, overriding the form's `enctype`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-formenctype
   */
  formEnctype?: OptionalProperty<string>;

  /**
   * The HTTP method to use, overriding the form's `method`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-formmethod
   */
  formMethod?: OptionalProperty<string>;

  /**
   * Whether to skip validation, overriding the form's `novalidate`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-formnovalidate
   */
  formNoValidate?: OptionalProperty<boolean>;

  /**
   * The target window for the response, overriding the form's `target`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-formtarget
   */
  formTarget?: OptionalProperty<string>;

  /**
   * The name of the button, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * The ID of the element to associate the popover with.
   */
  popoverTarget?: OptionalProperty<string>;

  /**
   * The action to perform on the popover target.
   */
  popoverTargetAction?: OptionalProperty<"toggle" | "show" | "hide">;

  /**
   * The behavior of the button.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type
   */
  type?: OptionalProperty<ButtonTypeValues>;

  /**
   * The initial value of the button, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-value
   */
  value?: OptionalProperty<string>;
}

interface HTMLSelectElementProps extends PropertiesOf<HTMLSelectElement> {
  /**
   * Hint for form autofill.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-autocomplete
   */
  autocomplete?: OptionalProperty<AutocompleteValues>;

  /**
   * Whether the select is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The ID of the associated form element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-form
   */
  form?: OptionalProperty<string>;

  /**
   * Whether multiple options can be selected.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-multiple
   */
  multiple?: OptionalProperty<boolean>;

  /**
   * The name of the form control, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * Whether the select is required before form submission.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-required
   */
  required?: OptionalProperty<boolean>;

  /**
   * The number of visible rows in the list.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-size
   */
  size?: OptionalProperty<number | string>;

  /**
   * The value of the form control.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-value
   */
  value?: OptionalProperty<string>;
}

interface HTMLOptGroupElementProps extends PropertiesOf<HTMLOptGroupElement> {
  /**
   * Whether the group of options is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/optgroup#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The label for the group of options.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/optgroup#attr-label
   */
  label?: OptionalProperty<string>;
}

interface HTMLOptionElementProps extends PropertiesOf<HTMLOptionElement> {
  /**
   * Whether the option is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/option#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The label for the option.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/option#attr-label
   */
  label?: OptionalProperty<string>;

  /**
   * Whether the option is selected.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/option#attr-selected
   */
  selected?: OptionalProperty<boolean>;

  /**
   * The value to submit with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/option#attr-value
   */
  value?: OptionalProperty<string>;
}

interface HTMLTextAreaElementProps extends PropertiesOf<HTMLTextAreaElement> {
  /**
   * Hint for form autofill.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-autocomplete
   */
  autocomplete?: OptionalProperty<AutocompleteValues>;

  /**
   * The visible width of the text control, in average character widths.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-cols
   */
  cols?: OptionalProperty<number>;

  /**
   * The directionality of the form control when the form is submitted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-dirname
   */
  dirname?: OptionalProperty<string>;

  /**
   * Whether the textarea is disabled.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-disabled
   */
  disabled?: OptionalProperty<boolean>;

  /**
   * The ID of the associated form element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-form
   */
  form?: OptionalProperty<string>;

  /**
   * The maximum number of characters allowed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-maxlength
   */
  maxLength?: OptionalProperty<number>;

  /**
   * The minimum number of characters required.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-minlength
   */
  minLength?: OptionalProperty<number>;

  /**
   * The name of the form control, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-name
   */
  name?: OptionalProperty<string>;

  /**
   * Text shown in the textarea when it is empty.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-placeholder
   */
  placeholder?: OptionalProperty<string>;

  /**
   * Whether the textarea is read-only.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-readonly
   */
  readOnly?: OptionalProperty<boolean>;

  /**
   * Whether the textarea is required before form submission.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-required
   */
  required?: OptionalProperty<boolean>;

  /**
   * The number of visible text lines.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-rows
   */
  rows?: OptionalProperty<number>;

  /**
   * How the value should be wrapped when submitting the form.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-wrap
   */
  wrap?: OptionalProperty<"soft" | "hard">;

  /**
   * The value of the form control.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-value
   */
  value?: OptionalProperty<string>;
}

interface HTMLOutputElementProps extends PropertiesOf<HTMLOutputElement> {
  /**
   * A space-separated list of other elements' IDs that contributed to the calculation.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/output#attr-for
   */
  for?: OptionalProperty<string>;

  /**
   * The ID of the associated form element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/output#attr-form
   */
  form?: OptionalProperty<string>;

  /**
   * The name of the form control, submitted with the form data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/output#attr-name
   */
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
  width?: SizeProperty;

  /**
   * The height of the coordinate space in CSS pixels. Defaults to 150.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#attributes
   */
  height?: SizeProperty;
}

/*====================================*\
|| ****                           SVG ||
\*====================================*/

/**
 * Converts a kebab-case string literal to camelCase at the type level.
 */
type CamelCase<S extends string> = S extends `${infer P}-${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

/**
 * SVG presentation attributes defined in their native kebab-case form (SVG spec naming).
 *
 * Both kebab-case (e.g. `fill-opacity`) and camelCase (e.g. `fillOpacity`) are accepted
 * in JSX. The camelCase variants are auto-generated from this base via mapped type.
 *
 * @see https://www.w3.org/TR/SVG2/painting.html
 */
type SVGPresentationAttrsBase = {
  /** Fill color. */
  fill?: OptionalProperty<string>;
  /** Fill opacity. */
  "fill-opacity"?: OptionalProperty<number | string>;
  /** Fill rule for shapes. */
  "fill-rule"?: OptionalProperty<"nonzero" | "evenodd">;
  /** Stroke color. */
  stroke?: OptionalProperty<string>;
  /** Stroke width. */
  "stroke-width"?: OptionalProperty<number | string>;
  /** Stroke opacity. */
  "stroke-opacity"?: OptionalProperty<number | string>;
  /** Stroke linecap style. */
  "stroke-linecap"?: OptionalProperty<"butt" | "round" | "square">;
  /** Stroke linejoin style. */
  "stroke-linejoin"?: OptionalProperty<"arcs" | "bevel" | "miter" | "miter-clip" | "round">;
  /** Stroke dash array. */
  "stroke-dasharray"?: OptionalProperty<string>;
  /** Stroke dash offset. */
  "stroke-dashoffset"?: OptionalProperty<number | string>;
  /** Stroke miter limit. */
  "stroke-miterlimit"?: OptionalProperty<number>;
  /** Element opacity. */
  opacity?: OptionalProperty<number | string>;
  /** Transformation to apply. */
  transform?: OptionalProperty<string>;
  /** Transform origin point. */
  "transform-origin"?: OptionalProperty<string>;
  /** Clipping path reference. */
  "clip-path"?: OptionalProperty<string>;
  /** Clipping rule. */
  "clip-rule"?: OptionalProperty<"nonzero" | "evenodd">;
  /** Text color. */
  color?: OptionalProperty<string>;
  /** Color interpolation mode. */
  "color-interpolation"?: OptionalProperty<"auto" | "sRGB" | "linearRGB">;
  /** Color interpolation mode for filters. */
  "color-interpolation-filters"?: OptionalProperty<"auto" | "sRGB" | "linearRGB">;
  /** Color rendering quality. */
  "color-rendering"?: OptionalProperty<"auto" | "optimizeSpeed" | "optimizeQuality">;
  /** Cursor appearance. */
  cursor?: OptionalProperty<string>;
  /** Text direction. */
  direction?: OptionalProperty<"ltr" | "rtl">;
  /** Display behavior. */
  display?: OptionalProperty<string>;
  /** Dominant baseline alignment. */
  "dominant-baseline"?: OptionalProperty<string>;
  /** Filter effect reference. */
  filter?: OptionalProperty<string>;
  /** Font family. */
  "font-family"?: OptionalProperty<string>;
  /** Font size. */
  "font-size"?: OptionalProperty<number | string>;
  /** Font size adjustment. */
  "font-size-adjust"?: OptionalProperty<number | string>;
  /** Font stretch. */
  "font-stretch"?: OptionalProperty<string>;
  /** Font style. */
  "font-style"?: OptionalProperty<"normal" | "italic" | "oblique">;
  /** Font variant. */
  "font-variant"?: OptionalProperty<string>;
  /** Font weight. */
  "font-weight"?: OptionalProperty<number | string>;
  /** Image rendering quality. */
  "image-rendering"?: OptionalProperty<"auto" | "optimizeSpeed" | "optimizeQuality">;
  /** Letter spacing. */
  "letter-spacing"?: OptionalProperty<number | string>;
  /** Lighting color for filter primitives. */
  "lighting-color"?: OptionalProperty<string>;
  /** Marker reference (all vertices). */
  marker?: OptionalProperty<string>;
  /** Marker reference (end vertex). */
  "marker-end"?: OptionalProperty<string>;
  /** Marker reference (mid vertices). */
  "marker-mid"?: OptionalProperty<string>;
  /** Marker reference (start vertex). */
  "marker-start"?: OptionalProperty<string>;
  /** Mask reference. */
  mask?: OptionalProperty<string>;
  /** Mask type. */
  "mask-type"?: OptionalProperty<"luminance" | "alpha">;
  /** Overflow behavior. */
  overflow?: OptionalProperty<"visible" | "hidden">;
  /** Paint order. */
  "paint-order"?: OptionalProperty<string>;
  /** Pointer event behavior. */
  "pointer-events"?: OptionalProperty<string>;
  /** Shape rendering quality. */
  "shape-rendering"?: OptionalProperty<"auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision">;
  /** Stop color for gradients. */
  "stop-color"?: OptionalProperty<string>;
  /** Stop opacity for gradients. */
  "stop-opacity"?: OptionalProperty<number | string>;
  /** Text anchor alignment. */
  "text-anchor"?: OptionalProperty<"start" | "middle" | "end">;
  /** Text decoration. */
  "text-decoration"?: OptionalProperty<string>;
  /** Text overflow behavior. */
  "text-overflow"?: OptionalProperty<string>;
  /** Text rendering quality. */
  "text-rendering"?: OptionalProperty<"auto" | "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision">;
  /** Unicode bidirectional behavior. */
  "unicode-bidi"?: OptionalProperty<string>;
  /** Vector effect. */
  "vector-effect"?: OptionalProperty<"none" | "non-scaling-stroke">;
  /** Visibility. */
  visibility?: OptionalProperty<"visible" | "hidden" | "collapse">;
  /** White space handling. */
  "white-space"?: OptionalProperty<string>;
  /** Word spacing. */
  "word-spacing"?: OptionalProperty<number | string>;
  /** Writing mode. */
  "writing-mode"?: OptionalProperty<string>;
};

/**
 * Auto-generated camelCase aliases for all kebab-case SVG presentation attributes.
 * Enables JSX usage like `fillOpacity` alongside the standard SVG `fill-opacity`.
 */
type SVGPresentationAttrsCamel = {
  [K in keyof SVGPresentationAttrsBase & string as CamelCase<K>]?: SVGPresentationAttrsBase[K];
};

/**
 * SVG presentation attributes — accepts both kebab-case and camelCase.
 */
type SVGPresentationAttributes = SVGPresentationAttrsBase & SVGPresentationAttrsCamel;

/**
 * Base props for all SVG elements.
 *
 * SVG elements support `id`, `lang`, `tabIndex`, `class`/`className`, and `style`
 * as attribute-based props, plus all SVG presentation attributes and DOM events.
 *
 * HTML-only attributes (`popover`, `slot`, `exportParts`, etc.) are intentionally excluded.
 */
export type SVGElementProps = {
  [key: `attr:${string}`]: OptionalProperty<any>;
  [key: `on:${string}`]: any;

  /** Element unique identifier. */
  id?: OptionalProperty<string>;
  /** Element language code. */
  lang?: OptionalProperty<string>;
  /** Tab order. */
  tabIndex?: OptionalProperty<number>;
  /** CSS class name. */
  class?: OptionalProperty<ClassListValues>;
  /** CSS class name (alias for `class`). */
  className?: OptionalProperty<ClassListValues>;
  /** Inline styles. */
  style?:
    | MaybeGetter<string>
    | MaybeGetter<string | undefined>
    | MaybeGetter<CSSProperties>
    | MaybeGetter<CSSProperties | undefined>
    | CSSTemplate
    | (string | CSSProperties | CSSTemplate)[];

  /** Child elements. */
  children?: any;
  /** Element ref callback. */
  ref?:
    | ((value: SVGElement) => () => void)
    | ((value: Element) => () => void)
    | ((value: Node) => () => void);
} & SVGPresentationAttributes & EventsFor<SVGElement>;

// --- SVG container / structural elements ---

/**
 * The `<svg>` element — the SVG document root.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
 */
interface SVGSVGElementProps extends SVGElementProps {
  /** Viewport bounding box. */
  viewBox?: OptionalProperty<string>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
  /** The SVG namespace declaration. */
  xmlns?: OptionalProperty<string>;
  /** SVG version. */
  version?: OptionalProperty<string>;
  /** Base profile. */
  baseProfile?: OptionalProperty<string>;
}

/**
 * The `<symbol>` element — used to define graphical template objects which can be instantiated
 * by the `<use>` element. Symbols are not rendered directly.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/symbol
 */
interface SVGSymbolElementProps extends SVGElementProps {
  /** Viewport bounding box. */
  viewBox?: OptionalProperty<string>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** X-axis reference point. */
  refX?: OptionalProperty<string | number>;
  /** Y-axis reference point. */
  refY?: OptionalProperty<string | number>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
}

/**
 * The `<use>` element — takes nodes from within the SVG document and duplicates them elsewhere.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use
 */
interface SVGUseElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
}

// --- Shape elements ---

/**
 * The `<circle>` element — draws a circle centered at `cx`,`cy` with radius `r`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
 */
interface SVGCircleElementProps extends SVGElementProps {
  /** X-axis center coordinate. */
  cx?: OptionalProperty<string | number>;
  /** Y-axis center coordinate. */
  cy?: OptionalProperty<string | number>;
  /** Radius of the circle. */
  r?: OptionalProperty<string | number>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<ellipse>` element — draws an ellipse centered at `cx`,`cy` with radii `rx`,`ry`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/ellipse
 */
interface SVGEllipseElementProps extends SVGElementProps {
  /** X-axis center coordinate. */
  cx?: OptionalProperty<string | number>;
  /** Y-axis center coordinate. */
  cy?: OptionalProperty<string | number>;
  /** X-axis radius. */
  rx?: OptionalProperty<string | number>;
  /** Y-axis radius. */
  ry?: OptionalProperty<string | number>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<line>` element — draws a straight line between two points.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/line
 */
interface SVGLineElementProps extends SVGElementProps {
  /** X-axis coordinate of the start point. */
  x1?: OptionalProperty<string | number>;
  /** Y-axis coordinate of the start point. */
  y1?: OptionalProperty<string | number>;
  /** X-axis coordinate of the end point. */
  x2?: OptionalProperty<string | number>;
  /** Y-axis coordinate of the end point. */
  y2?: OptionalProperty<string | number>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<rect>` element — draws a rectangle with optional rounded corners.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
 */
interface SVGRectElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** X-axis corner radius. */
  rx?: OptionalProperty<string | number>;
  /** Y-axis corner radius. */
  ry?: OptionalProperty<string | number>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<path>` element — defines a shape using path data (a sequence of commands like M, L, C, Z, etc.).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
 */
interface SVGPathElementProps extends SVGElementProps {
  /** The path data (a string of path commands like `M10 10 L 20 20`) */
  d?: OptionalProperty<string>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<polygon>` element — draws a closed shape consisting of connected straight line segments.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polygon
 */
interface SVGPolygonElementProps extends SVGElementProps {
  /** A string of coordinate pairs defining the polygon's vertices */
  points?: OptionalProperty<string>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

/**
 * The `<polyline>` element — draws a series of connected straight line segments (open shape).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline
 */
interface SVGPolylineElementProps extends SVGElementProps {
  /** A string of coordinate pairs defining the polyline's vertices */
  points?: OptionalProperty<string>;
  /** Explicit path length. */
  pathLength?: OptionalProperty<number>;
}

// --- Text elements ---

/**
 * The `<text>` element — renders a text string at the given coordinates.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text
 */
interface SVGTextElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** X-axis offset. */
  dx?: OptionalProperty<string | number | Array<string | number>>;
  /** Y-axis offset. */
  dy?: OptionalProperty<string | number | Array<string | number>>;
  /** Rotation angle. */
  rotate?: OptionalProperty<string | number | Array<string | number>>;
  /** Length adjustment mode. */
  lengthAdjust?: OptionalProperty<string>;
  /** Computed text length. */
  textLength?: OptionalProperty<string | number>;
}

/**
 * The `<tspan>` element — a sub-element of `<text>` for adjusting glyph positioning
 * and applying formatting to a span of text. Accepts per-character coordinate arrays.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/tspan
 */
interface SVGTSpanElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number | string[] | number[]>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number | string[] | number[]>;
  /** X-axis offset. */
  dx?: OptionalProperty<string | number | string[] | number[]>;
  /** Y-axis offset. */
  dy?: OptionalProperty<string | number | string[] | number[]>;
  /** Computed text length. */
  textLength?: OptionalProperty<string | number>;
  /** Length adjustment mode. */
  lengthAdjust?: OptionalProperty<"spacing" | "spacingAndGlyphs">;
  /** Rotation angle. */
  rotate?: OptionalProperty<number | number[]>;
}

/**
 * The `<textPath>` element — renders text along the shape of a referenced `<path>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
 */
interface SVGTextPathElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
  /** Offset from the start of the path. */
  startOffset?: OptionalProperty<string | number>;
  /** Rendering method. */
  method?: OptionalProperty<"align" | "stretch">;
  /** Spacing mode. */
  spacing?: OptionalProperty<"auto" | "exact">;
}

// --- Image element ---

/**
 * The `<image>` element — embeds an external raster or vector image inside the SVG.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image
 */
interface SVGImageElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
  /** CORS policy. */
  crossOrigin?: OptionalProperty<"anonymous" | "use-credentials">;
}

// --- Gradient elements ---

/**
 * The `<linearGradient>` element — defines a linear gradient to fill or stroke shapes.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
 */
interface SVGLinearGradientElementProps extends SVGElementProps {
  /** X-axis coordinate of the start point. */
  x1?: OptionalProperty<string | number>;
  /** Y-axis coordinate of the start point. */
  y1?: OptionalProperty<string | number>;
  /** X-axis coordinate of the end point. */
  x2?: OptionalProperty<string | number>;
  /** Y-axis coordinate of the end point. */
  y2?: OptionalProperty<string | number>;
  /** Coordinate system for gradient. */
  gradientUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Gradient transformation. */
  gradientTransform?: OptionalProperty<string>;
  /** Reference URL. */
  href?: OptionalProperty<string>;
}

/**
 * The `<radialGradient>` element — defines a radial gradient to fill or stroke shapes.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
 */
interface SVGRadialGradientElementProps extends SVGElementProps {
  /** X-axis center coordinate. */
  cx?: OptionalProperty<string | number>;
  /** Y-axis center coordinate. */
  cy?: OptionalProperty<string | number>;
  /** Radius of the gradient. */
  r?: OptionalProperty<string | number>;
  /** X-axis focal point. */
  fx?: OptionalProperty<string | number>;
  /** Y-axis focal point. */
  fy?: OptionalProperty<string | number>;
  /** Focal radius. */
  fr?: OptionalProperty<string | number>;
  /** Coordinate system for gradient. */
  gradientUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Gradient transformation. */
  gradientTransform?: OptionalProperty<string>;
  /** Reference URL. */
  href?: OptionalProperty<string>;
}

/**
 * The `<stop>` element — defines a color stop used by gradient elements.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/stop
 */
interface SVGStopElementProps extends SVGElementProps {
  /** Gradient stop offset. */
  offset?: OptionalProperty<string | number>;
}

// --- Clipping / masking elements ---

/**
 * The `<clipPath>` element — defines a clipping path used to restrict rendering
 * to a specific region.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/clipPath
 */
interface SVGClipPathElementProps extends SVGElementProps {
  /** Coordinate system for clipping. */
  clipPathUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
}

/**
 * The `<mask>` element — defines an alpha mask used to control the visibility
 * of overlapping graphics.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask
 */
interface SVGMaskElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** Coordinate system for mask. */
  maskUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Coordinate system for mask content. */
  maskContentUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
}

// --- Pattern / Marker elements ---

/**
 * The `<pattern>` element — defines a tileable pattern used to fill or stroke shapes.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/pattern
 */
interface SVGPatternElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** Coordinate system for pattern. */
  patternUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Coordinate system for pattern content. */
  patternContentUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Pattern transformation. */
  patternTransform?: OptionalProperty<string>;
  /** Viewport bounding box. */
  viewBox?: OptionalProperty<string>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
  /** Reference URL. */
  href?: OptionalProperty<string>;
}

/**
 * The `<marker>` element — defines a graphic (e.g. arrowhead) placed at the vertices
 * of lines, paths, and polygons.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/marker
 */
interface SVGMarkerElementProps extends SVGElementProps {
  /** Marker viewport width. */
  markerWidth?: OptionalProperty<string | number>;
  /** Marker viewport height. */
  markerHeight?: OptionalProperty<string | number>;
  /** X-axis reference point. */
  refX?: OptionalProperty<string | number>;
  /** Y-axis reference point. */
  refY?: OptionalProperty<string | number>;
  /** Orientation of the marker. */
  orient?: OptionalProperty<string | number>;
  /** Coordinate system for marker. */
  markerUnits?: OptionalProperty<"userSpaceOnUse" | "strokeWidth">;
  /** Viewport bounding box. */
  viewBox?: OptionalProperty<string>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
}

// --- Filter elements ---

/**
 * The `<filter>` element — defines a filter effect composed of one or more
 * filter primitives (child FE elements).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter
 */
interface SVGFilterElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
  /** Coordinate system for filter. */
  filterUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Coordinate system for filter primitives. */
  primitiveUnits?: OptionalProperty<"userSpaceOnUse" | "objectBoundingBox">;
  /** Reference URL. */
  href?: OptionalProperty<string>;
}

/**
 * The `<feGaussianBlur>` element — applies a Gaussian blur to the input image.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feGaussianBlur
 */
interface SVGFEGaussianBlurElementProps extends SVGElementProps {
  /** Standard deviation of the blur. */
  stdDeviation?: OptionalProperty<string | number>;
  /** Edge mode for the blur. */
  edgeMode?: OptionalProperty<"duplicate" | "wrap" | "none">;
  /** The SVG `in` attribute — names the input (use the string `"in"`, not the JS keyword) */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feOffset>` element — offsets the input image by `dx` and `dy`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feOffset
 */
interface SVGFEOffsetElementProps extends SVGElementProps {
  /** X-axis offset. */
  dx?: OptionalProperty<string | number>;
  /** Y-axis offset. */
  dy?: OptionalProperty<string | number>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feMerge>` element — stacks filter primitives on top of one another.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feMerge
 */
interface SVGFEMergeElementProps extends SVGElementProps {
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feMergeNode>` element — references one input for `<feMerge>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feMergeNode
 */
interface SVGFEMergeNodeElementProps extends SVGElementProps {
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
}

/**
 * The `<feColorMatrix>` element — transforms color values via a matrix, saturation,
 * hue rotation, or luminance-to-alpha conversion.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feColorMatrix
 */
interface SVGFEColorMatrixElementProps extends SVGElementProps {
  /** Type of color transformation. */
  type?: OptionalProperty<"matrix" | "saturate" | "hueRotate" | "luminanceToAlpha">;
  /** Matrix or color values. */
  values?: OptionalProperty<string>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feComposite>` element — performs pixel-wise compositing of two input images.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feComposite
 */
interface SVGFECompositeElementProps extends SVGElementProps {
  /** Compositing operator. */
  operator?: OptionalProperty<"over" | "in" | "out" | "atop" | "xor" | "arithmetic">;
  /** Constant multiplier k1. */
  k1?: OptionalProperty<number>;
  /** Constant multiplier k2. */
  k2?: OptionalProperty<number>;
  /** Constant multiplier k3. */
  k3?: OptionalProperty<number>;
  /** Constant multiplier k4. */
  k4?: OptionalProperty<number>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Second input to this filter primitive. */
  in2?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feBlend>` element — blends two input images using a blend mode.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feBlend
 */
interface SVGFEBlendElementProps extends SVGElementProps {
  /** Blend mode. */
  mode?: OptionalProperty<"normal" | "multiply" | "screen" | "darken" | "lighten">;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Second input to this filter primitive. */
  in2?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feFlood>` element — fills the filter region with a solid color.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFlood
 */
interface SVGFEFloodElementProps extends SVGElementProps {
  /** Flood color. */
  floodColor?: OptionalProperty<string>;
  /** Flood opacity. */
  floodOpacity?: OptionalProperty<number | string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feDropShadow>` element — creates a drop-shadow effect on the input.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDropShadow
 */
interface SVGFEDropShadowElementProps extends SVGElementProps {
  /** X-axis offset of the shadow. */
  dx?: OptionalProperty<string | number>;
  /** Y-axis offset of the shadow. */
  dy?: OptionalProperty<string | number>;
  /** Standard deviation of the shadow blur. */
  stdDeviation?: OptionalProperty<string | number>;
  /** Shadow flood color. */
  floodColor?: OptionalProperty<string>;
  /** Shadow flood opacity. */
  floodOpacity?: OptionalProperty<number | string>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feDisplacementMap>` element — displaces pixel positions using a
 * color-channel map from a second input.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDisplacementMap
 */
interface SVGFEDisplacementMapElementProps extends SVGElementProps {
  /** Displacement scale factor. */
  scale?: OptionalProperty<number>;
  /** Color channel used for X displacement. */
  xChannelSelector?: OptionalProperty<"R" | "G" | "B" | "A">;
  /** Color channel used for Y displacement. */
  yChannelSelector?: OptionalProperty<"R" | "G" | "B" | "A">;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Second input to this filter primitive. */
  in2?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feMorphology>` element — thins (erode) or thickens (dilate) the input graphic.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feMorphology
 */
interface SVGFEMorphologyElementProps extends SVGElementProps {
  /** Morphology operator. */
  operator?: OptionalProperty<"dilate" | "erode">;
  /** Radius of the morphology operation. */
  radius?: OptionalProperty<string | number>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feTile>` element — fills a rectangle with a tiled pattern of the input.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feTile
 */
interface SVGFETileElementProps extends SVGElementProps {
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feTurbulence>` element — generates Perlin noise for use as a texture.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feTurbulence
 */
interface SVGFETurbulenceElementProps extends SVGElementProps {
  /** Type of noise. */
  type?: OptionalProperty<"fractalNoise" | "turbulence">;
  /** Base frequency of the noise. */
  baseFrequency?: OptionalProperty<string | number>;
  /** Number of octaves. */
  numOctaves?: OptionalProperty<number>;
  /** Random seed. */
  seed?: OptionalProperty<number>;
  /** Stitch tiles mode. */
  stitchTiles?: OptionalProperty<"stitch" | "noStitch">;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feComponentTransfer>` element — performs per-channel color remapping
 * using child `<feFuncR>`, `<feFuncG>`, `<feFuncB>`, `<feFuncA>` elements.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feComponentTransfer
 */
interface SVGFEComponentTransferElementProps extends SVGElementProps {
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feFuncR>` element — defines the red-channel transfer function for
 * `<feComponentTransfer>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFuncR
 */
interface SVGFEFuncRElementProps extends SVGElementProps {
  /** Type of transfer function. */
  type?: OptionalProperty<"identity" | "table" | "discrete" | "linear" | "gamma">;
  /** Table values for the transfer function. */
  tableValues?: OptionalProperty<string>;
  /** Slope of the linear function. */
  slope?: OptionalProperty<number>;
  /** Intercept of the linear function. */
  intercept?: OptionalProperty<number>;
  /** Amplitude of the gamma function. */
  amplitude?: OptionalProperty<number>;
  /** Exponent of the gamma function. */
  exponent?: OptionalProperty<number>;
  /** Offset of the transfer function. */
  offset?: OptionalProperty<number>;
}

/**
 * The `<feFuncG>` element — defines the green-channel transfer function for
 * `<feComponentTransfer>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFuncG
 */
interface SVGFEFuncGElementProps extends SVGElementProps {
  /** Type of transfer function. */
  type?: OptionalProperty<"identity" | "table" | "discrete" | "linear" | "gamma">;
  /** Table values for the transfer function. */
  tableValues?: OptionalProperty<string>;
  /** Slope of the linear function. */
  slope?: OptionalProperty<number>;
  /** Intercept of the linear function. */
  intercept?: OptionalProperty<number>;
  /** Amplitude of the gamma function. */
  amplitude?: OptionalProperty<number>;
  /** Exponent of the gamma function. */
  exponent?: OptionalProperty<number>;
  /** Offset of the transfer function. */
  offset?: OptionalProperty<number>;
}

/**
 * The `<feFuncB>` element — defines the blue-channel transfer function for
 * `<feComponentTransfer>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFuncB
 */
interface SVGFEFuncBElementProps extends SVGElementProps {
  /** Type of transfer function. */
  type?: OptionalProperty<"identity" | "table" | "discrete" | "linear" | "gamma">;
  /** Table values for the transfer function. */
  tableValues?: OptionalProperty<string>;
  /** Slope of the linear function. */
  slope?: OptionalProperty<number>;
  /** Intercept of the linear function. */
  intercept?: OptionalProperty<number>;
  /** Amplitude of the gamma function. */
  amplitude?: OptionalProperty<number>;
  /** Exponent of the gamma function. */
  exponent?: OptionalProperty<number>;
  /** Offset of the transfer function. */
  offset?: OptionalProperty<number>;
}

/**
 * The `<feFuncA>` element — defines the alpha-channel transfer function for
 * `<feComponentTransfer>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFuncA
 */
interface SVGFEFuncAElementProps extends SVGElementProps {
  /** Type of transfer function. */
  type?: OptionalProperty<"identity" | "table" | "discrete" | "linear" | "gamma">;
  /** Table values for the transfer function. */
  tableValues?: OptionalProperty<string>;
  /** Slope of the linear function. */
  slope?: OptionalProperty<number>;
  /** Intercept of the linear function. */
  intercept?: OptionalProperty<number>;
  /** Amplitude of the gamma function. */
  amplitude?: OptionalProperty<number>;
  /** Exponent of the gamma function. */
  exponent?: OptionalProperty<number>;
  /** Offset of the transfer function. */
  offset?: OptionalProperty<number>;
}

/**
 * The `<feConvolveMatrix>` element — applies a matrix convolution filter effect.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feConvolveMatrix
 */
interface SVGFEConvolveMatrixElementProps extends SVGElementProps {
  /** Size of the convolution matrix. */
  order?: OptionalProperty<number | string>;
  /** Convolution kernel values. */
  kernelMatrix?: OptionalProperty<string>;
  /** Divisor for the kernel. */
  divisor?: OptionalProperty<number>;
  /** Bias added to the result. */
  bias?: OptionalProperty<number>;
  /** X-axis target pixel. */
  targetX?: OptionalProperty<number>;
  /** Y-axis target pixel. */
  targetY?: OptionalProperty<number>;
  /** Edge mode for the convolution. */
  edgeMode?: OptionalProperty<"duplicate" | "wrap" | "none">;
  /** Kernel unit length. */
  kernelUnitLength?: OptionalProperty<number | string>;
  /** Whether to preserve the alpha channel. */
  preserveAlpha?: OptionalProperty<boolean>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feDiffuseLighting>` element — lights an image using the diffuse
 * reflection component of the Phong lighting model.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDiffuseLighting
 */
interface SVGFEDiffuseLightingElementProps extends SVGElementProps {
  /** Surface scale for lighting. */
  surfaceScale?: OptionalProperty<number>;
  /** Diffuse reflection constant. */
  diffuseConstant?: OptionalProperty<number>;
  /** Lighting color. */
  lightingColor?: OptionalProperty<string>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feSpecularLighting>` element — lights an image using the specular
 * reflection component of the Phong lighting model.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feSpecularLighting
 */
interface SVGFESpecularLightingElementProps extends SVGElementProps {
  /** Surface scale for lighting. */
  surfaceScale?: OptionalProperty<number>;
  /** Specular reflection constant. */
  specularConstant?: OptionalProperty<number>;
  /** Specular reflection exponent. */
  specularExponent?: OptionalProperty<number>;
  /** Lighting color. */
  lightingColor?: OptionalProperty<string>;
  /** Input to this filter primitive. */
  "in"?: OptionalProperty<string>;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

/**
 * The `<feDistantLight>` element — defines a distant light source for
 * `<feDiffuseLighting>` or `<feSpecularLighting>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDistantLight
 */
interface SVGFEDistantLightElementProps extends SVGElementProps {
  /** Azimuth of the light source. */
  azimuth?: OptionalProperty<number>;
  /** Elevation of the light source. */
  elevation?: OptionalProperty<number>;
}

/**
 * The `<fePointLight>` element — defines a point light source for
 * `<feDiffuseLighting>` or `<feSpecularLighting>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/fePointLight
 */
interface SVGFEPointLightElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<number>;
  /** Z-axis coordinate. */
  z?: OptionalProperty<number>;
}

/**
 * The `<feSpotLight>` element — defines a spot light source for
 * `<feDiffuseLighting>` or `<feSpecularLighting>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feSpotLight
 */
interface SVGFESpotLightElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<number>;
  /** Z-axis coordinate. */
  z?: OptionalProperty<number>;
  /** X-axis point-at target. */
  pointsAtX?: OptionalProperty<number>;
  /** Y-axis point-at target. */
  pointsAtY?: OptionalProperty<number>;
  /** Z-axis point-at target. */
  pointsAtZ?: OptionalProperty<number>;
  /** Specular reflection exponent. */
  specularExponent?: OptionalProperty<number>;
  /** Limiting cone angle. */
  limitingConeAngle?: OptionalProperty<number>;
}

/**
 * The `<feImage>` element — fetches an external image for use as a filter input.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feImage
 */
interface SVGFEImageElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
  /** CORS policy. */
  crossOrigin?: OptionalProperty<"anonymous" | "use-credentials">;
  /** Name for this filter primitive output. */
  result?: OptionalProperty<string>;
}

// --- Animation elements ---

/**
 * The `<animate>` element — animates a single attribute over time.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animate
 */
interface SVGAnimateElementProps extends SVGElementProps {
  /** Name of the attribute to animate. */
  attributeName?: OptionalProperty<string>;
  /** Type of attribute. */
  attributeType?: OptionalProperty<"CSS" | "XML" | "auto">;
  /** Starting value. */
  from?: OptionalProperty<string>;
  /** Ending value. */
  to?: OptionalProperty<string>;
  /** Duration of the animation. */
  dur?: OptionalProperty<string>;
  /** Number of repetitions. */
  repeatCount?: OptionalProperty<string | number>;
  /** Fill behavior after animation ends. */
  fill?: OptionalProperty<"freeze" | "remove">;
  /** Calculation mode for interpolation. */
  calcMode?: OptionalProperty<"discrete" | "linear" | "paced" | "spline">;
  /** Values for the animation. */
  values?: OptionalProperty<string>;
  /** Key times for the animation. */
  keyTimes?: OptionalProperty<string>;
  /** Key splines for the animation. */
  keySplines?: OptionalProperty<string>;
  /** When the animation begins. */
  begin?: OptionalProperty<string>;
  /** When the animation ends. */
  end?: OptionalProperty<string>;
  /** Minimum duration. */
  min?: OptionalProperty<string>;
  /** Maximum duration. */
  max?: OptionalProperty<string>;
  /** Restart behavior. */
  restart?: OptionalProperty<"always" | "whenNotActive" | "never">;
  /** Repeat duration. */
  repeatDur?: OptionalProperty<string>;
  /** Accumulation behavior. */
  accumulate?: OptionalProperty<"none" | "sum">;
  /** Additive behavior. */
  additive?: OptionalProperty<"replace" | "sum">;
}

/**
 * The `<animateMotion>` element — moves an element along a motion path.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateMotion
 */
interface SVGAnimateMotionElementProps extends SVGElementProps {
  /** Motion path data. */
  path?: OptionalProperty<string>;
  /** Key points along the path. */
  keyPoints?: OptionalProperty<string>;
  /** Rotation behavior. */
  rotate?: OptionalProperty<string | number>;
  /** Calculation mode for interpolation. */
  calcMode?: OptionalProperty<"discrete" | "linear" | "paced" | "spline">;
  /** Values for the animation. */
  values?: OptionalProperty<string>;
  /** Key times for the animation. */
  keyTimes?: OptionalProperty<string>;
  /** Key splines for the animation. */
  keySplines?: OptionalProperty<string>;
  /** When the animation begins. */
  begin?: OptionalProperty<string>;
  /** Duration of the animation. */
  dur?: OptionalProperty<string>;
  /** Number of repetitions. */
  repeatCount?: OptionalProperty<string | number>;
  /** Fill behavior after animation ends. */
  fill?: OptionalProperty<"freeze" | "remove">;
  /** Origin of motion. */
  origin?: OptionalProperty<"default">;
}

/**
 * The `<animateTransform>` element — animates a transformation attribute
 * (e.g. `transform`).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateTransform
 */
interface SVGAnimateTransformElementProps extends SVGElementProps {
  /** Name of the attribute to animate. */
  attributeName?: OptionalProperty<string>;
  /** Type of transform animation. */
  type?: OptionalProperty<"translate" | "scale" | "rotate" | "skewX" | "skewY">;
  /** Starting value. */
  from?: OptionalProperty<string>;
  /** Ending value. */
  to?: OptionalProperty<string>;
  /** Duration of the animation. */
  dur?: OptionalProperty<string>;
  /** Number of repetitions. */
  repeatCount?: OptionalProperty<string | number>;
  /** Fill behavior after animation ends. */
  fill?: OptionalProperty<"freeze" | "remove">;
  /** Calculation mode for interpolation. */
  calcMode?: OptionalProperty<"discrete" | "linear" | "paced" | "spline">;
  /** Values for the animation. */
  values?: OptionalProperty<string>;
  /** Key times for the animation. */
  keyTimes?: OptionalProperty<string>;
  /** Key splines for the animation. */
  keySplines?: OptionalProperty<string>;
  /** When the animation begins. */
  begin?: OptionalProperty<string>;
  /** When the animation ends. */
  end?: OptionalProperty<string>;
}

/**
 * The `<set>` element — sets an attribute value for a specified duration.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/set
 */
interface SVGSetElementProps extends SVGElementProps {
  /** Name of the attribute to animate. */
  attributeName?: OptionalProperty<string>;
  /** Ending value. */
  to?: OptionalProperty<string>;
  /** When the animation begins. */
  begin?: OptionalProperty<string>;
  /** Duration of the animation. */
  dur?: OptionalProperty<string>;
}

/**
 * The `<mpath>` element — references a `<path>` for use by `<animateMotion>`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mpath
 */
interface SVGMPathElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
}

// --- Hyperlink element ---

/**
 * The `<a>` element (SVG) — creates a hyperlink out of SVG graphical content.
 *
 * Note: The HTML `<a>` type (`HTMLAnchorElementProps`) is already mapped in
 * the HTML section. This type is **not** added to IntrinsicElements to avoid
 * ambiguity — use `HTMLAnchorElementProps` for `<a>` in both HTML and SVG
 * contexts.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/a
 */
interface SVGAElementProps extends SVGElementProps {
  /** Reference URL. */
  href?: OptionalProperty<string>;
  /** Browsing context for the link. */
  target?: OptionalProperty<string>;
  /** Relationship of the linked document. */
  rel?: OptionalProperty<string>;
  /** Prompts the user to download the URL. */
  download?: OptionalProperty<string>;
  /** Ping URLs for the link. */
  ping?: OptionalProperty<string>;
  /** Language of the linked document. */
  hreflang?: OptionalProperty<string>;
  /** MIME type of the linked document. */
  type?: OptionalProperty<string>;
  /** Referrer policy for the link. */
  referrerPolicy?: OptionalProperty<ReferrerPolicy>;
}

// --- Foreign object ---

/**
 * The `<foreignObject>` element — embeds non-SVG content (typically HTML)
 * inside SVG. Child elements exit SVG attribute context and use HTML types.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject
 */
interface SVGForeignObjectElementProps extends SVGElementProps {
  /** X-axis coordinate. */
  x?: OptionalProperty<string | number>;
  /** Y-axis coordinate. */
  y?: OptionalProperty<string | number>;
  /** Width of the element. */
  width?: OptionalProperty<string | number>;
  /** Height of the element. */
  height?: OptionalProperty<string | number>;
}

/**
 * The `<view>` element — defines a named viewport for zooming and panning.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/view
 */
interface SVGViewElementProps extends SVGElementProps {
  /** Viewport bounding box. */
  viewBox?: OptionalProperty<string>;
  /** Aspect ratio preservation strategy. */
  preserveAspectRatio?: OptionalProperty<string>;
  /** Zoom and pan behavior. */
  zoomAndPan?: OptionalProperty<"disable" | "magnify">;
}

// --- View element ---

/**
 * The `<view>` element — defines a named viewport for zooming and panning.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/view
 */
interface SVGViewElementProps extends SVGElementProps {
  viewBox?: OptionalProperty<string>;
  preserveAspectRatio?: OptionalProperty<string>;
  zoomAndPan?: OptionalProperty<"disable" | "magnify">;
}

/**
 * JSX intrinsic element types for SVG.
 *
 * The following SVG elements are intentionally excluded because their HTML
 * equivalents are already typed elsewhere:
 *   - `style`   → `HTMLStyleElementProps` (Section 4.2)
 *   - `script`  → UNSUPPORTED (Section 4.12)
 *   - `canvas`  → `HTMLCanvasElementProps` (Section 4.12)
 *
 * @see https://www.w3.org/TR/SVG2/eltindex.html
 */
export interface IntrinsicElements {
  // ── Container / structural ─────────────────────────────────────────────

  /** The `<svg>` element — SVG document root. */
  svg: SVGSVGElementProps;
  /** The `<g>` element — grouping container. */
  g: SVGElementProps;
  /** The `<defs>` element — container for definitions (not rendered directly). */
  defs: SVGElementProps;
  /** The `<symbol>` element — reusable graphical template. */
  symbol: SVGSymbolElementProps;
  /** The `<use>` element — instantiates a referenced element. */
  use: SVGUseElementProps;

  // ── Shapes ─────────────────────────────────────────────────────────────

  /** The `<circle>` element. */
  circle: SVGCircleElementProps;
  /** The `<ellipse>` element. */
  ellipse: SVGEllipseElementProps;
  /** The `<line>` element. */
  line: SVGLineElementProps;
  /** The `<path>` element. */
  path: SVGPathElementProps;
  /** The `<polygon>` element — closed shape from connected line segments. */
  polygon: SVGPolygonElementProps;
  /** The `<polyline>` element — open shape from connected line segments. */
  polyline: SVGPolylineElementProps;
  /** The `<rect>` element. */
  rect: SVGRectElementProps;

  // ── Text ───────────────────────────────────────────────────────────────

  /** The `<text>` element. */
  text: SVGTextElementProps;
  /** The `<tspan>` element — span of text within `<text>`. */
  tspan: SVGTSpanElementProps;
  /** The `<textPath>` element — text along a path. */
  textPath: SVGTextPathElementProps;

  // ── Image ──────────────────────────────────────────────────────────────

  /** The `<image>` element — embeds an external image. */
  image: SVGImageElementProps;

  // ── Clipping / masking ─────────────────────────────────────────────────

  /** The `<clipPath>` element — clipping path. */
  clipPath: SVGClipPathElementProps;
  /** The `<mask>` element — alpha mask. */
  mask: SVGMaskElementProps;

  // ── Gradients ──────────────────────────────────────────────────────────

  /** The `<linearGradient>` element. */
  linearGradient: SVGLinearGradientElementProps;
  /** The `<radialGradient>` element. */
  radialGradient: SVGRadialGradientElementProps;
  /** The `<stop>` element — gradient color stop. */
  stop: SVGStopElementProps;

  // ── Pattern / Marker ───────────────────────────────────────────────────

  /** The `<pattern>` element — tileable fill/stroke pattern. */
  pattern: SVGPatternElementProps;
  /** The `<marker>` element — arrowhead / vertex marker graphic. */
  marker: SVGMarkerElementProps;

  // ── Filters ────────────────────────────────────────────────────────────

  /** The `<filter>` element — filter effect container. */
  filter: SVGFilterElementProps;
  /** The `<feBlend>` element — blends two filter inputs. */
  feBlend: SVGFEBlendElementProps;
  /** The `<feColorMatrix>` element — color transformation. */
  feColorMatrix: SVGFEColorMatrixElementProps;
  /** The `<feComponentTransfer>` element — per-channel color remapping. */
  feComponentTransfer: SVGFEComponentTransferElementProps;
  /** The `<feComposite>` element — pixel-wise compositing. */
  feComposite: SVGFECompositeElementProps;
  /** The `<feConvolveMatrix>` element — matrix convolution. */
  feConvolveMatrix: SVGFEConvolveMatrixElementProps;
  /** The `<feDiffuseLighting>` element — diffuse Phong lighting. */
  feDiffuseLighting: SVGFEDiffuseLightingElementProps;
  /** The `<feDisplacementMap>` element — pixel displacement. */
  feDisplacementMap: SVGFEDisplacementMapElementProps;
  /** The `<feDistantLight>` element — distant light source. */
  feDistantLight: SVGFEDistantLightElementProps;
  /** The `<feDropShadow>` element — drop shadow effect. */
  feDropShadow: SVGFEDropShadowElementProps;
  /** The `<feFlood>` element — solid-color fill. */
  feFlood: SVGFEFloodElementProps;
  /** The `<feFuncA>` element — alpha transfer function. */
  feFuncA: SVGFEFuncAElementProps;
  /** The `<feFuncB>` element — blue transfer function. */
  feFuncB: SVGFEFuncBElementProps;
  /** The `<feFuncG>` element — green transfer function. */
  feFuncG: SVGFEFuncGElementProps;
  /** The `<feFuncR>` element — red transfer function. */
  feFuncR: SVGFEFuncRElementProps;
  /** The `<feGaussianBlur>` element — Gaussian blur. */
  feGaussianBlur: SVGFEGaussianBlurElementProps;
  /** The `<feImage>` element — external image input. */
  feImage: SVGFEImageElementProps;
  /** The `<feMerge>` element — stacks filter primitives. */
  feMerge: SVGFEMergeElementProps;
  /** The `<feMergeNode>` element — references a merge input. */
  feMergeNode: SVGFEMergeNodeElementProps;
  /** The `<feMorphology>` element — erode or dilate. */
  feMorphology: SVGFEMorphologyElementProps;
  /** The `<feOffset>` element — offsets the input. */
  feOffset: SVGFEOffsetElementProps;
  /** The `<fePointLight>` element — point light source. */
  fePointLight: SVGFEPointLightElementProps;
  /** The `<feSpecularLighting>` element — specular Phong lighting. */
  feSpecularLighting: SVGFESpecularLightingElementProps;
  /** The `<feSpotLight>` element — spot light source. */
  feSpotLight: SVGFESpotLightElementProps;
  /** The `<feTile>` element — tiles the input. */
  feTile: SVGFETileElementProps;
  /** The `<feTurbulence>` element — Perlin noise. */
  feTurbulence: SVGFETurbulenceElementProps;

  // ── Animation ──────────────────────────────────────────────────────────

  /** The `<animate>` element — animates an attribute. */
  animate: SVGAnimateElementProps;
  /** The `<animateMotion>` element — motion along a path. */
  animateMotion: SVGAnimateMotionElementProps;
  /** The `<animateTransform>` element — animates a transform attribute. */
  animateTransform: SVGAnimateTransformElementProps;
  /** The `<mpath>` element — motion path reference. */
  mpath: SVGMPathElementProps;
  /** The `<set>` element — sets an attribute for a duration. */
  set: SVGSetElementProps;

  // ── Foreign object ─────────────────────────────────────────────────────

  /** The `<foreignObject>` element — embeds non-SVG content. */
  foreignObject: SVGForeignObjectElementProps;

  // ── View ───────────────────────────────────────────────────────────────

  /** The `<view>` element — named viewport. */
  view: SVGViewElementProps;

  // ── Descriptive / metadata / conditional ───────────────────────────────

  /** The `<desc>` element — description (a11y). */
  desc: SVGElementProps;
  /** The `<metadata>` element — structured metadata. */
  metadata: SVGElementProps;
  /** The `<title>` element (SVG) — accessible name (distinct from HTML `<title>`). */
  title: SVGElementProps;
  /** The `<switch>` element — conditional rendering. */
  switch: SVGElementProps;

  // ── SVG 2 ──────────────────────────────────────────────────────────────

  /** The `<discard>` element — disposes of element resources. */
  discard: SVGElementProps;
}


