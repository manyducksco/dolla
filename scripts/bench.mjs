import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost" });
const globals = [
  "window",
  "document",
  "CSSStyleSheet",
  "Node",
  "Text",
  "Element",
  "HTMLElement",
  "SVGElement",
  "DocumentFragment",
  "CustomEvent",
  "Event",
  "requestAnimationFrame",
  "cancelAnimationFrame",
];

for (const key of globals) {
  globalThis[key] = key === "window" ? window : key === "document" ? window.document : window[key];
}

const { createAtom, createRoot, css } = await import("../dist/index.js");
const { createMarkup, DynamicNode } = await import("../dist/internals.js");

const COUNT = Number(process.argv[2] ?? 800);
const ROUNDS = 5;

function reactivePage(count) {
  const [getValue] = createAtom("a");
  const children = [];

  for (let i = 0; i < count; i++) {
    children.push(
      createMarkup("div", {
        id: `item-${i}`,
        class: () => getValue(),
        style: { color: () => getValue() },
        children: () => getValue(),
      }),
    );
  }

  return () => createMarkup("div", { children });
}

function staticPage(count) {
  const children = [];

  for (let i = 0; i < count; i++) {
    children.push(
      createMarkup("div", {
        id: `item-${i}`,
        class: "item",
        style: "color: red; width: 10px",
        children: "text",
      }),
    );
  }

  return () => createMarkup("div", { children });
}

function styleObjectPage(count) {
  return () => {
    const children = [];
    for (let i = 0; i < count; i++) {
      children.push(
        createMarkup("div", {
          id: `item-${i}`,
          style: { color: "red", display: "flex", width: "10px" },
          children: "text",
        }),
      );
    }
    return createMarkup("div", { children });
  };
}

function inlineCssPage(count, dynamic) {
  const [getColor] = createAtom("red");

  return () => {
    const children = [];
    for (let i = 0; i < count; i++) {
      const template = dynamic
        ? css`
            color: ${() => getColor()};
            display: flex;
            padding: 0 16px;
          `
        : css`
            display: flex;
            align-items: center;
            overflow-x: auto;
            height: 57px;
            border-bottom: 1px solid var(--theme-border);
            justify-content: space-between;
            padding: 0 16px;
          `;
      children.push(createMarkup("div", { class: template }));
    }
    return createMarkup("div", { children });
  };
}

async function bestOf(label, fn) {
  let best = Infinity;

  for (let i = 0; i < ROUNDS; i++) {
    best = Math.min(best, await fn());
  }

  console.log(`${label.padEnd(28)} ${best.toFixed(1)}ms`);
}

async function measureMount(page) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const start = performance.now();
  const root = createRoot(container);
  await root.mount(page());

  const elapsed = performance.now() - start;
  root.unmount();
  container.remove();
  return elapsed;
}

await bestOf(`mount static x${COUNT}`, () => measureMount(staticPage(COUNT)));
await bestOf(`mount reactive x${COUNT}`, () => measureMount(reactivePage(COUNT)));
await bestOf(`style object x${COUNT}`, () => measureMount(styleObjectPage(COUNT)));
await bestOf(`inline css static x${COUNT}`, () => measureMount(inlineCssPage(COUNT, false)));
await bestOf(`inline css dynamic x${COUNT}`, () => measureMount(inlineCssPage(COUNT, true)));

// Approximate a router page swap: a DynamicNode slot is changed, which mounts
// the new page inside the next scheduler flush.
{
  const container = document.createElement("div");
  document.body.appendChild(container);

  const [getSlot, setSlot] = createAtom(null);
  const root = createRoot(container);
  await root.mount(() => createMarkup(DynamicNode, { args: [getSlot] }));

  const originalWarn = console.warn;
  console.warn = () => {};

  let best = Infinity;
  for (let i = 0; i < ROUNDS; i++) {
    const start = performance.now();
    setSlot(reactivePage(COUNT));
    await Promise.resolve();
    best = Math.min(best, performance.now() - start);
  }

  console.warn = originalWarn;
  root.unmount();
  container.remove();

  console.log(`${"swap router page".padEnd(28)} ${best.toFixed(1)}ms`);
}
