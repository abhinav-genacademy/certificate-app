/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { parse } = require("csv-parse/sync");

function loadExportRoute(cohort) {
  const filename = path.join(__dirname, "../app/api/admin/cohorts/[id]/export/route.ts");
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    fileName: filename,
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    process: { env: { NEXT_PUBLIC_BASE_URL: "https://certificates.example/" } },
    require: (name) => {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/store") return { getCohort: async () => cohort };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });
  return exports.GET;
}

async function exportStudents(students) {
  const GET = loadExportRoute({ courseName: "Course", cohortLabel: "Cohort", students });
  const response = await GET(null, { params: Promise.resolve({ id: "cohort-1" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  return parse(await response.text(), { columns: true, record_delimiter: "\n" });
}

test("export neutralizes spreadsheet formulas, including whitespace and control prefixes", async () => {
  const names = [
    "=1+1",
    '+SUM(1,2)',
    "-1+2",
    "@SUM(1,2)",
    "  =1+1",
    "\t=1+1",
    "\r\n+1+1",
    "\u0000-1+1",
    "\u001b@SUM(1,2)",
    "\u0085=1+1",
    "\u00a0\ufeff=1+1",
    '=HYPERLINK("https://example.com","Click")',
  ];
  const rows = await exportStudents(names.map((name, index) => ({
    name,
    email: "=1+1@example.com",
    credentialId: `credential-${index}`,
  })));
  assert.deepEqual(rows.map((row) => row.Name), names.map((name) => `'${name}`));
  assert.ok(rows.every((row) => row.Email === "'=1+1@example.com"));
  assert.equal(rows[0]["Verify Link"], "https://certificates.example/verify/credential-0");
});

test("export preserves ordinary text, quotes, commas, and both newline characters", async () => {
  const names = [
    "Alice Smith",
    "O'Connor",
    "Anne-Marie",
    'Smith, "Alice"',
    "Alice\rSmith",
    "Alice\nSmith",
    "Alice\r\nSmith",
    "Alice,=1+1",
    "  Alice Smith",
    "",
  ];
  const rows = await exportStudents(names.map((name, index) => ({
    name,
    email: "alice+cert@example.com",
    credentialId: `credential-${index}`,
  })));
  assert.deepEqual(rows.map((row) => row.Name), names);
  assert.ok(rows.every((row) => row.Email === "alice+cert@example.com"));
});

test("export includes only issued students", async () => {
  const rows = await exportStudents([
    { name: "Issued", email: "issued@example.com", credentialId: "credential-1" },
    { name: "Pending", email: "pending@example.com", credentialId: null },
  ]);
  assert.deepEqual(rows.map((row) => row.Name), ["Issued"]);
});

test("export returns 404 for an unknown cohort", async () => {
  const GET = loadExportRoute(null);
  const response = await GET(null, { params: Promise.resolve({ id: "missing" }) });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Cohort not found" });
});
