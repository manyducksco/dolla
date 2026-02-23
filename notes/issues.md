# Known Issues

- Ordering of sibling repeat or dynamic nodes can get weird. Due to the empty comment marker system the nodes sometimes insert things at an unexpected spot.
- `<Boundary>` is so far untested.
- We are not using MarkupNode's `move` method for RepeatNode items.
