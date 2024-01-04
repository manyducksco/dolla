/**
 * Creates a mock DOM node for testing.
 */
export function makeMockDOMNode() {
  const self = {
    isDOM: true,
    parentNode: null,
    insertBefore: jest.fn((child, sibling) => {
      const childIndex = self.children.indexOf(child);

      // Remove child if already there.
      if (childIndex > -1) {
        self.children.splice(childIndex, 1);
      }

      const siblingIndex = sibling ? self.children.indexOf(sibling) : -1;

      // Insert after sibling
      self.children.splice(siblingIndex, 0, child);

      child.parentNode = self;
    }),
    removeChild: jest.fn((child) => {
      const index = self.children.indexOf(child);

      if (index > -1) {
        self.children.splice(index, 1);
        child.parentNode = null;
      }
    }),
    children: [],
  };

  return self;
}
