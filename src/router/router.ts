// import { catchLinks } from "./router.utils";

// export interface Route {
//   /**
//    * The pattern (or pattern fragment in the case of nested routes) to match.
//    */
//   pattern: string;

//   /**
//    * Path to redirect to when this route is matched.
//    */
//   redirect?: string;

//   /**
//    * Subroutes.
//    */
//   routes?: Route[];

//   /**
//    * Called after the match is identified but before it is acted on. Use this to set state, load data, dynamically redirect, etc.
//    */
//   beforeMatch?: (ctx: BeforeMatchContext) => void | Promise<void>;

//   /**
//    * View function to call when this route is matched.
//    */
//   view?: () => any;
// }

// export interface Match<R extends Route> {
//   path: string;
//   pattern: string;
//   params: Record<string, unknown>;
//   query: Record<string, unknown>;
//   route: R;
//   layers: Array<{ id: number; route: R }>;
// }

// export interface BeforeMatchContext {
//   path: string;
//   pattern: string;
//   params: Record<string, unknown>;
//   query: Record<string, unknown>;
//   redirect: (to: string) => void;
// }

// export interface RouterOptions {
//   routes: Route[];

//   /**
//    * When true, the router will construct routes like "https://www.example.com/#/sub/route" which work without any backend intervention.
//    */
//   hash?: boolean;
// }

// interface RouterEvents<R extends Route> extends Record<string, RouterEvent> {
//   match: RouterMatchEvent<R>;
//   link: RouterLinkEvent;
//   error: RouterErrorEvent;
// }

// abstract class RouterEvent {
//   type: keyof RouterEvents<any> = "";
//   #defaultPrevented = false;

//   get defaultPrevented() {
//     return this.#defaultPrevented;
//   }

//   preventDefault() {
//     this.#defaultPrevented = true;
//   }
// }

// /**
//  * Emitted when the URL changes and a route is matched.
//  */
// class RouterMatchEvent<R extends Route> extends RouterEvent {
//   type = "match";
//   match;

//   constructor(match: Match<R>) {
//     super();
//     this.match = match;
//   }
// }

// /**
//  * Emitted when a link click is intercepted.
//  */
// class RouterLinkEvent extends RouterEvent {
//   type = "link";
//   element;

//   constructor(element: HTMLAnchorElement) {
//     super();
//     this.element = element;
//   }
// }

// /**
//  * Emitted when an error is thrown. If `event.preventDefault` is called the error will NOT be thrown.
//  */
// class RouterErrorEvent extends RouterEvent {
//   type = "error";
//   error;

//   constructor(error: Error) {
//     super();
//     this.error = error;
//   }
// }

// export class Router<R extends Route = Route> {
//   #rootElement?: Element;
//   #listeners = new Map<keyof RouterEvents<R>, Array<(event: RouterEvent) => void>>();
//   #cleanup: Array<() => void> = [];

//   constructor(options: RouterOptions) {
//     // TODO: Process routes.
//   }

//   /**
//    * Attach this router to a DOM element and listen for link clicks.
//    */
//   async attach(element: Element = document.body) {
//     this.detach();
//     this.#rootElement = element;

//     // Start catching link clicks within #rootElement.
//     this.#cleanup.push(
//       catchLinks(element, (anchor) => {
//         const event = new RouterLinkEvent(anchor);
//         this.#emit(event);

//         // Don't navigate if any handler has called `event.preventDefault()`
//         if (!event.defaultPrevented) {
//           const href = anchor.getAttribute("href");
//           if (href) {
//             this.push(href);
//           }
//         }
//       }),
//     );

//     // Listen for popstate events and update route accordingly.
//     const onPopState = () => {
//       this.#navigate();
//     };
//     window.addEventListener("popstate", onPopState);
//     this.#cleanup.push(() => window.removeEventListener("popstate", onPopState));

//     // Do initial navigation.
//     await this.#navigate();
//   }

//   /**
//    * Detach this router from its root element.
//    */
//   async detach() {
//     for (const callback of this.#cleanup) {
//       callback();
//     }
//     this.#cleanup.length = 0;

//     this.#rootElement = undefined;
//   }

//   on<E extends keyof RouterEvents<R>>(eventName: E, callback: (event: RouterEvents<R>[E]) => void) {
//     const listeners = this.#listeners.get(eventName) ?? [];
//     listeners.push(callback);
//     this.#listeners.set(eventName, listeners);
//     return () => {
//       const listeners = this.#listeners.get(eventName);
//       if (listeners?.length) {
//         listeners.splice(listeners.indexOf(callback), 1);
//       }
//     };
//   }

//   /**
//    * Navigate backward. Pass a number of steps to hit the back button that many times.
//    */
//   back(steps = 1) {
//     window.history.go(-steps);
//   }

//   /**
//    * Navigate forward. Pass a number of steps to hit the forward button that many times.
//    */
//   forward(steps = 1) {
//     window.history.go(steps);
//   }

//   push(path: string) {}

//   replace(path: string) {}

//   /**
//    * Matches a route and returns the `match` object, or `null` if no match was found.
//    */
//   async match(path: string): Match<R> {}

//   #emit(event: RouterEvent) {
//     const listeners = this.#listeners.get(event.type);
//     if (listeners?.length) {
//       for (const callback of listeners) {
//         callback(event);
//       }
//     }
//   }

//   async #navigate() {
//     // TODO: Get current path.
//     // const match = await this.match();
//     // const matchEvent = new RouterMatchEvent<R>();
//   }
// }
