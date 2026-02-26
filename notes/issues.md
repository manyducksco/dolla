# Known Issues

- Ordering of sibling repeat or dynamic nodes can get weird. Due to the empty comment marker system the nodes sometimes insert things at an unexpected spot.
- `<Boundary>` is so far untested.
- We are not using MarkupNode's `move` method for RepeatNode items.
- ElementNode props/styles/events could probably be much nicer.

## Needs

- Virtualization (lists/grids); should be able to make an infinite scrolling chat app as well as Morganizer in it with 60fps performance

## Nice to haves (for adoption; not necessarily for me)

- Works with Storybook
- Supports server side rendering
