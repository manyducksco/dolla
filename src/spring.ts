import { OBSERVE, readable, unwrap, writable, type Readable, type Writable } from "./state.js";

export interface SpringParameters {
  /**
   * How heavy the spring is.
   */
  mass: number | Readable<number>;

  /**
   * Amount of stiffness or tension in the spring.
   */
  stiffness: number | Readable<number>;

  /**
   * Amount of smoothing. Affects the speed of transitions.
   */
  damping: number | Readable<number>;

  /**
   * How much force the spring's motion begins with.
   */
  velocity: number | Readable<number>;
}

interface SpringOptions extends Partial<SpringParameters> {
  /**
   * Difference in average amplitude across the last several frames before the animation is considered done.
   * The exact number of frames to average is specified by `endWindow`.
   */
  endAmplitude?: number | Readable<number>;

  /**
   * Specifies the number of frames across which to measure the average amplitude to determine when the animation is considered done.
   * The maximum amplitude is specified by `endAmplitude`.
   */
  endWindow?: number | Readable<number>;
}

export interface Spring extends Writable<number> {
  /**
   * Takes a new value and animates to it. Returns a promise that resolves when the animation ends.
   * Optionally takes a set of override spring options to animate with.
   */
  animateTo(newValue: number, options?: SpringOptions): Promise<void>;
}

export function spring(initialValue: number, options?: SpringOptions): Spring {
  const mass = options?.mass ?? 2;
  const stiffness = options?.stiffness ?? 1200;
  const damping = options?.damping ?? 160;
  const velocity = options?.velocity ?? 5;
  const endAmplitude = options?.endAmplitude ?? 0.001;
  const endWindow = options?.endWindow ?? 20;

  const $$currentValue = writable(initialValue);

  let nextId = 0;
  let currentAnimationId: number | undefined;

  const snapTo = (newValue: number) => {
    currentAnimationId = undefined;
    $$currentValue.set(newValue);
  };

  const animateTo = async (endValue: number, options?: SpringOptions) => {
    // Act like snap if user prefers reduced motion.
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return snapTo(endValue);
    }

    const _endAmplitude = readable(options?.endAmplitude ?? endAmplitude).get();
    const _endWindow = readable(options?.endWindow ?? endWindow).get();

    return new Promise<void>((resolve) => {
      const id = nextId++;
      const amplitude = makeAmplitudeMeasurer(_endWindow);

      const springParams = {
        mass: options?.mass ?? mass,
        stiffness: options?.stiffness ?? stiffness,
        damping: options?.damping ?? damping,
        velocity: options?.velocity ?? velocity,
      };
      const startTime = Date.now();
      const startValue = $$currentValue.get();

      const step = () => {
        if (currentAnimationId !== id) {
          resolve();
          return;
        }

        const elapsedTime = Date.now() - startTime;
        const proportion = solve(springParams, elapsedTime / 1000);

        $$currentValue.set(startValue + (endValue - startValue) * proportion);

        // End animation when amplitude falls below threshold.
        amplitude.sample(proportion);
        if (amplitude.value && amplitude.value < _endAmplitude) {
          currentAnimationId = undefined;
          $$currentValue.set(endValue);
        }

        window.requestAnimationFrame(step);
      };

      currentAnimationId = id;
      window.requestAnimationFrame(step);
    });
  };

  return {
    get: $$currentValue.get,
    set: snapTo,
    update: (callback) => {
      const newValue = callback($$currentValue.get());
      snapTo(newValue);
    },

    [OBSERVE]: $$currentValue[OBSERVE],

    animateTo,
  };
}

function solve(parameters: SpringParameters, elapsedSeconds: number) {
  const mass = unwrap(parameters.mass);
  const stiffness = unwrap(parameters.stiffness);
  const damping = unwrap(parameters.damping);
  const initialVelocity = unwrap(parameters.velocity);

  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const speed = Math.sqrt(stiffness / mass);

  let B: number;
  let position: number;

  if (dampingRatio < 1) {
    const dampedSpeed = speed * Math.sqrt(1 - dampingRatio * dampingRatio);
    B = (dampingRatio * speed + -initialVelocity) / dampedSpeed;

    position =
      (Math.cos(dampedSpeed * elapsedSeconds) + B * Math.sin(dampedSpeed * elapsedSeconds)) *
      Math.exp(-elapsedSeconds * speed * dampingRatio);
  } else {
    B = speed + -initialVelocity;

    position = (1 + B * elapsedSeconds) * Math.exp(-elapsedSeconds * speed);
  }

  return 1 - position;
}

function makeAmplitudeMeasurer(resolution: number) {
  const samples: number[] = [];

  return {
    sample(value: number) {
      samples.push(value);

      while (samples.length > resolution) {
        samples.shift();
      }
    },

    get value() {
      if (samples.length < resolution) {
        return null;
      }

      return Math.max(...samples) - Math.min(...samples);
    },
  };
}
