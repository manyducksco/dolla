import { cond, createMarkup } from "../markup.js";

type CrashPageProps = {
  message: string;
  error: Error;
  loggerName: string;
  uid?: string;
};

export function DefaultCrashPage(props: CrashPageProps) {
  return createMarkup(
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
    createMarkup("h1", { style: { marginBottom: "0.5rem" } }, "The app has crashed"),
    createMarkup(
      "p",
      { style: { marginBottom: "0.25rem" } },
      createMarkup("span", { style: { fontFamily: "monospace" } }, props.loggerName),
      cond(props.uid, createMarkup("span", { style: { fontFamily: "monospace" } }), [" ", "[uid: ", props.uid, "]"]),
      " says:",
    ),
    createMarkup(
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
      createMarkup(
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
      props.message,
    ),
    createMarkup("p", {}, "Please see the browser console for details."),
  );
}
