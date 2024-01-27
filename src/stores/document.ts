import { $, $$ } from "../state.js";
import { type StoreContext } from "../store.js";

type ScreenOrientation = "landscape" | "portrait";
type ColorScheme = "light" | "dark";

export function DocumentStore(ctx: StoreContext) {
  ctx.name = "dolla/document";

  const $$title = $$(document.title);
  const $$visibility = $$(document.visibilityState);
  const $$orientation = $$<ScreenOrientation>("landscape");
  const $$colorScheme = $$<ColorScheme>("light");

  /* ----- Title and Visibility ----- */

  ctx.observe($$title, (current) => {
    document.title = current;
  });

  const onVisibilityChange = () => {
    $$visibility.set(document.visibilityState);
  };

  const onFocus = () => {
    $$visibility.set("visible");
  };

  /* ----- Orientation ----- */

  const landscapeQuery = window.matchMedia("(orientation: landscape)");

  function onOrientationChange(e: MediaQueryList | MediaQueryListEvent) {
    $$orientation.set(e.matches ? "landscape" : "portrait");
  }

  // Read initial orientation.
  onOrientationChange(landscapeQuery);

  /* ----- Color Scheme ----- */

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function onColorChange(e: MediaQueryList | MediaQueryListEvent) {
    $$colorScheme.set(e.matches ? "dark" : "light");
  }

  // Read initial color scheme.
  onColorChange(colorSchemeQuery);

  /* ----- Lifecycle ----- */

  // Listen for changes while connected.
  ctx.onConnected(function () {
    landscapeQuery.addEventListener("change", onOrientationChange);
    colorSchemeQuery.addEventListener("change", onColorChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
  });
  ctx.onDisconnected(function () {
    landscapeQuery.removeEventListener("change", onOrientationChange);
    colorSchemeQuery.removeEventListener("change", onColorChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", onFocus);
  });

  /* ----- Exports ----- */

  return {
    $$title,
    $visibility: $($$visibility),
    $orientation: $($$orientation),
    $colorScheme: $($$colorScheme),
  };
}
