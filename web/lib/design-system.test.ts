import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("root layout loads Inter and the global theme is light blue", () => {
  const layout = source("app/layout.tsx");
  const css = source("app/globals.css");

  assert.match(layout, /import \{ Inter \} from "next\/font\/google"/);
  assert.match(
    layout,
    /const inter = Inter\(\{[\s\S]*?variable: "--font-worklens-sans"/,
  );
  assert.match(
    layout,
    /className=\{`\$\{inter\.variable\} h-full antialiased`\}/,
  );
  assert.match(css, /--background: oklch\(0\.98/);
  assert.match(css, /--primary: oklch\(0\.546 0\.215 262/);
  assert.match(css, /--sidebar: oklch\(1 0 0\)/);
  assert.doesNotMatch(css, /\.dark \{/);
  assert.doesNotMatch(css, /--font-worklens-sans: Arial/);
});
