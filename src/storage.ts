interface PromptVersion {
  id: number;
  brand_key: string;
  prompt_type: string;
  content: string;
  label: string;
  author: string;
  notes: string;
  created_at: string;
  starred: number;
}

interface BrandConfig {
  brand_key: string;
  active_brand_rules: string | null;
  active_generation_template: string | null;
  active_refinement_template: string | null;
  updated_at: string;
}

interface ReferenceImage {
  id: number;
  brand_key: string;
  url: string;
  created_at: string;
}

const KEYS = {
  versions: 'aiim-prompt-versions',
  configs: 'aiim-brand-configs',
  refs: 'aiim-reference-images',
  nextId: 'aiim-next-id',
};

function getNextId(): number {
  const id = parseInt(localStorage.getItem(KEYS.nextId) || '0', 10) + 1;
  localStorage.setItem(KEYS.nextId, String(id));
  return id;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function savePromptVersion(params: {
  brandKey: string;
  promptType: string;
  content: string;
  label?: string;
  author?: string;
  notes?: string;
}): { id: number } {
  const versions = readJSON<PromptVersion[]>(KEYS.versions, []);
  const id = getNextId();
  const version: PromptVersion = {
    id,
    brand_key: params.brandKey,
    prompt_type: params.promptType,
    content: params.content,
    label: params.label ?? '',
    author: params.author ?? '',
    notes: params.notes ?? '',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    starred: 0,
  };
  versions.push(version);
  writeJSON(KEYS.versions, versions);

  upsertBrandConfig(params.brandKey, params.promptType, params.content);
  return { id };
}

function upsertBrandConfig(brandKey: string, promptType: string, content: string) {
  const colMap: Record<string, keyof BrandConfig> = {
    brand_rules: 'active_brand_rules',
    generation_template: 'active_generation_template',
    refinement_template: 'active_refinement_template',
  };
  const col = colMap[promptType];
  if (!col) return;

  const configs = readJSON<BrandConfig[]>(KEYS.configs, []);
  const idx = configs.findIndex(c => c.brand_key === brandKey);
  if (idx >= 0) {
    configs[idx][col] = content as any;
    configs[idx].updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  } else {
    const newConfig: BrandConfig = {
      brand_key: brandKey,
      active_brand_rules: null,
      active_generation_template: null,
      active_refinement_template: null,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    newConfig[col] = content as any;
    configs.push(newConfig);
  }
  writeJSON(KEYS.configs, configs);
}

export function getActiveBrandConfig(brandKey: string): BrandConfig | null {
  const configs = readJSON<BrandConfig[]>(KEYS.configs, []);
  return configs.find(c => c.brand_key === brandKey) ?? null;
}

export function getPromptHistory(brandKey: string, promptType?: string): PromptVersion[] {
  const versions = readJSON<PromptVersion[]>(KEYS.versions, []);
  return versions
    .filter(v => v.brand_key === brandKey && (!promptType || v.prompt_type === promptType))
    .sort((a, b) => b.id - a.id);
}

export function restorePromptVersion(id: number): PromptVersion | null {
  const versions = readJSON<PromptVersion[]>(KEYS.versions, []);
  const version = versions.find(v => v.id === id);
  if (!version) return null;
  upsertBrandConfig(version.brand_key, version.prompt_type, version.content);
  return version;
}

export function togglePromptStar(id: number): { id: number; starred: number } | null {
  const versions = readJSON<PromptVersion[]>(KEYS.versions, []);
  const version = versions.find(v => v.id === id);
  if (!version) return null;
  version.starred = version.starred ? 0 : 1;
  writeJSON(KEYS.versions, versions);
  return { id, starred: version.starred };
}

export function updatePromptNotes(id: number, notes: string): { id: number; notes: string } | null {
  const versions = readJSON<PromptVersion[]>(KEYS.versions, []);
  const version = versions.find(v => v.id === id);
  if (!version) return null;
  version.notes = notes;
  writeJSON(KEYS.versions, versions);
  return { id, notes };
}

export function getReferenceImages(brandKey: string): ReferenceImage[] {
  const refs = readJSON<ReferenceImage[]>(KEYS.refs, []);
  return refs.filter(r => r.brand_key === brandKey).sort((a, b) => a.id - b.id);
}

export function addReferenceImage(brandKey: string, url: string): { id: number } {
  const refs = readJSON<ReferenceImage[]>(KEYS.refs, []);
  const id = getNextId();
  refs.push({
    id,
    brand_key: brandKey,
    url,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  writeJSON(KEYS.refs, refs);
  return { id };
}

export function removeReferenceImage(id: number) {
  const refs = readJSON<ReferenceImage[]>(KEYS.refs, []);
  writeJSON(KEYS.refs, refs.filter(r => r.id !== id));
}

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
    savePromptVersion({ brandKey, promptType, content, label: 'Imported config', author: author ?? 'import' });
  };

  importVersion('brand_rules', config.active_brand_rules);
  importVersion('generation_template', config.active_generation_template);
  importVersion('refinement_template', config.active_refinement_template);

  if (referenceImages?.length) {
    const existing = getReferenceImages(brandKey);
    const existingUrls = new Set(existing.map(r => r.url));
    for (const ref of referenceImages) {
      if (!existingUrls.has(ref.url)) {
        addReferenceImage(brandKey, ref.url);
      }
    }
  }
}
