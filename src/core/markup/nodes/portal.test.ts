import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createMarkup } from "../utils.js";
import { PortalNode } from "./portal.js";

describe("PortalNode", () => {
  function setup() {
    const context = createContext(null);
    const logicalParent = document.createElement("div");
    const portalTarget = document.createElement("div");
    return { context, logicalParent, portalTarget };
  }

  describe("creation and lifecycle", () => {
    test("getRoot returns an anchor text node", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "hello", portalTarget);
      node.mount(logicalParent);
      expect(node.getRoot()).toBeInstanceOf(Text);
    });

    test("isMounted returns false before mount", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "hello", portalTarget);
      expect(node.isMounted()).toBe(false);
    });
  });

  describe("mount", () => {
    test("mounts anchor in logical parent", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "hello", portalTarget);
      node.mount(logicalParent);
      expect(logicalParent.contains(node.getRoot()!)).toBe(true);
    });

    test("renders content in portal target", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "world", portalTarget);
      node.mount(logicalParent);
      expect(portalTarget.textContent).toBe("world");
    });

    test("renders markup in portal target", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, createMarkup("span", { children: "portaled" }), portalTarget);
      node.mount(logicalParent);
      const span = portalTarget.querySelector("span");
      expect(span).not.toBeNull();
      expect(span!.textContent).toBe("portaled");
    });

    test("anchor is in logical parent, content is in portal target", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "separate", portalTarget);
      node.mount(logicalParent);
      expect(logicalParent.textContent).toBe(""); // anchor is invisible text
      expect(portalTarget.textContent).toBe("separate");
    });

    test("mount is idempotent", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "only once", portalTarget);
      node.mount(logicalParent);
      node.mount(logicalParent);
      expect(portalTarget.textContent).toBe("only once");
      expect(portalTarget.childNodes.length).toBe(1);
    });
  });

  describe("unmount", () => {
    test("unmount removes anchor from logical parent", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "remove", portalTarget);
      node.mount(logicalParent);
      expect(logicalParent.childNodes.length).toBe(1);
      node.unmount();
      expect(logicalParent.childNodes.length).toBe(0);
    });

    test("unmount removes content from portal target", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "gone", portalTarget);
      node.mount(logicalParent);
      expect(portalTarget.childNodes.length).toBe(1);
      node.unmount();
      expect(portalTarget.childNodes.length).toBe(0);
    });

    test("unmount with skipDOM leaves anchor but force-removes portal content", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "removed", portalTarget);
      node.mount(logicalParent);
      node.unmount(true);
      expect(logicalParent.childNodes.length).toBe(1); // anchor stays
      expect(portalTarget.textContent).toBe(""); // content is always force-removed
    });

    test("unmount resets isMounted to false", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "unmounted", portalTarget);
      node.mount(logicalParent);
      node.unmount();
      expect(node.isMounted()).toBe(false);
    });
  });

  describe("move", () => {
    test("move repositions anchor in logical parent", () => {
      const { context, logicalParent, portalTarget } = setup();
      const node = new PortalNode(context, "move me", portalTarget);
      node.mount(logicalParent);
      const sibling = document.createElement("div");
      logicalParent.appendChild(sibling);
      node.move(logicalParent, sibling);
      expect(node.getRoot()!.parentNode).toBe(logicalParent);
    });
  });
});
