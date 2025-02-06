# Setting up Dolla

## Installation

Dolla is published on npm as `@manyducks.co/dolla`. You can install it in your project with the following command:

```
npm i @manyducks.co/dolla
```

## JSX

If you want to use JSX in your app you can add the following options to your `tsconfig.json` or `jsconfig.json`. Modern build systems like [Vite](https://vite.dev) will pick these up automatically.

```json
{
  "compilerOptions": {
    // ... other options ...
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```
