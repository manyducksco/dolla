import type { Renderable } from "../../types.js";
import type { Context } from "../context.js";
import { onCleanup, onEffect } from "../context.js";
import { createAtom, type Getter } from "../signals.js";
import type { Markup } from "./types.js";
import { createMarkup } from "./utils.js";

type Easing = string | [number, number, number, number];

export type TransitionProps = {
  when: Getter<boolean>;
  enter?: Keyframe[] | PropertyIndexedKeyframes;
  exit?: Keyframe[] | PropertyIndexedKeyframes;
  duration?: number;
  easing?: Easing;
  enterDuration?: number;
  enterEasing?: Easing;
  exitDuration?: number;
  exitEasing?: Easing;
  children?: Renderable;
};

function resolveEasing(easing?: Easing): string | undefined {
  if (!easing) return undefined;
  if (Array.isArray(easing)) return `cubic-bezier(${easing.join(",")})`;
  return easing;
}

function TransitionView(this: Context, props: TransitionProps): Renderable {
  const [isMounted, setMounted] = createAtom(false);
  let wrapperEl: HTMLElement | null = null;
  let phase: "idle" | "entering" | "entered" | "exiting" = "idle";
  let pendingEnter = false;
  let anim: Animation | null = null;

  if (props.when()) {
    pendingEnter = true;
    setMounted(true);
  }

  function cancelAnim() {
    if (anim) {
      anim.cancel();
      anim = null;
    }
  }

  /** Plays `keyframes` on the wrapper, then calls `done`. With nothing to play it calls `done` right away. */
  function animate(
    keyframes: TransitionProps["enter"],
    duration: number | undefined,
    easing: Easing | undefined,
    done: (finished?: Animation) => void,
  ) {
    cancelAnim();
    if (!wrapperEl || !keyframes) return done();

    const current = wrapperEl.animate(keyframes, {
      duration: duration ?? props.duration,
      easing: resolveEasing(easing ?? props.easing),
      fill: "forwards",
    } as KeyframeAnimationOptions);
    anim = current;
    current.onfinish = () => {
      if (anim !== current) return;
      anim = null;
      done(current);
    };
  }

  function startEnter() {
    phase = "entering";
    animate(props.enter, props.enterDuration, props.enterEasing, (finished) => {
      phase = "entered";
      finished?.commitStyles();
      finished?.cancel();
    });
  }

  function startExit() {
    phase = "exiting";
    animate(props.exit, props.exitDuration, props.exitEasing, () => {
      phase = "idle";
      setMounted(false);
    });
  }

  onEffect(this, () => {
    if (props.when()) {
      if (phase === "exiting") {
        startEnter();
      } else if (!isMounted()) {
        setMounted(true);
        pendingEnter = true;
      }
    } else {
      if (phase === "entering" || phase === "entered") {
        startExit();
      } else if (pendingEnter) {
        // Shown and hidden again before the wrapper rendered; nothing to animate.
        pendingEnter = false;
        setMounted(false);
      }
    }
  });

  onCleanup(this, cancelAnim);

  return () => {
    if (isMounted()) {
      return createMarkup("div", {
        ref: (el: HTMLElement) => {
          wrapperEl = el;
          if (pendingEnter) {
            pendingEnter = false;
            startEnter();
          }
          return () => {
            wrapperEl = null;
          };
        },
        children: props.children,
      });
    }
    return null;
  };
}

export function transition(props: TransitionProps): Markup {
  return createMarkup(TransitionView, props);
}
