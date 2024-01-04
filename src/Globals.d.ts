declare module "simple-color-hash" {
  type HashOptions = {
    str: string;
    sat?: { min: number; max: number };
    light?: { min: number; max: number };
  };

  export default function colorHash(options: HashOptions): string;
}

declare const global = any;
