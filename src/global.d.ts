import { createReactiveSystem } from "alien-signals";

declare interface Element {
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore
   */
  moveBefore?(movedNode: Element | CharacterData, referenceNode: Node | null): void;
}

declare module "alien-signals/system" {
  export const createReactiveSystem;
}
