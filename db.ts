import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_key TEXT NOT NULL,
    prompt_type TEXT NOT NULL CHECK(prompt_type IN ('brand_rules', 'generation_template', 'refinement_template')),
    content TEXT NOT NULL,
    label TEXT DEFAULT '',
    author TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brand_configs (
    brand_key TEXT PRIMARY KEY,
    active_brand_rules TEXT,
    active_generation_template TEXT,
    active_refinement_template TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_key TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pv_brand_type ON prompt_versions(brand_key, prompt_type);
  CREATE INDEX IF NOT EXISTS idx_ri_brand ON reference_images(brand_key);
`);

// --- Prompt Versions ---

export function savePromptVersion(params: {
  brandKey: string;
  promptType: string;
  content: string;
  label?: string;
  author?: string;
  notes?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO prompt_versions (brand_key, prompt_type, content, label, author, notes)
    VALUES (@brandKey, @promptType, @content, @label, @author, @notes)
  `);
  const result = stmt.run({
    brandKey: params.brandKey,
    promptType: params.promptType,
    content: params.content,
    label: params.label ?? "",
    author: params.author ?? "",
    notes: params.notes ?? "",
  });

  upsertBrandConfig(params.brandKey, params.promptType, params.content);

  return { id: result.lastInsertRowid };
}

export function getPromptHistory(brandKey: string, promptType?: string) {
  if (promptType) {
    return db
      .prepare(
        `SELECT * FROM prompt_versions WHERE brand_key = ? AND prompt_type = ? ORDER BY created_at DESC`
      )
      .all(brandKey, promptType);
  }
  return db
    .prepare(
      `SELECT * FROM prompt_versions WHERE brand_key = ? ORDER BY created_at DESC`
    )
    .all(brandKey);
}

export function getPromptVersionById(id: number) {
  return db.prepare(`SELECT * FROM prompt_versions WHERE id = ?`).get(id);
}

export function restorePromptVersion(id: number) {
  const version = db
    .prepare(`SELECT * FROM prompt_versions WHERE id = ?`)
    .get(id) as any;
  if (!version) return null;
  upsertBrandConfig(version.brand_key, version.prompt_type, version.content);
  return version;
}

// --- Brand Configs ---

function upsertBrandConfig(brandKey: string, promptType: string, content: string) {
  const colMap: Record<string, string> = {
    brand_rules: "active_brand_rules",
    generation_template: "active_generation_template",
    refinement_template: "active_refinement_template",
  };
  const col = colMap[promptType];
  if (!col) return;

  const existing = db
    .prepare(`SELECT brand_key FROM brand_configs WHERE brand_key = ?`)
    .get(brandKey);

  if (existing) {
    db.prepare(
      `UPDATE brand_configs SET ${col} = ?, updated_at = datetime('now') WHERE brand_key = ?`
    ).run(content, brandKey);
  } else {
    db.prepare(
      `INSERT INTO brand_configs (brand_key, ${col}, updated_at) VALUES (?, ?, datetime('now'))`
    ).run(brandKey, content);
  }
}

export function getActiveBrandConfig(brandKey: string) {
  return db
    .prepare(`SELECT * FROM brand_configs WHERE brand_key = ?`)
    .get(brandKey) as any | undefined;
}

// --- Reference Images ---

export function getReferenceImages(brandKey: string) {
  return db
    .prepare(
      `SELECT * FROM reference_images WHERE brand_key = ? ORDER BY created_at ASC`
    )
    .all(brandKey);
}

export function addReferenceImage(brandKey: string, url: string) {
  const result = db
    .prepare(`INSERT INTO reference_images (brand_key, url) VALUES (?, ?)`)
    .run(brandKey, url);
  return { id: result.lastInsertRowid };
}

export function removeReferenceImage(id: number) {
  return db.prepare(`DELETE FROM reference_images WHERE id = ?`).run(id);
}

// --- Export / Import ---

export function exportBrandConfig(brandKey: string) {
  const config = getActiveBrandConfig(brandKey);
  const refs = getReferenceImages(brandKey);
  return {
    brandKey,
    config: config ?? {},
    referenceImages: refs,
    exportedAt: new Date().toISOString(),
  };
}

export function importBrandConfig(data: {
  brandKey: string;
  config: {
    active_brand_rules?: string;
    active_generation_template?: string;
    active_refinement_template?: string;
  };
  referenceImages?: Array<{ url: string }>;
  author?: string;
}) {
  const { brandKey, config, referenceImages, author } = data;

  const importVersion = (promptType: string, content: string | undefined) => {
    if (!content) return;
    savePromptVersion({
      brandKey,
      promptType,
      content,
      label: "Imported config",
      author: author ?? "import",
    });
  };

  importVersion("brand_rules", config.active_brand_rules);
  importVersion("generation_template", config.active_generation_template);
  importVersion("refinement_template", config.active_refinement_template);

  if (referenceImages?.length) {
    const existing = getReferenceImages(brandKey) as Array<{ url: string }>;
    const existingUrls = new Set(existing.map((r) => r.url));
    for (const ref of referenceImages) {
      if (!existingUrls.has(ref.url)) {
        addReferenceImage(brandKey, ref.url);
      }
    }
  }
}

export default db;
