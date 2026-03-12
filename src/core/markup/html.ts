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

export function html(statics: TemplateStringsArray, ...args: any[]): Template {
  const fields = [statics, ...args];

  let mode = Mode.Text;
  let buffer = "";
  let quote = "";
  let current: any[] = [0];
  let propName = "";

  const commit = (field?: number) => {
    if (mode === Mode.Text && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, "")))) {
      current.push(field ? fields[field] : buffer);
    } else if (mode === Mode.TagName && (field || buffer)) {
      current[1] = field ? fields[field] : buffer;
      mode = Mode.Whitespace;
    } else if (mode === Mode.Whitespace && buffer === "..." && field) {
      current[2] = Object.assign(current[2] || {}, fields[field]);
    } else if (mode === Mode.Whitespace && buffer && !field) {
      (current[2] = current[2] || {})[buffer] = true;
    } else if (mode >= Mode.PropSet) {
      if (mode === Mode.PropSet) {
        (current[2] = current[2] || {})[propName] = field ? (buffer ? buffer + fields[field] : fields[field]) : buffer;
        mode = Mode.PropAppend;
      } else if (field || buffer) {
        current[2][propName] += field ? buffer + fields[field] : buffer;
      }
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

        const type = node[1];
        const props = node[2] || {};
        const children = node.slice(3);

        current.push(createMarkup(type, { ...props, children }));

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

  return current.length > 2 ? current.slice(1) : current[1];
}
