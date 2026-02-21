import { ErrorInfo } from "../context.js";
import { createMarkup as m } from "../markup.js";

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
  return m("div", {
    style: {
      backgroundColor: "#880000",
      color: "#fff",
      padding: "2rem",
      position: "fixed",
      inset: 0,
      fontSize: "20px",
    },
    children: [
      m("h1", { style: { marginBottom: "0.5rem" }, children: "The app has crashed" }),
      m("p", {
        style: { marginBottom: "0.25rem" },
        children: [
          m("span", {
            style: { fontFamily: "monospace" },
            children: props.info.source.name,
          }),
          m("span", {
            style: { fontFamily: "monospace", opacity: 0.5 },
            children: ` [id: ${props.info.source.id}]`,
          }),
          " says:",
        ],
      }),

      m("blockquote", {
        style: {
          backgroundColor: "#991111",
          padding: "0.25em",
          borderRadius: "6px",
          fontFamily: "monospace",
          marginBottom: "1rem",
        },
        children: [
          m("span", {
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
      m("p", { children: "Please see the browser console for details." }),

      m("p", {
        children: [
          m("pre", {
            children: m("code", {
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
