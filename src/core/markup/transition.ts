import type { Renderable, View } from "../../types.js";
import { createMarkup } from "./utils.js";
import { createAtom, type Getter } from "../signals.js";
import { onCleanup, onEffect } from "../context.js";
import { html } from "./html.js";
import type { Context } from "../context.js";
import type { Markup } from "./types.js";

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

function resolveOptions(
  shared: { duration?: number; easing?: Easing },
  phase: { duration?: number; easing?: Easing },
): KeyframeAnimationOptions {
  return {
    duration: phase.duration ?? shared.duration,
    easing: resolveEasing(phase.easing ?? shared.easing),
    fill: "forwards",
  } as KeyframeAnimationOptions;
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

  function startEnter() {
    phase = "entering";
    if (!wrapperEl || !props.enter) {
      phase = "entered";
      return;
    }
    cancelAnim();
    anim = wrapperEl.animate(
      props.enter,
      resolveOptions(
        { duration: props.duration, easing: props.easing },
        { duration: props.enterDuration, easing: props.enterEasing },
      ),
    );
    anim.onfinish = () => {
      if (phase === "entering") {
        phase = "entered";
        anim?.commitStyles();
        anim?.cancel();
        anim = null;
      }
    };
  }

  function startExit() {
    phase = "exiting";
    if (!wrapperEl || !props.exit) {
      phase = "idle";
      setMounted(false);
      return;
    }
    cancelAnim();
    anim = wrapperEl.animate(
      props.exit,
      resolveOptions(
        { duration: props.duration, easing: props.easing },
        { duration: props.exitDuration, easing: props.exitEasing },
      ),
    );
    anim.onfinish = () => {
      if (phase === "exiting") {
        phase = "idle";
        anim = null;
        setMounted(false);
      }
    };
  }

  onEffect(this, () => {
    if (props.when()) {
      if (phase === "exiting") {
        cancelAnim();
        startEnter();
      } else if (!isMounted()) {
        setMounted(true);
        pendingEnter = true;
      }
    } else {
      if (phase === "entering" || phase === "entered") {
        cancelAnim();
        startExit();
      }
    }
  });

  onCleanup(this, () => {
    cancelAnim();
  });

  return () => {
    if (isMounted()) {
      return html`
        <div
          ref=${(el: HTMLElement) => {
            wrapperEl = el;
            if (pendingEnter) {
              pendingEnter = false;
              startEnter();
            }
          }}
        >
          ${props.children}
        </div>
      `;
    }
    return null;
  };
}

export function transition(props: TransitionProps): Markup {
  return createMarkup(TransitionView as View<TransitionProps>, props);
}
