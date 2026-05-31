declare interface Element {
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore
   */
  moveBefore?(node: Node, child: Node | null): void;
}

/* Vite HMR types */
interface ImportMeta {
  readonly hot?: {
    readonly data: Record<string, any>;
    accept(): void;
    accept(cb: (mod: Record<string, any>) => void): void;
    accept(dep: string, cb: (mod: Record<string, any>) => void): void;
    accept(deps: string[], cb: (mods: Record<string, any>[]) => void): void;
    dispose(cb: () => void): void;
    invalidate(): void;
    on(event: string, cb: (...args: any[]) => void): void;
  };
}
