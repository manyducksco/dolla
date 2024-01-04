// ----- Types ----- //

interface ErrorContext {
  error: Error;
  severity: "error" | "crash";
  componentName: string;
}

interface CrashOptions {
  error: Error;
  componentName?: string;
}

type ErrorCallback = (ctx: ErrorContext) => void;

// ----- Code ----- //

/**
 * Receives errors that occur in components.
 */
export class CrashCollector {
  #errors: ErrorContext[] = [];
  #errorCallbacks: ErrorCallback[] = [];

  /**
   * Registers a callback to receive all errors that pass through the CrashCollector.
   * Returns a function that cancels this listener when called.
   */
  onError(callback: ErrorCallback) {
    this.#errorCallbacks.push(callback);

    return () => {
      this.#errorCallbacks.splice(this.#errorCallbacks.indexOf(callback), 1);
    };
  }

  /**
   * Reports an unrecoverable error that requires crashing the whole app.
   */
  crash({ error, componentName }: CrashOptions) {
    const ctx: ErrorContext = {
      error,
      severity: "crash",
      componentName: componentName ?? "anonymous component",
    };

    this.#errors.push(ctx);
    for (const callback of this.#errorCallbacks) {
      callback(ctx);
    }

    throw error; // Throws the error so developer can work with the stack trace in the console.
  }

  /**
   * Reports a recoverable error.
   */
  error({ error, componentName }: CrashOptions) {
    const ctx: ErrorContext = {
      error,
      severity: "error",
      componentName: componentName ?? "anonymous component",
    };

    this.#errors.push(ctx);
    for (const callback of this.#errorCallbacks) {
      callback(ctx);
    }
  }
}
