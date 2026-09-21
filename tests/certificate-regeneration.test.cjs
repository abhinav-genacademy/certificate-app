/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { NextRequest } = require("next/server");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const originalDate = "2026-01-01T00:00:00.000Z";
const revokedDate = "2026-02-01T00:00:00.000Z";

// Run the store's actual SQL in a disposable in-memory database. These
// queries use syntax shared by PostgreSQL and SQLite; only date/UUID
// functions and the driver's result types need adapting.
function fixture(t, { revoked = false, issued = true } = {}) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  let clock = Date.parse("2026-03-01T00:00:00.000Z");
  db.function("now", () => new Date(clock++).toISOString());
  db.function("gen_random_uuid", () => randomUUID());
  db.exec(`
    CREATE TABLE cohorts (id TEXT PRIMARY KEY, course_name TEXT, cohort_label TEXT, created_at TEXT);
    CREATE TABLE students (
      id TEXT PRIMARY KEY, cohort_id TEXT, name TEXT, email TEXT, credential_id TEXT,
      certificate_url TEXT, certificate_png BLOB, issued_at TEXT, revoked_at TEXT,
      source TEXT, created_at TEXT, updated_at TEXT, UNIQUE (cohort_id, email)
    );
    CREATE TABLE weekly_submissions (
      cohort_id TEXT, week TEXT, email TEXT, name TEXT, PRIMARY KEY (cohort_id, week, email)
    );
    CREATE TABLE assessment_scores (cohort_id TEXT, email TEXT, score NUMERIC);
  `);
  db.prepare("INSERT INTO cohorts VALUES (?, ?, ?, ?)").run("cohort", "Course", "Cohort 1", originalDate);
  db.prepare("INSERT INTO students VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "student", "cohort", "Old Name", "student@example.com", issued ? "credential" : null,
    null, issued ? Buffer.from("old image") : null, issued ? originalDate : null,
    revoked ? revokedDate : null, null, originalDate, originalDate
  );
  const cache = new Map();
  const mocks = {};
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
      return require(id);
    };
    vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(
      localRequire, loadedModule, loadedModule.exports
    );
    return loadedModule.exports;
  }
  const { sql } = load("lib/db-client.ts");
  async function query(q) {
    const bindings = Object.fromEntries(q.values.map((value, i) => [`$${i + 1}`, value]));
    return db.prepare(q.text).all(bindings).map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key,
        value !== null && /(?:^|_)(?:created|updated|issued|revoked)_at$/.test(key)
          ? new Date(value) : value
      ])
    ));
  }
  mocks["@/lib/db-client"] = {
    sql, query,
    async transaction(queries) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const q of queries) results.push(await query(q));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const rendered = [];
  const browser = { async close() {} };
  const renderer = {
    async launchBrowser() { return browser; },
    async renderCertificatePng(data) {
      rendered.push(data);
      return Buffer.from(`image for ${data.recipientName}`);
    },
  };
  mocks["@/lib/certificate-render"] = renderer;
  const store = load("lib/store.ts");
  return {
    db, load, store, rendered, renderer,
    async student() { return (await store.getCohort("cohort")).students[0]; },
    async rename(name) {
      return store.upsertRoster("cohort", [{ name, email: "student@example.com" }]);
    },
    async generate(body = {}) {
      const route = load("app/api/admin/cohorts/[id]/generate/route.ts");
      const response = await route.POST(new NextRequest("https://example.com/api/admin/cohorts/cohort/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }), { params: Promise.resolve({ id: "cohort" }) });
      return { status: response.status, body: await response.json() };
    },
  };
}

test("a corrected name hides the old image and batch regeneration preserves the credential", async (t) => {
  const f = fixture(t);
  const before = await f.student();
  await f.rename("Correct Name");
  const pending = await f.student();
  assert.equal(pending.name, "Correct Name");
  assert.equal(pending.certificateUrl, null);
  assert.equal(pending.credentialId, before.credentialId);
  assert.equal(pending.issuedAt, before.issuedAt);
  assert.equal(await f.store.getCertificateImage("credential"), null);
  assert.equal((await f.store.findByCredentialId("credential")).student.certificateUrl, null);

  // An already-issued credential should not have to qualify again for an image correction.
  f.db.prepare("INSERT INTO assessment_scores VALUES (?, ?, ?)").run("cohort", "student@example.com", 0);
  assert.deepEqual(await f.generate(), {
    status: 200, body: { processed: 1, failed: [], notEligible: [], remainingPending: 0 },
  });
  const after = await f.student();
  assert.equal(f.rendered[0].recipientName, "Correct Name");
  assert.equal(f.rendered[0].credentialId, "credential");
  assert.equal(after.issuedAt, originalDate);
  assert.notEqual(after.certificateUrl, before.certificateUrl);
  assert.equal(Buffer.from(await f.store.getCertificateImage("credential")).toString(), "image for Correct Name");
});

test("unchanged manual names preserve the stored image and cache version", async (t) => {
  const f = fixture(t);
  const before = await f.student();
  await f.rename("Old Name");
  assert.equal((await f.student()).certificateUrl, before.certificateUrl);
  assert.equal(Buffer.from(await f.store.getCertificateImage("credential")).toString(), "old image");
});

test("weekly name corrections invalidate images, but identical uploads do not", async (t) => {
  const f = fixture(t);
  f.db.prepare("INSERT INTO weekly_submissions VALUES (?, ?, ?, ?)").run(
    "cohort", "week2", "student@example.com", "Old Name"
  );
  await f.store.setRequirementList("cohort", "week3", [{ email: "student@example.com", name: "CSV Correction" }]);
  assert.equal((await f.student()).certificateUrl, null);
  assert.equal((await f.student()).name, "CSV Correction");
  await f.generate();
  const before = await f.student();
  await f.store.setRequirementList("cohort", "week3", [{ email: "student@example.com", name: "CSV Correction" }]);
  assert.equal((await f.student()).certificateUrl, before.certificateUrl);
});

test("explicit regeneration repairs legacy images and never restores a revoked credential", async (t) => {
  const f = fixture(t, { revoked: true });
  f.db.prepare("UPDATE students SET name = ? WHERE id = ?").run("Previously Corrected Name", "student");
  const result = await f.generate({ studentId: "student", force: true });
  assert.equal(result.body.processed, 1);
  assert.equal(result.body.remainingPending, 0);
  assert.equal(f.rendered[0].recipientName, "Previously Corrected Name");
  assert.equal((await f.student()).revokedAt, revokedDate);
  assert.equal((await f.student()).issuedAt, originalDate);
  assert.equal((await f.student()).credentialId, "credential");
});

test("a rename during rendering cannot save a stale image", async (t) => {
  const f = fixture(t);
  const snapshot = await f.store.getCohort("cohort");
  f.renderer.renderCertificatePng = async () => {
    await f.rename("Newer Correction");
    return Buffer.from("outdated render");
  };
  const { generateCertificateForStudent } = f.load("lib/generate-certificate.ts");
  await assert.rejects(generateCertificateForStudent(snapshot, "student"), /renamed during generation/);
  assert.equal((await f.student()).name, "Newer Correction");
  assert.equal(await f.store.getCertificateImage("credential"), null);
});

test("initial issuance still enforces requirements", async (t) => {
  const f = fixture(t, { issued: false });
  f.db.prepare("INSERT INTO assessment_scores VALUES (?, ?, ?)").run("cohort", "student@example.com", 0);
  const result = await f.generate();
  assert.equal(result.body.processed, 0);
  assert.equal(result.body.remainingPending, 1);
  assert.deepEqual(result.body.notEligible[0].missingRequirements, ["Final Assessment"]);
  assert.equal(f.rendered.length, 0);
});

test("verification shows valid metadata without a stale image while regeneration is pending", async (t) => {
  const f = fixture(t);
  await f.rename("Correct Name");
  const { default: VerifyPage } = f.load("app/verify/[credentialId]/page.tsx");
  const html = renderToStaticMarkup(await VerifyPage({ params: Promise.resolve({ credentialId: "credential" }) }));
  assert.match(html, /Verified credential/);
  assert.match(html, /Correct Name/);
  assert.doesNotMatch(html, /<img\b/);
  assert.doesNotMatch(html, /Credential not found/);
});

test("revoked credentials remain invalid while their image is pending", async (t) => {
  const f = fixture(t, { revoked: true });
  await f.rename("Correct Name");
  const { default: VerifyPage } = f.load("app/verify/[credentialId]/page.tsx");
  const html = renderToStaticMarkup(await VerifyPage({ params: Promise.resolve({ credentialId: "credential" }) }));
  assert.match(html, /Credential revoked/);
  assert.doesNotMatch(html, /Verified credential|<img\b/);
});
