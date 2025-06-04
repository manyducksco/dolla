import { when, markup as m } from "../markup.js";

/**
 * Props passed to the crash view when a crash occurs.
 */
export type CrashViewProps = {
  /**
   * JavaScript Error object.
   */
  error: Error;

  /**
   * A string to identify the logger that reported this error.
   */
  loggerName: string;

  /**
   * Unique identifier to pinpoint the specific view that reported the crash.
   */
  tag?: string;

  /**
   * Label for the tag.
   */
  tagName?: string;
};

export function DefaultCrashView(props: CrashViewProps) {
  return m(
    "div",
    {
      style: {
        backgroundColor: "#880000",
        color: "#fff",
        padding: "2rem",
        position: "fixed",
        inset: 0,
        fontSize: "20px",
      },
    },
    m("h1", { style: { marginBottom: "0.5rem" } }, "The app has crashed"),
    m(
      "p",
      { style: { marginBottom: "0.25rem" } },
      m("span", { style: { fontFamily: "monospace" } }, props.loggerName),
      when(
        props.tag,
        m(
          "span",
          { style: { fontFamily: "monospace", opacity: 0.5 } },
          ` [${props.tagName ? `${props.tagName}: ` : ""}${props.tag}]`,
        ),
      ),
      " says:",
    ),
    m(
      "blockquote",
      {
        style: {
          backgroundColor: "#991111",
          padding: "0.25em",
          borderRadius: "6px",
          fontFamily: "monospace",
          marginBottom: "1rem",
        },
      },
      m(
        "span",
        {
          style: {
            display: "inline-block",
            backgroundColor: "red",
            padding: "0.1em 0.4em",
            marginRight: "0.5em",
            borderRadius: "4px",
            fontSize: "0.9em",
            fontWeight: "bold",
          },
        },
        props.error.name,
      ),
      props.error.message,
    ),
    m("p", {}, "Please see the browser console for details."),
  );
}
