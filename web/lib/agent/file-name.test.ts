import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFileName } from "@/lib/agent/file-name";

test("normalizeFileName returns a trimmed lower-case basename for either path separator", () => {
  assert.equal(normalizeFileName(" C:\\Projects\\ABC_A_Block.DWG "), "abc_a_block.dwg");
  assert.equal(normalizeFileName("/projects/ABC_B_Block.dwg"), "abc_b_block.dwg");
});
