import { Ref } from "../core";

export function $event(target: EventTarget | Ref<EventTarget>, event: string, listener: () => void) {}
