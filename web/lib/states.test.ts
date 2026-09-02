import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DataError } from "@/components/states/data-error";
import { EmptyState } from "@/components/states/empty-state";
import { PageSkeleton } from "@/components/states/page-skeleton";

test("state components render useful empty, error, retry, and loading content", () => {
  const emptyMarkup = renderToStaticMarkup(createElement(EmptyState, {
    title: "No projects",
    description: "Create one to begin.",
  }));
  const errorMarkup = renderToStaticMarkup(createElement(DataError, {
    message: "Could not load data.",
    onRetry: () => undefined,
  }));
  const skeletonMarkup = renderToStaticMarkup(createElement(PageSkeleton, { variant: "table" }));

  assert.match(emptyMarkup, /No projects/);
  assert.match(emptyMarkup, /Create one to begin/);
  assert.match(errorMarkup, /Could not load data/);
  assert.match(errorMarkup, /Retry/);
  assert.match(skeletonMarkup, /animate-pulse/);
});
