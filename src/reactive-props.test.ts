import { expectTypeOf, test } from "vitest";
import { createAtom, unwrap, type Getter, type ReactiveProps } from "./core/index.js";

test("ReactiveProps makes plain values maybe-getters", () => {
  type Props = {
    name: string;
    count?: number;
    onSave: (value: string) => void;
    id: string;
    explicit: Getter<string>;
  };

  type Reactive = ReactiveProps<Props, "id">;

  expectTypeOf<Reactive["name"]>().toEqualTypeOf<string | Getter<string>>();
  expectTypeOf<Reactive["count"]>().toEqualTypeOf<number | Getter<number | undefined> | undefined>();
  expectTypeOf<Reactive["onSave"]>().toEqualTypeOf<(value: string) => void>();
  expectTypeOf<Reactive["id"]>().toEqualTypeOf<string>();
  expectTypeOf<Reactive["explicit"]>().toEqualTypeOf<Getter<string>>();
});

test("ReactiveProps accepts plain and getter props", () => {
  type Props = {
    name: string;
    onSave: (value: string) => void;
    id: string;
    explicit: Getter<string>;
  };

  type Reactive = ReactiveProps<Props, "id">;

  const [getName] = createAtom("Alice");

  const plain: Reactive = {
    name: "Alice",
    onSave: () => {},
    id: "x",
    explicit: () => "x",
  };

  const getter: Reactive = {
    name: getName,
    onSave: () => {},
    id: "x",
    explicit: () => "x",
  };

  expectTypeOf(unwrap(getter.name)).toEqualTypeOf<string>();
  expectTypeOf(unwrap(plain.name)).toEqualTypeOf<string>();
});
