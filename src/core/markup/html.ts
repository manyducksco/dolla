// This file is a heavily modified version of the 'htm' library.
// Original source: https://github.com/developit/htm
//
// --- Original htm License ---
// Copyright 2018 Jason Miller
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { isArray, isNumber } from "../../utils.js";
import type { Markup } from "./types.js";
import { createMarkup } from "./utils.js";

export type Template = Markup | Markup[];

const enum Mode {
  Slash = 0,
  Text = 1,
  Whitespace = 2,
  TagName = 3,
  Comment = 4,
  PropSet = 5,
  PropAppend = 6,
}

/*
 * A template is parsed once, into a description of its markup with a
 * placeholder wherever a value is interpolated. Every call then only fills in
 * the values, which is many times faster than parsing the text again.
 */

/** The position of an interpolated value in the template, counted from 1. */
type Field = number;

/** A piece of a prop's value. `true` is the value of a prop written without one. */
type PropPart = string | Field | true;

/** Sets a prop from its name and the pieces of its value, or spreads a single field into the props. */
type PropOp = [name: string, ...parts: PropPart[]] | [spread: Field];

type ParsedElement = [type: string | Field, props: PropOp[] | null, children: ParsedNode[]];

/** Static text, an interpolated value, or an element. */
type ParsedNode = string | Field | ParsedElement;

const parsedTemplates = new WeakMap<TemplateStringsArray, ParsedNode[]>();

export function html(statics: TemplateStringsArray, ...args: any[]): Template {
  let roots = parsedTemplates.get(statics);
  if (!roots) parsedTemplates.set(statics, (roots = parse(statics)));

  return roots.length > 1 ? roots.map((root) => build(root, args)) : build(roots[0], args);
}

/** Creates the markup a parsed node describes, with `args` as the interpolated values. */
function build(node: ParsedNode, args: any[]): any {
  if (isNumber(node)) return args[node - 1];
  if (!isArray(node)) return node;

  const [type, ops, children] = node as ParsedElement;
  const props: Record<string, any> = {};

  if (ops) {
    for (const op of ops) {
      if (op.length === 1) {
        Object.assign(props, args[(op[0] as Field) - 1]);
      } else {
        // A value on its own keeps its type. Anything after it is joined on as text.
        let value: any = isNumber(op[1]) ? args[op[1] - 1] : op[1];
        for (let i = 2; i < op.length; i++) {
          const part = op[i];
          value += isNumber(part) ? "" + args[part - 1] : part;
        }
        props[op[0]] = value;
      }
    }
  }

  props.children = children.map((child) => build(child, args));

  return createMarkup(isNumber(type) ? args[type - 1] : type, props);
}

function parse(statics: TemplateStringsArray): ParsedNode[] {
  let mode = Mode.Text;
  let buffer = "";
  let quote = "";
  // The element being parsed, as [parent, type, props, ...children].
  let current: any[] = [0];
  let propName = "";
  // The prop whose value is being read.
  let prop: any[] = [];

  const commit = (field?: Field) => {
    if (mode === Mode.Text && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, "")))) {
      current.push(field || buffer);
    } else if (mode === Mode.TagName && (field || buffer)) {
      current[1] = field || buffer;
      mode = Mode.Whitespace;
    } else if (mode === Mode.Whitespace && buffer === "..." && field) {
      (current[2] ||= []).push([field]);
    } else if (mode === Mode.Whitespace && buffer && !field) {
      (current[2] ||= []).push([buffer, true]);
    } else if (mode >= Mode.PropSet) {
      if (mode === Mode.PropSet) {
        (current[2] ||= []).push((prop = [propName]));
        mode = Mode.PropAppend;
        // A prop always gets a value, even when that is an empty string.
        if (!field) {
          prop.push(buffer);
          buffer = "";
        }
      }
      if (buffer) prop.push(buffer);
      if (field) prop.push(field);
    }

    buffer = "";
  };

  for (let i = 0; i < statics.length; i++) {
    if (i) {
      if (mode === Mode.Text) commit();
      commit(i);
    }

    for (let j = 0; j < statics[i].length; j++) {
      const char = statics[i][j];

      if (mode === Mode.Text) {
        if (char === "<") {
          // commit buffer
          commit();
          current = [current, "", null];
          mode = Mode.TagName;
        } else {
          buffer += char;
        }
      } else if (mode === Mode.Comment) {
        // Ignore everything until the last three characters are '-', '-' and '>'
        if (buffer === "--" && char === ">") {
          mode = Mode.Text;
          buffer = "";
        } else {
          buffer = char + buffer[0];
        }
      } else if (quote) {
        if (char === quote) {
          quote = "";
        } else {
          buffer += char;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        commit();
        mode = Mode.Text;
      } else if (!mode) {
        // Ignore everything until the tag ends
      } else if (char === "=") {
        mode = Mode.PropSet;
        propName = buffer;
        buffer = "";
      } else if (char === "/" && (mode < Mode.PropSet || statics[i][j + 1] === ">")) {
        commit();
        if (mode === Mode.TagName) {
          current = current[0];
        }
        const node = current;
        current = current[0];

        current.push([node[1], node[2], node.slice(3)]);

        mode = Mode.Slash;
      } else if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        // <a disabled>
        commit();
        mode = Mode.Whitespace;
      } else {
        buffer += char;
      }

      if (mode === Mode.TagName && buffer === "!--") {
        mode = Mode.Comment;
        current = current[0];
      }
    }
  }
  commit();

  return current.slice(1);
}
