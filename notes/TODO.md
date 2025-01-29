# TO DO LIST

- Combine/refactor very similar Group, Outlet and Observer nodes.
  - Group is simplest and exists to mount an array of MarkupElements as one.
  - Outlet is basically the same as Group but it expects a $children state with an array of MarkupElements.
  - Observer is a generic catch-all that works with a set of states and a render function. The render function can return any kind of Renderable which is then converted into a MarkupElement, but very similar update logic outside of that. Observer uses Group internally.
