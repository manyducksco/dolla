import { createApp, createRouter, html } from "./dist/core";

const router = createRouter({
  routes: [
    {
      path: "/a",
      view: () =>
        html`<p>Page A</p>
          <a href="/b">To B</a>`,
    },
    {
      path: "/a",
      view: () =>
        html`<p>Page B</p>
          <a href="/a">To A</a>`,
    },
    {
      path: "*",
      redirect: "/a",
    },
  ],
});

const app = createApp(router, {
  i18n: {},
});

app.mount(document.body);
