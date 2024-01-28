type EventListeners<E extends EventMap> = {
  [K in keyof E]?: EventCallback<E, K>[];
};

export type EventCallback<E extends EventMap, K extends keyof E> = (event: EmittedEvent<E, K>) => void;

/**
 * A map of event names and data values that their listener callbacks take.
 */
export interface EventMap {
  [name: string]: any;
}

/**
 * A hub for subscribing to and emitting events. A good pattern when you want to notify several parts of your app
 * at once when a condition changes in a central location. This is a similar pattern to Readable and Writable as far as
 * observability goes, but with the added ability to emit multiple event types each with their own separate listeners.
 */
export class EventEmitter<E extends EventMap = EventMap> {
  listeners: EventListeners<E> = {};

  /**
   * Emit an event.
   */
  emit<K extends keyof E>(name: K, data: E[K]) {
    if (this.listeners[name]) {
      for (const callback of this.listeners[name]!) {
        callback(new EmittedEvent<E, K>(data));
      }
    }
  }

  /**
   * Listen for an event. The callback will be called whenever that event is emitted.
   * Returns a function that will cancel this listener when called.
   */
  on<K extends keyof EventListeners<E>>(name: K, callback: EventCallback<E, K>) {
    if (!this.listeners[name]) {
      this.listeners[name] = [];
    }

    this.listeners[name]!.push(callback);

    return () => {
      this.off(name, callback);
    };
  }

  /**
   * Listen for the next emitted event. The callback will be called once the next time that event is emitted,
   * and then never again. Returns a function that will cancel this listener when called.
   */
  once<K extends keyof EventListeners<E>>(name: K, callback: EventCallback<E, K>) {
    const off = this.on(name, (event) => {
      callback(event);
      off();
    });

    return off;
  }

  /**
   * Cancel a listener by passing the callback that was originally used to register it.
   */
  off<K extends keyof EventListeners<E>>(name: K, callback: EventCallback<E, K>) {
    if (this.listeners[name]) {
      const index = this.listeners[name]!.indexOf(callback);
      this.listeners[name]!.splice(index, 1);
    }
  }
}

class EmittedEvent<E extends EventMap, K extends keyof E> {
  /**
   * Data object emitted with this event.
   */
  data: E[K];

  constructor(data: E[K]) {
    this.data = data;
  }
}
