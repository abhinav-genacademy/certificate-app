/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const filename = path.join(
  __dirname,
  "../app/admin/cohorts/[id]/_components/GenerateButton.tsx",
);
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

// Preserve hook state between renders, as router.refresh() does for this client
// component, while allowing server props and HTTP responses to change separately.
function createButton(pendingCount) {
  const state = [];
  const requests = [];
  let hookIndex = 0;
  let refreshCount = 0;
  let props = { cohortId: "cohort-1", pendingCount };
  const loadedModule = { exports: {} };
  const useState = (initial) => {
    const index = hookIndex++;
    if (index === state.length) state.push(initial);
    return [state[index], (value) => { state[index] = value; }];
  };
  const mockRequire = (name) => {
    if (name === "react") return { useState };
    if (name === "next/navigation") {
      return { useRouter: () => ({ refresh: () => { refreshCount++; } }) };
    }
    if (name === "react/jsx-runtime") return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const fetch = (url, options) => new Promise((resolve) => {
    requests.push({
      url,
      options,
      respond: (data, ok = true) => resolve({ ok, json: async () => data }),
    });
  });
  new Function("require", "module", "exports", "fetch", compiled)(
    mockRequire, loadedModule, loadedModule.exports, fetch,
  );
  return {
    requests,
    get refreshCount() { return refreshCount; },
    render(nextPendingCount = props.pendingCount) {
      props = { ...props, pendingCount: nextPendingCount };
      hookIndex = 0;
      return loadedModule.exports.GenerateButton(props);
    },
  };
}

function button(tree) {
  assert.equal(tree.type, "div");
  const result = tree.props.children.find((child) => child?.type === "button");
  assert.ok(result);
  return result;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("adding a roster to an initially empty cohort starts generation", async () => {
  const ui = createButton(0);
  assert.equal(ui.render().props.children, "All certificates issued");

  const action = button(ui.render(2));
  assert.equal(action.props.children, "Generate 2 certificate(s)");
  const run = action.props.onClick();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, "/api/admin/cohorts/cohort-1/generate");
  assert.equal(ui.requests[0].options.method, "POST");
  assert.equal(button(ui.render()).props.children, "Generating... (2 left)");
  ui.requests[0].respond({ remainingPending: 0 });
  await run;
  assert.equal(ui.refreshCount, 1);
  assert.equal(ui.render(0).props.children, "All certificates issued");
});

test("a subsequent run uses the refreshed count after the prior run reaches zero", async () => {
  const ui = createButton(1);
  const firstRun = button(ui.render()).props.onClick();
  ui.requests[0].respond({ remainingPending: 0 });
  await firstRun;
  ui.render(0);

  const action = button(ui.render(3));
  assert.equal(action.props.children, "Generate 3 certificate(s)");
  const secondRun = action.props.onClick();
  assert.equal(ui.requests.length, 2);
  assert.equal(button(ui.render()).props.children, "Generating... (3 left)");
  ui.requests[1].respond({ remainingPending: 0 });
  await secondRun;
  assert.equal(ui.refreshCount, 2);
});

test("active progress follows batch responses independently of refreshed props", async () => {
  const ui = createButton(6);
  const run = button(ui.render()).props.onClick();
  ui.requests[0].respond({ remainingPending: 1 });
  await settle();
  assert.equal(ui.requests.length, 2);

  const active = button(ui.render(0));
  assert.equal(active.props.children, "Generating... (1 left)");
  assert.equal(active.props.disabled, true);
  ui.requests[1].respond({ remainingPending: 0 });
  await run;
  assert.equal(ui.render().props.children, "All certificates issued");
});

test("idle labels and retry runs use current props after a failed batch", async () => {
  const ui = createButton(5);
  const run = button(ui.render()).props.onClick();
  ui.requests[0].respond({ error: "Renderer unavailable" }, false);
  await run;

  const tree = ui.render(2);
  assert.equal(button(tree).props.children, "Generate 2 certificate(s)");
  assert.equal(button(tree).props.disabled, false);
  assert.equal(tree.props.children[1].props.children, "Renderer unavailable");
  const retry = button(tree).props.onClick();
  assert.equal(button(ui.render()).props.children, "Generating... (2 left)");
  ui.requests[1].respond({ remainingPending: 0 });
  await retry;
  assert.equal(ui.refreshCount, 2);
});

test("a batch with no progress stops without requesting another batch", async () => {
  const ui = createButton(2);
  const run = button(ui.render()).props.onClick();
  ui.requests[0].respond({ remainingPending: 2 });
  await run;
  assert.equal(ui.requests.length, 1);
  assert.equal(button(ui.render()).props.disabled, false);
});
