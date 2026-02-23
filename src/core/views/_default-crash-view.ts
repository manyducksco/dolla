import { ErrorInfo } from "../context/context.js";
import { Markup } from "../markup/index.js";

/**
 * Props passed to the crash view when a crash occurs.
 */
export interface CrashViewProps {
  error: unknown;
  info: ErrorInfo;
}

/**
 * The crash view displayed unless you specify your own.
 */
export function DefaultCrashView(props: CrashViewProps) {
  return new Markup("div", {
    style: {
      backgroundColor: "#880000",
      color: "#fff",
      padding: "2rem",
      position: "fixed",
      inset: 0,
      fontSize: "20px",
    },
    children: [
      new Markup("h1", { style: { marginBottom: "0.5rem" }, children: "The app has crashed" }),
      new Markup("p", {
        style: { marginBottom: "0.25rem" },
        children: [
          new Markup("span", {
            style: { fontFamily: "monospace" },
            children: props.info.source.name,
          }),
          new Markup("span", {
            style: { fontFamily: "monospace", opacity: 0.5 },
            children: ` [id: ${props.info.source.id}]`,
          }),
          " says:",
        ],
      }),

      new Markup("blockquote", {
        style: {
          backgroundColor: "#991111",
          padding: "0.25em",
          borderRadius: "6px",
          fontFamily: "monospace",
          marginBottom: "1rem",
        },
        children: [
          new Markup("span", {
            style: {
              display: "inline-block",
              backgroundColor: "red",
              padding: "0.1em 0.4em",
              marginRight: "0.5em",
              borderRadius: "4px",
              fontSize: "0.9em",
              fontWeight: "bold",
            },
            children: getErrorName(props.error),
          }),
          getErrorMessage(props.error),
        ],
      }),
      new Markup("p", { children: "Please see the browser console for details." }),

      new Markup("p", {
        children: [
          new Markup("pre", {
            children: new Markup("code", {
              children: props.info.contextStack,
            }),
          }),
        ],
      }),
    ],
  });
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  } else {
    return "Error";
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  } else {
    return String(error);
  }
}
