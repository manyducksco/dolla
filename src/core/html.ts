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

import { createMarkup } from "./markup.js";

const MODE_SLASH = 0;
const MODE_TEXT = 1;
const MODE_WHITESPACE = 2;
const MODE_TAGNAME = 3;
const MODE_COMMENT = 4;
const MODE_PROP_SET = 5;
const MODE_PROP_APPEND = 6;

export function html(statics: TemplateStringsArray, ...args: any[]): any {
  const fields = [statics, ...args];

  let mode = MODE_TEXT;
  let buffer = "";
  let quote = "";
  let current: any[] = [0];
  let propName = "";

  const commit = (field?: number) => {
    if (mode === MODE_TEXT && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, "")))) {
      current.push(field ? fields[field] : buffer);
    } else if (mode === MODE_TAGNAME && (field || buffer)) {
      current[1] = field ? fields[field] : buffer;
      mode = MODE_WHITESPACE;
    } else if (mode === MODE_WHITESPACE && buffer === "..." && field) {
      current[2] = Object.assign(current[2] || {}, fields[field]);
    } else if (mode === MODE_WHITESPACE && buffer && !field) {
      (current[2] = current[2] || {})[buffer] = true;
    } else if (mode >= MODE_PROP_SET) {
      if (mode === MODE_PROP_SET) {
        (current[2] = current[2] || {})[propName] = field ? (buffer ? buffer + fields[field] : fields[field]) : buffer;
        mode = MODE_PROP_APPEND;
      } else if (field || buffer) {
        current[2][propName] += field ? buffer + fields[field] : buffer;
      }
    }

    buffer = "";
  };

  for (let i = 0; i < statics.length; i++) {
    if (i) {
      if (mode === MODE_TEXT) commit();
      commit(i);
    }

    for (let j = 0; j < statics[i].length; j++) {
      const char = statics[i][j];

      if (mode === MODE_TEXT) {
        if (char === "<") {
          // commit buffer
          commit();
          current = [current, "", null];
          mode = MODE_TAGNAME;
        } else {
          buffer += char;
        }
      } else if (mode === MODE_COMMENT) {
        // Ignore everything until the last three characters are '-', '-' and '>'
        if (buffer === "--" && char === ">") {
          mode = MODE_TEXT;
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
        mode = MODE_TEXT;
      } else if (!mode) {
        // Ignore everything until the tag ends
      } else if (char === "=") {
        mode = MODE_PROP_SET;
        propName = buffer;
        buffer = "";
      } else if (char === "/" && (mode < MODE_PROP_SET || statics[i][j + 1] === ">")) {
        commit();
        if (mode === MODE_TAGNAME) {
          current = current[0];
        }
        const node = current;
        current = current[0];

        const type = node[1];
        const props = node[2] || {};
        const children = node.slice(3);

        current.push(createMarkup(type, { ...props, children }));

        mode = MODE_SLASH;
      } else if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        // <a disabled>
        commit();
        mode = MODE_WHITESPACE;
      } else {
        buffer += char;
      }

      if (mode === MODE_TAGNAME && buffer === "!--") {
        mode = MODE_COMMENT;
        current = current[0];
      }
    }
  }
  commit();

  return current.length > 2 ? current.slice(1) : current[1];
}
