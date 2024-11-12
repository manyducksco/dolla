import { signal } from "../signals.js";
import { type StoreContext } from "../store.js";

type ScreenOrientation = "landscape" | "portrait";
type ColorScheme = "light" | "dark";

export function DocumentStore(ctx: StoreContext) {
  ctx.name = "dolla/document";

  const [$title, setTitle] = signal(document.title);
  const [$visibility, setVisibility] = signal(document.visibilityState);
  const [$orientation, setOrientation] = signal<ScreenOrientation>("landscape");
  const [$colorScheme, setColorScheme] = signal<ColorScheme>("light");

  /* ----- Title and Visibility ----- */

  ctx.watch([$title], (current) => {
    document.title = current;
  });

  const onVisibilityChange = () => {
    setVisibility(document.visibilityState);
  };

  const onFocus = () => {
    setVisibility("visible");
  };

  /* ----- Orientation ----- */

  const landscapeQuery = window.matchMedia("(orientation: landscape)");

  function onOrientationChange(e: MediaQueryList | MediaQueryListEvent) {
    setOrientation(e.matches ? "landscape" : "portrait");
  }

  // Read initial orientation.
  onOrientationChange(landscapeQuery);

  /* ----- Color Scheme ----- */

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function onColorChange(e: MediaQueryList | MediaQueryListEvent) {
    setColorScheme(e.matches ? "dark" : "light");
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
    $title,
    setTitle,

    $visibility,
    $orientation,
    $colorScheme,
  };
}
