import { typeOf } from "../typeChecking.js";

// ----- Types ----- //

export enum SegmentType {
  Static,
  Variable,
}

export type StringTemplate = { segments: (StaticSegment | VariableSegment)[] };

/**
 * A string segment with literal text to be appended without processing.
 */
export type StaticSegment = {
  type: SegmentType.Static;
  text: string;
};

/**
 * A variable passed to the t() function. Needs to be formatted before it is appended.
 */
export type VariableSegment = {
  type: SegmentType.Variable;
  name: string;
  formats: Format[];
};

/**
 * A formatter to be applied to a variable.
 */
export type Format = {
  name: string;
  options: Record<string, any>;
};

// ----- Code ----- //

export function compile(strings: { [key: string]: any }, path: string[] = []): [string, StringTemplate][] {
  const entries: [string, StringTemplate][] = [];

  for (const key in strings) {
    switch (typeOf(strings[key])) {
      case "string":
        entries.push([[...path, key].join("."), parseTemplate(strings[key])]);
        break;
      case "object":
        entries.push(...compile(strings[key], [...path, key]));
        break;
      default:
        throw new Error(
          `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeOf(strings[key])}`,
        );
    }
  }

  return entries;
}

function parseTemplate(template: string): StringTemplate {
  // "{{itemName}} costs {{amount | number(style: currency, currency: USD)}}."

  enum Loc {
    /**
     * Outside value braces.
     */
    Static,
    /**
     * Inside value braces; currently parsing the name of the value. e.g. `{{ [name] | number(style: currency, currency: USD) }}`
     */
    ValueName,
    /**
     * Inside value braces; currently parsing the name of a format function. e.g. `{{ name | [number](style: currency, currency: USD) }}`
     */
    FormatName,
    /**
     * Inside value braces; currently parsing the name of a format option. e.g. `{{ name | number([style]: currency, currency: USD) }}`
     */
    FormatOptionName,
    /**
     * Inside value braces; currently parsing the value of a format option. e.g. `{{ name | number(style: [currency], currency: USD ) }}`
     */
    FormatOptionValue,
    /**
     * Inside value braces; just reached the closing bracket of a format option. e.g. `{{ name | number(style: [currency], currency: USD) [] }}`
     */
    FormatOptionEnd,
  }

  const parsed: StringTemplate = {
    segments: [],
  };

  let buffer = "";
  let i = 0;
  let loc: Loc = Loc.Static;
  let segment!: VariableSegment;
  let format!: VariableSegment["formats"][0];

  let formatOptionName!: string;

  const startSegment = () => {
    segment = {
      type: SegmentType.Variable,
      name: "",
      formats: [],
    };
  };

  const startFormat = () => {
    format = {
      name: "",
      options: {},
    };
  };

  while (i < template.length) {
    // Skip spaces (unless we're in static)
    if (loc !== Loc.Static && template[i] === " ") {
      i++;
      continue;
    }

    switch (loc) {
      case Loc.Static:
        if (template[i] === "{" && template[i + 1] === "{") {
          loc = Loc.ValueName;
          i += 2;
          // close static segment
          if (buffer.length > 0) {
            parsed.segments.push({ type: SegmentType.Static, text: buffer });
            buffer = "";
          }
          startSegment();
        } else {
          buffer += template[i];
          i++;
        }
        break;
      case Loc.ValueName:
        if (template[i] === "|") {
          loc = Loc.FormatName;
          i += 1;
          // add name to value segment
          segment.name = buffer;
          buffer = "";
          startFormat();
        } else if (template[i] === "}" && template[i + 1] === "}") {
          loc = Loc.Static;
          i += 2;
          // close value segment
          segment.name = buffer;
          buffer = "";
          parsed.segments.push(segment);
        } else {
          buffer += template[i];
          i++;
        }
        break;
      case Loc.FormatName:
        if (template[i] === "(") {
          loc = Loc.FormatOptionName;
          i += 1;
          // add name to format object
          format.name = buffer;
          buffer = "";
        } else if (template[i] === "}" && template[i + 1] === "}") {
          loc = Loc.Static;
          i += 2;
          // close format and value segment
          segment.formats.push(format);
          parsed.segments.push(segment);
        } else {
          buffer += template[i];
          i++;
        }
        break;
      case Loc.FormatOptionName:
        if (template[i] === ")") {
          // TODO: error - no value provided for option
        } else if (template[i] === ":") {
          loc = Loc.FormatOptionValue;
          i += 1;
          // add name to format option object
          formatOptionName = buffer;
          buffer = "";
        } else if (template[i] === "}" && template[i + 1] === "}") {
          // TODO: error - format options parenthesis not closed
        } else {
          buffer += template[i];
          i++;
        }
        break;
      case Loc.FormatOptionValue:
        if (template[i] === ")") {
          loc = Loc.FormatOptionEnd;
          i += 1;
          // add value to format option object
          // add format option to format object; we're done with this format
          format.options[formatOptionName] = buffer;
          buffer = "";
          segment.formats.push(format);
        } else if (template[i] === ",") {
          loc = Loc.FormatOptionName;
          i += 1;
          // add value to format option object
          // add format option to format object; we're adding another option
          format.options[formatOptionName] = buffer;
          buffer = "";
        } else if (template[i] === "}" && template[i + 1] === "}") {
          // TODO: error - format options parenthesis not closed
        } else {
          buffer += template[i];
          i++;
        }
        break;
      case Loc.FormatOptionEnd:
        if (template[i] === "|") {
          loc = Loc.FormatName;
          i += 1;
          startFormat();
        } else if (template[i] === "}" && template[i + 1] === "}") {
          loc = Loc.Static;
          i += 2;
          // add value segment
          parsed.segments.push(segment);
        } else {
          // TODO: error - no other valid characters
        }
        break;
    }
  }

  if (loc === Loc.Static && buffer.length > 0) {
    parsed.segments.push({ type: SegmentType.Static, text: buffer });
  }

  return parsed;
}
