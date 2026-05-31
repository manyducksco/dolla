import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { createContext } from "../context.js";
import { createAtom } from "../signals.js";
import { flushPendingUpdates } from "./scheduler.js";
import { render } from "./utils.js";
import { transition } from "./transition.js";
import { html } from "./html.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

function createMockAnim() {
  let _onfinish: (() => void) | null = null;
  return {
    get onfinish() {
      return _onfinish;
    },
    set onfinish(fn: (() => void) | null) {
      _onfinish = fn;
    },
    cancel: vi.fn(),
    commitStyles: vi.fn(),
    triggerFinish() {
      _onfinish?.();
    },
  };
}

let mockAnim: ReturnType<typeof createMockAnim>;
let animateSpy: any;

beforeEach(() => {
  mockAnim = createMockAnim() as any;
  if (!Element.prototype.animate) {
    (Element.prototype as any).animate = () => mockAnim;
  }
  animateSpy = vi.spyOn(Element.prototype as any, "animate").mockReturnValue(mockAnim as any);
});

afterEach(() => {
  animateSpy?.mockRestore();
});

describe("transition", () => {
  test("shows content when when() is true (no keyframes)", () => {
    const { context, container } = setup();
    const [show] = createAtom(true);
    const markup = transition({
      when: show,
      children: html`<span>hello</span>`,
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.textContent).toBe("hello");
    expect(animateSpy).not.toHaveBeenCalled();
  });

  test("hides content when when() is false (no keyframes)", () => {
    const { context, container } = setup();
    const [show] = createAtom(false);
    const markup = transition({
      when: show,
      children: html`<span>hello</span>`,
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    expect(container.firstElementChild).toBeNull();
  });

  test("toggles content on signal change (no keyframes)", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(true);
    const markup = transition({
      when: show,
      children: "content",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    expect(container.textContent).toBe("content");

    setShow(false);
    flushPendingUpdates();
    expect(container.textContent).toBe("");

    setShow(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("content");
  });

  test("calls animate with enter keyframes on show", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const enterKF = { opacity: [0, 1] };
    const markup = transition({
      when: show,
      enter: enterKF,
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    setShow(true);
    flushPendingUpdates();

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(animateSpy).toHaveBeenCalledWith(enterKF, expect.objectContaining({ fill: "forwards" }));
  });

  test("calls animate with exit keyframes on hide", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(true);
    const exitKF = { opacity: [1, 0] };
    const markup = transition({
      when: show,
      exit: exitKF,
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    // Complete enter (no enter keyframes, so immediate)
    // Now flip to start exit
    setShow(false);
    flushPendingUpdates();

    expect(animateSpy).toHaveBeenCalledWith(exitKF, expect.objectContaining({ fill: "forwards" }));
  });

  test("commitStyles called after enter animation finishes", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const markup = transition({
      when: show,
      enter: { opacity: [0, 1] },
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    setShow(true);
    flushPendingUpdates();
    expect(animateSpy).toHaveBeenCalledTimes(1);

    // Simulate animation completion
    mockAnim.triggerFinish();
    flushPendingUpdates();

    expect(mockAnim.commitStyles).toHaveBeenCalled();
    expect(mockAnim.cancel).toHaveBeenCalled();
  });

  test("wrapper removed after exit animation finishes", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(true);
    const markup = transition({
      when: show,
      exit: { opacity: [1, 0] },
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    // Enter completes immediately (no enter keyframes)
    setShow(false);
    flushPendingUpdates();

    expect(container.firstElementChild).not.toBeNull();

    // Simulate exit animation completion
    mockAnim.triggerFinish();
    flushPendingUpdates();

    expect(container.firstElementChild).toBeNull();
  });

  test("override: when flips during exit starts entering", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(true);
    const enterKF = { opacity: [0, 1] };
    const exitKF = { opacity: [1, 0] };
    const markup = transition({
      when: show,
      enter: enterKF,
      exit: exitKF,
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    // Enter completes immediately (no enter keyframes) — wait, we DO have enter keyframes
    // So we need to trigger finish to reach 'entered' first
    // Actually, let me re-check: mount with show=true → pendingEnter=true → startEnter called in ref callback
    flushPendingUpdates();
    mockAnim.triggerFinish();

    // Now start exit
    setShow(false);
    flushPendingUpdates();

    // Override: switch back to enter while still exiting
    setShow(true);
    flushPendingUpdates();

    expect(mockAnim.cancel).toHaveBeenCalled();
    // Should have called animate with enter keyframes
    expect(animateSpy).toHaveBeenLastCalledWith(enterKF, expect.anything());
  });

  test("override: when flips during enter starts exiting", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const enterKF = { opacity: [0, 1] };
    const exitKF = { opacity: [1, 0] };
    const markup = transition({
      when: show,
      enter: enterKF,
      exit: exitKF,
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    // Start enter (still animating)
    setShow(true);
    flushPendingUpdates();

    // Override: switch to exit while still entering
    setShow(false);
    flushPendingUpdates();

    expect(mockAnim.cancel).toHaveBeenCalled();
    expect(animateSpy).toHaveBeenLastCalledWith(exitKF, expect.anything());
  });

  test("enterDuration overrides shared duration", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const markup = transition({
      when: show,
      enter: { opacity: [0, 1] },
      duration: 200,
      enterDuration: 400,
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    setShow(true);
    flushPendingUpdates();

    expect(animateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 400 }),
    );
  });

  test("easing tuple converted to cubic-bezier string", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const markup = transition({
      when: show,
      enter: { opacity: [0, 1] },
      easing: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    setShow(true);
    flushPendingUpdates();

    expect(animateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ easing: "cubic-bezier(0.25,0.1,0.25,1)" }),
    );
  });

  test("cleanup cancels running animation", () => {
    const { context, container } = setup();
    const [show, setShow] = createAtom(false);
    const markup = transition({
      when: show,
      enter: { opacity: [0, 1] },
      children: "hello",
    });
    const node = render(markup, context);
    node.mount(container);
    flushPendingUpdates();

    setShow(true);
    flushPendingUpdates();

    // Unmount while entering
    node.unmount();

    expect(mockAnim.cancel).toHaveBeenCalled();
  });
});
