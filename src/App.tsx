import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Maximize2,
  Settings2,
  Key,
  Download,
  X,
  Search,
  Globe,
  Layers,
  Check,
  ShieldCheck,
  Play,
  Save,
  History,
  RotateCcw,
  FileDown,
  FileUp,
  Users,
  MessageSquare,
  Copy,
  Sun,
  Moon,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRANDS = {
  webstaurant: {
    name: 'WebstaurantStore',
    color: '#00AEEF',
    rules: `Persona: You are an Expert Product Marketer and Senior Brand Designer for WebstaurantStore.

Output Types:
1. Hero (Template C): Use a large Cyan (#00AEEF) background block with a short, punchy marketing hook in white Serif Italic text.
2. Feature Highlight (Template B): Use a large, solid Cyan (#00AEEF) circle with bold white text.
3. Dimensions Highlight (Template A): Use black circle callouts (#1A1A1A) with white text and thin gray dimension lines.

Design Rules:
- Color: Strictly Cyan (#00AEEF) for brand elements.
- Typography: Bold Serif for hooks, Bold Sans-Serif for technical data.
- Wordage: Minimal. Be concise. Let the product be the hero.
- Footer: Always include the standard WebstaurantStore three-column icon footer.`,
    defaultReferences: [
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample3.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample2.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample1.png'
    ]
  },
  acopa: {
    name: 'Acopa',
    color: '#00adef',
    rules: `Role: You are a Senior Brand Designer for Acopa Tableware. You produce high-end, catalog-quality product marketing graphics. Every image must look like it came from a professional print catalog — minimal, refined, and product-focused.

=== BRAND COLORS ===
- Acopa Blue: #00adef (primary brand color — used for all color blocks, icons, and accents)
- Black: #000000
- White: #ffffff
Use ONLY these colors. No grays, no off-whites, no other blues.

=== CANVAS ===
- Output size: 2000 x 2000 px (1:1 square)
- Content margin: ~7.5% from each edge (keep all text and icons inside this boundary)
- Logo margin: ~5% from edges (logo sits slightly closer to the edge than content)

=== TYPOGRAPHY ===
- Tagline / Hook: Playfair Display Italic. Variable sizing, large and elegant. Max 10 words. Wrap text to prevent widows (the last line should never be a single word alone).
- Feature labels: Bold sans-serif, ALL CAPS, short (2–4 words each).
- Measurement / dimension labels: Bold sans-serif inside solid black circles with white text.

=== PRODUCT IMAGE RULES (CRITICAL) ===
- The product must be the HERO — it occupies at least 50–60% of the canvas.
- NEVER alter the product's shape, texture, or surface. Stoneware products have natural irregularities, speckles, and organic forms. Preserve them exactly as provided. Do NOT smooth, symmetrize, or "clean up" the product.
- Add a subtle grounding drop shadow beneath the product so it feels anchored, not floating.
- The product must be 100% unobstructed — no text, lines, icons, or graphic elements may overlap any part of the product.

=== ICON STYLE ===
- Thin single-weight outlined stroke icons (no fills, no solid shapes).
- Stroke color: White when on a Blue background, Acopa Blue (#00adef) when on a White background.
- Icons appear ONLY in the footer strip area (bottom ~15% of canvas).
- Max 3 icons per image.

=== LOGO ===
- Full-color Acopa logo when placed on a White background.
- White Acopa logo when placed on a Blue (#00adef) background.
- The logo appears in the reference images — reproduce it exactly as shown.

=== LAYOUT RULES ===
- All background shapes use ONLY straight horizontal or vertical edges. Absolutely NO diagonal lines, angled banners, slanted shapes, or rotated elements.
- Use clean geometric sections: vertical panels, horizontal bands, or split backgrounds.
- Only ONE layout strategy per image — do not mix.

=== LAYOUT TEMPLATES ===

Template C — HERO (use for "hero" asset type):
- 60/40 vertical split: Blue (#00adef) panel on the left, White panel on the right (or vice versa).
- Tagline in Playfair Display Italic sits on the Blue panel.
- Logo sits on the White panel.
- Product is centered, overlapping both panels slightly.
- No icons in this template.

Template B — FEATURE (use for "feature" asset type):
- Product centered on a clean White or lightly split background.
- A solid Blue (#00adef) circle with bold white sans-serif text shows a key spec (e.g., "10 oz. capacity").
- Footer strip at the bottom with 2–3 feature icons and short labels.
- Logo in a corner.

Template A — DIMENSIONS (use for "dimensions" asset type):
- Product on a clean White background.
- Thin black dimension lines with arrows extending from the product edges.
- Dimension values inside solid Black circles with White bold text.
- Blue band across the bottom ~25% of canvas with White feature icons and the text "Durable Stoneware" or similar.
- Logo on the White section above the blue band.

=== TEXT CONTENT RULES ===
- Keep text MINIMAL. Only include: logo + ONE short tagline (4–6 words max) + icon labels.
- Do NOT include product name, price, specs, dimensions text, quantities, URLs, or any other text beyond what the template calls for.
- Exception: Template A (dimensions) shows dimension values only.

=== EXECUTION ===
- Analyze all provided reference images first to understand the exact visual language: colors, typography, icon style, spacing, and layout structure.
- Match the reference style precisely, then create a new variation using the product image provided.
- Prioritize clean, premium catalog design above all else.`,
    defaultReferences: [
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample3.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample2.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample1.png'
    ]
  }
};

const DEFAULT_GENERATION_TEMPLATE = `Reference Images: The first \${refCount} images are the layout and style guides.
Product Image: The last image is the raw product to be inserted.
\${productTitle}
\${productDescription}
\${productSpecs}
Selected Output Type: \${assetType}
\${prompt}`;

const DEFAULT_REFINEMENT_TEMPLATE = `Refinement Task: Modify the provided image based on these instructions: \${refinementPrompt}. 
Maintain the brand consistency (Colors: \${brandColor}, Style: \${brandName}). 
The original product should remain the focus.`;

const DEFAULT_PROMPT = ``;

type AssetType = 'hero' | 'feature' | 'dimensions';
type BrandKey = keyof typeof BRANDS;

interface ImageState {
  file: File | null;
  preview: string | null;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface ScrapedData {
  title: string;
  brand: string;
  galleryImages: string[];
  price: string;
  itemNumber: string;
  mfrNumber: string;
  upc: string;
  features: string[];
  featureDetails?: Record<string, string>;
  description: string;
  specs: Record<string, string>;
}

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

interface StoredRef {
  id: number;
  brand_key: string;
  url: string;
  created_at: string;
}

const FLAG_PATTERNS: Record<string, { label: string; pattern: RegExp }> = {
  dishwasherSafe:    { label: "Dishwasher Safe", pattern: /dishwasher[\s-]*safe/i },
  microwaveSafe:     { label: "Microwave Safe", pattern: /microwave[\s-]*safe/i },
  ovenSafe:          { label: "Oven Safe", pattern: /oven[\s-]*safe/i },
  stackable:         { label: "Stackable", pattern: /stackable/i },
  nsf:               { label: "NSF Certified", pattern: /\bnsf\b/i },
  leadFree:          { label: "Lead Free", pattern: /lead[\s-]*free/i },
  durableStoneware:  { label: "Durable Stoneware", pattern: /durable\s+stoneware/i },
};

function detectFlags(data: ScrapedData): string[] {
  const text = `${data.title} ${data.description} ${data.features.join(" ")} ${data.featureDetails ? Object.keys(data.featureDetails).join(" ") + " " + Object.values(data.featureDetails).join(" ") : ""}`;
  const activeFlags: string[] = [];
  for (const { label, pattern } of Object.values(FLAG_PATTERNS)) {
    if (pattern.test(text)) activeFlags.push(label);
  }
  return activeFlags;
}

function computeDiffLines(a: string, b: string): Array<{ type: 'same' | 'added' | 'removed'; text: string }> {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    const aLine = aLines[i];
    const bLine = bLines[i];
    if (aLine === bLine) {
      result.push({ type: 'same', text: aLine ?? '' });
    } else {
      if (aLine !== undefined) result.push({ type: 'removed', text: aLine });
      if (bLine !== undefined) result.push({ type: 'added', text: bLine });
    }
  }
  return result;
}

export default function App() {
  const [referenceImgs, setReferenceImgs] = useState<ImageState[]>([]);
  const [productImg, setProductImg] = useState<ImageState>({ file: null, preview: null });
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('acopa');
  const [brandRules, setBrandRules] = useState(BRANDS.acopa.rules);
  const [savedBrandRules, setSavedBrandRules] = useState(BRANDS.acopa.rules);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<Set<AssetType>>(new Set(['hero', 'feature']));
  const [imageSize, setImageSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImages, setResultImages] = useState<Partial<Record<AssetType, string>>>({});
  const [activeResultTab, setActiveResultTab] = useState<AssetType>('hero');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('aiim-theme') as 'dark' | 'light') || 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('aiim-theme', next);
  };

  // Prompt editing state
  const [showExpandedEditor, setShowExpandedEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  // Version history state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<PromptVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [diffVersions, setDiffVersions] = useState<[PromptVersion | null, PromptVersion | null]>([null, null]);
  const [showDiff, setShowDiff] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);
  const [detailNotesText, setDetailNotesText] = useState('');
  const [appliedVersionId, setAppliedVersionId] = useState<number | null>(null);

  // Collaboration state
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('aiim-author') || '');
  const [showSettings, setShowSettings] = useState(false);

  // Reference images state
  const [storedRefs, setStoredRefs] = useState<StoredRef[]>([]);
  const [newRefUrl, setNewRefUrl] = useState('');
  const [showAddRef, setShowAddRef] = useState(false);

  // Import file ref
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  // Load saved prompts and references when brand changes
  useEffect(() => {
    loadBrandConfig(selectedBrand);
    loadStoredRefs(selectedBrand);
  }, [selectedBrand]);

  const loadBrandConfig = async (brandKey: string) => {
    try {
      const res = await fetch(`/api/prompts/${brandKey}`);
      if (!res.ok) return;
      const config = await res.json();
      if (config.active_brand_rules) {
        setBrandRules(config.active_brand_rules);
        setSavedBrandRules(config.active_brand_rules);
      }
    } catch {
      // No saved config, use defaults
    }
  };

  const loadStoredRefs = async (brandKey: string) => {
    try {
      const res = await fetch(`/api/references/${brandKey}`);
      const refs = await res.json();
      setStoredRefs(refs);
    } catch {
      setStoredRefs([]);
    }
  };

  const loadHistory = async (brandKey: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/prompts/${brandKey}/history?type=brand_rules`);
      const data = await res.json();
      setHistoryData(data);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSavePrompt = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandKey: selectedBrand,
          promptType: 'brand_rules',
          content: brandRules,
          label: saveLabel,
          author: authorName,
          notes: saveNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      setSavedBrandRules(brandRules);
      setSaveSuccess(true);
      setSaveLabel('');
      setSaveNotes('');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyVersion = async (version: PromptVersion) => {
    try {
      const res = await fetch(`/api/prompts/restore/${version.id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Apply failed');
      setBrandRules(version.content);
      setSavedBrandRules(version.content);
      setAppliedVersionId(version.id);
    } catch {
      setError('Failed to apply version');
    }
  };

  const handleToggleStar = async (version: PromptVersion) => {
    try {
      const res = await fetch(`/api/prompts/${version.id}/star`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Toggle star failed');
      const data = await res.json();
      setHistoryData(prev =>
        prev.map(v => v.id === version.id ? { ...v, starred: data.starred } : v)
      );
      if (viewingVersion?.id === version.id) {
        setViewingVersion(prev => prev ? { ...prev, starred: data.starred } : prev);
      }
    } catch {
      setError('Failed to update star');
    }
  };

  const handleUpdateNotes = async (id: number, notes: string) => {
    try {
      const res = await fetch(`/api/prompts/${id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Update notes failed');
      setHistoryData(prev =>
        prev.map(v => v.id === id ? { ...v, notes } : v)
      );
      if (viewingVersion?.id === id) {
        setViewingVersion(prev => prev ? { ...prev, notes } : prev);
      }
    } catch {
      setError('Failed to update notes');
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/export/${selectedBrand}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aiim-config-${selectedBrand}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export config');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      data.author = authorName;
      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadBrandConfig(selectedBrand);
      await loadStoredRefs(selectedBrand);
    } catch {
      setError('Failed to import config');
    }
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleAddRef = async () => {
    if (!newRefUrl.trim()) return;
    try {
      await fetch('/api/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: selectedBrand, url: newRefUrl.trim() }),
      });
      setNewRefUrl('');
      setShowAddRef(false);
      await loadStoredRefs(selectedBrand);
    } catch {
      setError('Failed to add reference image');
    }
  };

  const handleRemoveRef = async (id: number) => {
    try {
      await fetch(`/api/references/${id}`, { method: 'DELETE' });
      await loadStoredRefs(selectedBrand);
    } catch {
      setError('Failed to remove reference image');
    }
  };

  const onDropReference = useCallback((acceptedFiles: File[]) => {
    const newImgs = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setReferenceImgs(prev => [...prev, ...newImgs]);
  }, []);

  const removeReferenceImg = (index: number) => {
    setReferenceImgs(prev => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      return updated;
    });
  };

  const onDropProduct = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setProductImg({ file, preview: URL.createObjectURL(file) });
    }
  }, []);

  const { getRootProps: getRefRootProps, getInputProps: getRefInputProps, isDragActive: isRefDragActive } = useDropzone({
    onDrop: onDropReference,
    accept: { 'image/*': [] as string[] },
    multiple: true
  } as any);

  const { getRootProps: getProdRootProps, getInputProps: getProdInputProps, isDragActive: isProdDragActive } = useDropzone({
    onDrop: onDropProduct,
    accept: { 'image/*': [] as string[] },
    multiple: false
  } as any);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const buildGenerationText = (refCount: number, forAssetType: AssetType) => {
    const vars: Record<string, string> = {
      refCount: String(refCount),
      productTitle: scrapedData ? `Product Title: ${scrapedData.title}` : '',
      productDescription: scrapedData?.description ? `Product Description: ${scrapedData.description}` : '',
      productSpecs: scrapedData?.specs
        ? `Key Specs: ${Object.entries(scrapedData.specs).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : '',
      assetType: forAssetType.toUpperCase(),
      prompt: prompt,
    };
    let text = DEFAULT_GENERATION_TEMPLATE;
    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return text;
  };

  const buildRefinementText = () => {
    const vars: Record<string, string> = {
      refinementPrompt: refinementPrompt,
      brandColor: BRANDS[selectedBrand].color,
      brandName: selectedBrand.toUpperCase(),
    };
    let text = DEFAULT_REFINEMENT_TEMPLATE;
    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return text;
  };

  const getAllReferenceUrls = (): string[] => {
    const defaults = BRANDS[selectedBrand].defaultReferences;
    const stored = storedRefs.map(r => r.url);
    return [...defaults, ...stored];
  };

  const handleGenerate = async () => {
    if (!productImg.file) {
      setError("Please upload a product image.");
      return;
    }
    if (selectedAssetTypes.size === 0) {
      setError("Please select at least one asset type.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setResultImages({});
    const types: AssetType[] = Array.from(selectedAssetTypes);
    setActiveResultTab(types[0]);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key found. Please select an API key.");

      const ai = new GoogleGenAI({ apiKey });
      let refParts: any[] = [];

      if (referenceImgs.length > 0) {
        refParts = await Promise.all(referenceImgs.map(async (img) => ({
          inlineData: { data: await fileToBase64(img.file!), mimeType: img.file!.type },
        })));
      } else {
        const refUrls = getAllReferenceUrls();
        refParts = await Promise.all(refUrls.map(async (url) => ({
          inlineData: { data: await urlToBase64(url), mimeType: 'image/jpeg' },
        })));
      }

      const prodBase64 = await fileToBase64(productImg.file);

      for (const assetType of types) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [
              ...refParts,
              { inlineData: { data: prodBase64, mimeType: productImg.file!.type } },
              { text: buildGenerationText(refParts.length, assetType) },
            ],
          },
          config: {
            systemInstruction: brandRules + "\n\nContext: Analyze all provided reference images to understand the consistent layout, lighting, and shadow styles of the brand.",
            imageConfig: { aspectRatio: "1:1", imageSize: imageSize }
          },
        });

        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              setResultImages(prev => ({ ...prev, [assetType]: `data:image/png;base64,${part.inlineData!.data}` }));
              break;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("403") || err.message?.includes("PERMISSION_DENIED") || err.message?.includes("Requested entity was not found")) {
        setError("Permission Denied (403). This model requires a paid/preview API key.");
        setHasApiKey(false);
      } else {
        setError(err.message || "An error occurred during generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    const currentImage = resultImages[activeResultTab];
    if (!currentImage || !refinementPrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key found. Please select an API key.");

      const ai = new GoogleGenAI({ apiKey });
      const currentImageBase64 = currentImage.split(',')[1];
      const mimeType = currentImage.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: currentImageBase64, mimeType } },
            { text: buildRefinementText() },
          ],
        },
        config: {
          systemInstruction: brandRules + "\n\nYou are refining an existing marketing asset. Follow the user's instructions precisely while maintaining brand integrity.",
          imageConfig: { aspectRatio: "1:1", imageSize: imageSize }
        },
      });

      let foundImage = false;
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            setResultImages(prev => ({ ...prev, [activeResultTab]: `data:image/png;base64,${part.inlineData!.data}` }));
            setRefinementPrompt('');
            foundImage = true;
            break;
          }
        }
      }
      if (!foundImage) throw new Error("No image was generated in the refinement response.");
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('403') || err.message?.includes('permission')) {
        setError("API Key Error: Please ensure you have selected a valid API key with access to Gemini 3.1 Flash Image.");
      } else {
        setError(err.message || "Refinement failed");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const openKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    setError(null);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setScrapedData(data);

      if (data.galleryImages && data.galleryImages.length > 0) {
        const bestImage = data.galleryImages.find((url: string) => 
          url.toLowerCase().includes('white') || 
          url.toLowerCase().includes('transparent') ||
          url.toLowerCase().endsWith('.png')
        ) || data.galleryImages[0];
        selectScrapedImage(bestImage);
      }
      setPrompt('');
    } catch (err: any) {
      setError(err.message || "Failed to scrape item");
    } finally {
      setIsScraping(false);
    }
  };

  const selectScrapedImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = url.split('/').pop() || 'image.png';
      const file = new File([blob], filename, { type: blob.type });
      setProductImg({ file, preview: url });
    } catch {
      setError("Failed to select image");
    }
  };

  const allRefUrls = getAllReferenceUrls();
  const currentResultImage = resultImages[activeResultTab] ?? null;
  const hasAnyResult = Object.keys(resultImages).length > 0;

  const toggleAssetType = (type: AssetType) => {
    setSelectedAssetTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div data-theme={theme} className="h-screen bg-(--bg-page) text-(--fg) font-sans selection:bg-[#00AEEF]/30 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 bg-(--bg-card) border-r border-(--border) flex flex-col h-screen overflow-hidden">
        {/* Sidebar Header */}
        <div className="px-5 py-4 border-b border-(--border) flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#00AEEF] rounded-xl flex items-center justify-center shadow-md">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-sm font-black tracking-tight text-(--fg) uppercase">AIIM Bot <span className="font-normal text-(--fg-label)">Studio</span></h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-lg text-(--fg-faint) hover:text-(--fg) hover:bg-(--bg-surface) transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-(--fg-faint) hover:text-(--fg) hover:bg-(--bg-surface) transition-all">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-6">
          {/* Brand Identity */}
          <div className="space-y-3">
            <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Brand Identity</label>
            <div className="space-y-2">
              {(Object.keys(BRANDS) as BrandKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedBrand(key);
                    setBrandRules(BRANDS[key].rules);
                    setSavedBrandRules(BRANDS[key].rules);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 active:scale-[0.98]",
                    selectedBrand === key
                      ? "border-[#00AEEF]/50 bg-[#00AEEF]/10 text-(--fg)"
                      : "border-(--border) hover:border-(--border-hover) text-(--fg-label) hover:bg-(--bg-surface)"
                  )}
                >
                  <div className="w-7 h-7 rounded-lg shadow-sm flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ backgroundColor: BRANDS[key].color }}>
                    {BRANDS[key].name[0]}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{BRANDS[key].name}</span>
                  {selectedBrand === key && <Check className="w-4 h-4 text-[#00AEEF] ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Design Logic (compact preview) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Design Logic</label>
              <button
                onClick={() => setShowExpandedEditor(true)}
                className="text-[9px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-widest transition-colors"
              >
                Editor
              </button>
            </div>
            <button
              onClick={() => setShowExpandedEditor(true)}
              className="w-full bg-(--bg-input) border border-(--border) rounded-xl p-3 text-left hover:border-(--border-hover) transition-all cursor-pointer relative group"
            >
              <div className="font-mono text-[9px] text-(--fg-faint) leading-relaxed overflow-hidden max-h-[4.5rem]">
                {brandRules.split('\n').slice(0, 4).map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-(--fg-dim) select-none w-4 text-right shrink-0">{i + 1}</span>
                    <span className="truncate">{line || '\u00A0'}</span>
                  </div>
                ))}
              </div>
              {brandRules !== savedBrandRules && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="px-5 py-4 border-t border-(--border) space-y-3 shrink-0">
          <button
            onClick={handleSavePrompt}
            disabled={isSaving}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
              saveSuccess
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#00AEEF] hover:bg-[#0096ce] text-white shadow-(--shadow-cta)"
            )}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={() => { setShowHistory(true); loadHistory(selectedBrand); }}
            className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-black text-(--fg-label) hover:text-[#00AEEF] uppercase tracking-widest transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Version History
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* URL Extract Bar */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="bg-(--bg-card) rounded-2xl border border-(--border) p-2 flex items-center gap-2 shadow-(--shadow-card)">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-(--fg-faint) group-focus-within:text-[#00AEEF] transition-colors" />
              <input
                type="text"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="Paste WebstaurantStore URL..."
                className="w-full bg-(--bg-input) border border-(--border) rounded-xl pl-11 pr-4 py-3 text-xs text-(--fg) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              />
            </div>
            <button
              onClick={handleScrape}
              disabled={isScraping || !scrapeUrl}
              className="bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
            >
              {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Extract
            </button>
          </div>
          {!hasApiKey && (
            <button onClick={openKeyDialog} className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#00AEEF]/10 text-[#00AEEF] rounded-lg text-[9px] font-black uppercase tracking-widest border border-[#00AEEF]/20 hover:bg-[#00AEEF]/20 transition-all">
              <Key className="w-3.5 h-3.5" />
              Connect API Key
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="shrink-0 px-4 pb-2">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="shrink-0"><X className="w-3.5 h-3.5 text-red-400/50 hover:text-red-400" /></button>
            </div>
          </div>
        )}

        {/* Middle: Source Assets + Canvas */}
        <div className="flex-1 flex gap-4 px-4 py-2 overflow-hidden min-h-0">
          {/* Source Assets Panel */}
          <div className="w-[340px] shrink-0 bg-(--bg-card) border border-(--border) rounded-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-(--border) flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-(--fg-label)">
                <Upload className="w-4 h-4" />
                <h2 className="font-black uppercase tracking-[0.2em] text-[10px]">Source Assets</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Product Image */}
              <div>
                <label className="text-[8px] font-black text-(--fg-faint) uppercase tracking-[0.2em] mb-2 block">Product Image</label>
                <div {...getProdRootProps()} className={cn(
                  "aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group relative overflow-hidden",
                  isProdDragActive ? "border-[#00AEEF] bg-[#00AEEF]/5" : "border-(--border) hover:border-(--border-hover) bg-(--bg-surface-subtle)"
                )}>
                  <input {...getProdInputProps()} />
                  {productImg.preview ? (
                    <div className="w-full h-full relative">
                      <img src={productImg.preview} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <button onClick={(e) => { e.stopPropagation(); setProductImg({ file: null, preview: null }); }} className="absolute top-2 right-2 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center hover:bg-black transition-colors">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-(--fg-dim)" />
                      <p className="text-[8px] font-black text-(--fg-dim) uppercase tracking-widest">Upload slote</p>
                    </>
                  )}
                </div>
              </div>

              {/* Extracted Gallery */}
              {scrapedData && scrapedData.galleryImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-(--border)">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Gallery</label>
                    <span className="text-[8px] font-bold text-(--fg-dim)">{scrapedData.galleryImages.length}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {scrapedData.galleryImages.map((url, idx) => (
                      <button key={idx} onClick={() => selectScrapedImage(url)} className={cn("aspect-square rounded-lg border overflow-hidden transition-all relative", productImg.preview === url ? "border-[#00AEEF] ring-2 ring-[#00AEEF]/10" : "border-(--border) hover:border-(--border-hover)")}>
                        <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {productImg.preview === url && <div className="absolute inset-0 bg-[#00AEEF]/20 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scraped Data Summary */}
              {scrapedData && (
                <div className="space-y-2 pt-2 border-t border-(--border)">
                  <label className="text-[8px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Product Info</label>
                  <p className="text-[10px] text-(--fg-label) leading-snug line-clamp-2">{scrapedData.title}</p>
                  {detectFlags(scrapedData).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {detectFlags(scrapedData).map((flag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-[#00AEEF]/10 border border-[#00AEEF]/20 rounded text-[7px] font-black text-[#00AEEF] uppercase">{flag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reference Images */}
              <div className="space-y-2 pt-2 border-t border-(--border)">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Reference Images ({allRefUrls.length + referenceImgs.length})</label>
                  <button
                    onClick={() => setShowAddRef(!showAddRef)}
                    className="text-[8px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-widest transition-colors"
                  >
                    + URL
                  </button>
                </div>

                {showAddRef && (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newRefUrl}
                      onChange={(e) => setNewRefUrl(e.target.value)}
                      placeholder="Paste image URL..."
                      className="flex-1 bg-(--bg-input) border border-(--border) rounded-lg px-3 py-2 text-[9px] text-(--fg-muted) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRef()}
                    />
                    <button onClick={handleAddRef} className="px-3 py-2 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 rounded-lg text-[8px] font-black uppercase hover:bg-[#00AEEF]/20 transition-all">
                      Add
                    </button>
                  </div>
                )}

                {/* Brand default + stored refs grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {BRANDS[selectedBrand].defaultReferences.map((url, idx) => (
                    <div key={`default-${idx}`} className="aspect-square rounded-lg border border-(--border) bg-(--bg-surface-subtle) relative group overflow-hidden">
                      <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/70 rounded text-[6px] font-bold text-white uppercase">Default</div>
                    </div>
                  ))}
                  {storedRefs.map((ref) => (
                    <div key={ref.id} className="aspect-square rounded-lg border border-[#00AEEF]/20 bg-(--bg-surface-subtle) relative group overflow-hidden">
                      <img src={ref.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        onClick={() => handleRemoveRef(ref.id)}
                        className="absolute top-1 right-1 w-4 h-4 bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-[#00AEEF]/20 rounded text-[6px] font-bold text-[#00AEEF] uppercase">Custom</div>
                    </div>
                  ))}
                </div>

                {/* Local file uploads */}
                <div className="space-y-2">
                  {referenceImgs.map((img, idx) => (
                    <div key={idx} className="aspect-[4/3] rounded-xl border border-(--border) bg-(--bg-surface-subtle) relative group overflow-hidden">
                      <img src={img.preview} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button onClick={() => removeReferenceImg(idx)} className="absolute top-2 right-2 w-5 h-5 bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[7px] font-bold text-white uppercase">Upload {idx + 1}</div>
                    </div>
                  ))}
                  {referenceImgs.length < 4 && (
                    <div {...getRefRootProps()} className="aspect-[4/3] rounded-xl border-2 border-dashed border-(--border) hover:border-(--border-hover) bg-(--bg-surface-subtle) flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
                      <input {...getRefInputProps()} />
                      <Upload className="w-4 h-4 text-(--fg-dim)" />
                      <p className="text-[8px] font-black text-(--fg-dim) uppercase tracking-widest">Upload Ref</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Prompt */}
              <div className="space-y-2 pt-2 border-t border-(--border)">
                <label className="text-[8px] font-black text-(--fg-faint) uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  AI Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-24 bg-(--bg-input) border border-(--border) rounded-xl p-3 text-[10px] text-(--fg-muted) focus:ring-1 focus:ring-[#00AEEF]/50 outline-none resize-none leading-relaxed transition-all"
                  placeholder="Describe the marketing angle..."
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !productImg.file || selectedAssetTypes.size === 0}
                  className="w-full bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-(--shadow-cta) active:scale-95"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Generate {selectedAssetTypes.size > 1 ? `(${selectedAssetTypes.size})` : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Studio Canvas Panel */}
          <div className="flex-1 bg-(--bg-card) border border-(--border) rounded-2xl flex flex-col overflow-hidden min-w-0">
            <div className="px-5 py-3 border-b border-(--border) flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[#00AEEF]">
                  <Maximize2 className="w-4 h-4" />
                  <h2 className="font-black uppercase tracking-[0.2em] text-[10px]">Studio Canvas</h2>
                </div>
                {/* Result Tabs */}
                {hasAnyResult && selectedAssetTypes.size > 1 && (
                  <div className="flex items-center gap-1 ml-2">
                    {Array.from(selectedAssetTypes).map(type => (
                      <button
                        key={type}
                        onClick={() => setActiveResultTab(type)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                          activeResultTab === type
                            ? "bg-[#00AEEF]/10 text-[#00AEEF] border-[#00AEEF]/30"
                            : "text-(--fg-faint) border-transparent hover:text-(--fg-label)"
                        )}
                      >
                        {type}
                        {resultImages[type] && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {currentResultImage && (
                <a href={currentResultImage} download={`brandengine-${activeResultTab}.png`} className="flex items-center gap-2 text-[9px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-widest transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </a>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-2 border-[#00AEEF]/10 border-t-[#00AEEF] rounded-full animate-spin" />
                      <Sparkles className="w-8 h-8 text-[#00AEEF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-(--fg)">Rendering</h3>
                      <p className="text-[9px] text-(--fg-faint) font-black uppercase tracking-widest">{imageSize} Output</p>
                    </div>
                  </motion.div>
                ) : currentResultImage ? (
                  <motion.div key={`result-${activeResultTab}`} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full flex items-center justify-center">
                    <div className="max-w-full max-h-full aspect-square rounded-2xl overflow-hidden shadow-(--shadow-card) border border-(--border)">
                      <img src={currentResultImage} alt={`Generated ${activeResultTab}`} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 text-(--fg-ghost) text-center">
                    <div className="w-20 h-20 rounded-2xl bg-(--bg-surface-subtle) flex items-center justify-center border border-(--border)">
                      <ImageIcon className="w-8 h-8 opacity-10" />
                    </div>
                    <p className="text-[10px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Awaiting Generation...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Refinement */}
            {currentResultImage && !isGenerating && (
              <div className="shrink-0 px-5 py-3 border-t border-(--border) flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#00AEEF] shrink-0" />
                <input
                  type="text"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder="Refine: e.g. 'Make the text larger'..."
                  className="flex-1 bg-(--bg-input) border border-(--border) rounded-xl px-4 py-2.5 text-[10px] text-(--fg) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                />
                <button
                  onClick={handleRefine}
                  disabled={!refinementPrompt.trim() || isGenerating}
                  className="bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  Refine
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar: Asset Specs + Output Resolution */}
        <div className="shrink-0 px-4 pb-4 pt-2 flex gap-4">
          <div className="flex-1 bg-(--bg-card) border border-(--border) rounded-2xl px-6 py-3 flex items-center gap-6">
            <div className="flex items-center gap-2 text-(--fg-label)">
              <Layers className="w-4 h-4" />
              <h3 className="font-black uppercase tracking-[0.2em] text-[10px]">Asset Specs</h3>
            </div>
            <div className="flex items-center gap-5">
              {(['hero', 'feature', 'dimensions'] as AssetType[]).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[10px] font-black uppercase tracking-widest text-(--fg-label)">{type}</span>
                  <button
                    onClick={() => toggleAssetType(type)}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors duration-200",
                      selectedAssetTypes.has(type) ? "bg-[#00AEEF]" : "bg-(--bg-surface-hover)"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      selectedAssetTypes.has(type) ? "translate-x-5.5" : "translate-x-0.5"
                    )} />
                  </button>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-(--bg-card) border border-(--border) rounded-2xl px-6 py-3 flex items-center gap-4">
            <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-(--fg-label)">Output Resolution</h3>
            <div className="flex gap-1.5">
              {(['1K', '2K', '4K'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setImageSize(size)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                    imageSize === size
                      ? "border-[#00AEEF]/50 bg-[#00AEEF]/10 text-(--fg)"
                      : "border-(--border) hover:border-(--border-hover) text-(--fg-label)"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Version History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-(--modal-backdrop) backdrop-blur-sm p-4"
            onClick={() => { setShowHistory(false); setShowDiff(false); setDiffVersions([null, null]); setViewingVersion(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-(--modal-bg) border border-(--border-hover) rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-(--shadow-canvas)"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {(viewingVersion || showDiff) && (
                    <button
                      onClick={() => { setViewingVersion(null); setShowDiff(false); setDiffVersions([null, null]); setDetailNotesText(''); }}
                      className="text-[9px] font-black text-[#00AEEF] uppercase tracking-widest hover:text-[#0096ce] transition-colors flex items-center gap-1 mr-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Back
                    </button>
                  )}
                  <History className="w-5 h-5 text-[#00AEEF]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-(--fg)">
                    {viewingVersion ? `Version #${viewingVersion.id}` : 'Version History'}
                  </h2>
                </div>
                <button onClick={() => { setShowHistory(false); setShowDiff(false); setDiffVersions([null, null]); setViewingVersion(null); }}>
                  <X className="w-5 h-5 text-(--fg-label) hover:text-(--fg) transition-colors" />
                </button>
              </div>

              {/* Detail View */}
              {viewingVersion ? (() => {
                const isApplied = appliedVersionId === viewingVersion.id || (appliedVersionId === null && viewingVersion.content === savedBrandRules);
                return (
                  <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                    {/* Version header */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => handleToggleStar(viewingVersion)} className="shrink-0">
                          <Star className={cn("w-4 h-4 transition-colors", viewingVersion.starred ? "text-yellow-400 fill-yellow-400" : "text-(--fg-dim) hover:text-yellow-400")} />
                        </button>
                        {viewingVersion.label && (
                          <span className="text-[10px] font-black text-[#00AEEF] uppercase">{viewingVersion.label}</span>
                        )}
                        <span className="text-[9px] text-(--fg-faint) font-mono">#{viewingVersion.id}</span>
                        {isApplied && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md text-[8px] font-black text-green-400 uppercase tracking-widest">
                            <Check className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </div>
                      {isApplied ? (
                        <span className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" />
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApplyVersion(viewingVersion)}
                          className="px-4 py-1.5 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#00AEEF]/20 transition-all shrink-0"
                        >
                          Apply
                        </button>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-[9px] text-(--fg-dim)">
                      <span>{new Date(viewingVersion.created_at + 'Z').toLocaleString()}</span>
                      {viewingVersion.author && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {viewingVersion.author}
                        </span>
                      )}
                    </div>

                    {/* Full prompt content */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Prompt Content</label>
                      <div className="bg-(--bg-input) border border-(--border) rounded-xl p-5 font-mono text-[11px] text-(--fg-muted) leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto custom-scrollbar">
                        {viewingVersion.content}
                      </div>
                    </div>

                    {/* Comments section */}
                    <div className="space-y-3 border-t border-(--border) pt-5">
                      <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Comments
                      </label>

                      {viewingVersion.notes && (
                        <div className="bg-(--bg-surface) border border-(--border) rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2 text-[9px] text-(--fg-dim)">
                            {viewingVersion.author && (
                              <span className="font-black text-(--fg-label)">{viewingVersion.author}</span>
                            )}
                            <span>{new Date(viewingVersion.created_at + 'Z').toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-(--fg-muted) leading-relaxed">{viewingVersion.notes}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <textarea
                          value={detailNotesText}
                          onChange={(e) => setDetailNotesText(e.target.value)}
                          placeholder={viewingVersion.notes ? "Update comment..." : "Add a comment..."}
                          className="w-full h-20 bg-(--bg-input) border border-(--border) rounded-xl p-3 text-[10px] text-(--fg-muted) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 resize-none transition-all"
                        />
                        <button
                          onClick={() => {
                            if (!detailNotesText.trim()) return;
                            const newNotes = viewingVersion.notes
                              ? `${viewingVersion.notes}\n\n${detailNotesText.trim()}`
                              : detailNotesText.trim();
                            handleUpdateNotes(viewingVersion.id, newNotes);
                            setDetailNotesText('');
                          }}
                          disabled={!detailNotesText.trim()}
                          className="px-4 py-1.5 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#00AEEF]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {viewingVersion.notes ? 'Add Comment' : 'Save Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()

              /* Diff View */
              : showDiff && diffVersions[0] && diffVersions[1] ? (
                <div className="flex-1 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-(--fg-label) uppercase tracking-widest">
                      Comparing: {diffVersions[0].label || `#${diffVersions[0].id}`} vs {diffVersions[1].label || `#${diffVersions[1].id}`}
                    </p>
                  </div>
                  <div className="bg-(--bg-input) rounded-xl p-4 border border-(--border) font-mono text-[10px] leading-relaxed overflow-auto max-h-[50vh]">
                    {computeDiffLines(diffVersions[0].content, diffVersions[1].content).map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "px-2 py-0.5",
                          line.type === 'added' && "bg-green-500/10 text-green-400",
                          line.type === 'removed' && "bg-red-500/10 text-red-400",
                          line.type === 'same' && "text-(--fg-faint)"
                        )}
                      >
                        <span className="select-none mr-2 text-(--fg-dim)">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        {line.text || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              )

              /* List View */
              : (
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#00AEEF] animate-spin" />
                    </div>
                  ) : historyData.length === 0 ? (
                    <div className="text-center py-12 text-(--fg-faint)">
                      <History className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-[11px] font-black uppercase tracking-widest">No versions saved yet</p>
                      <p className="text-[10px] mt-1">Save a prompt to start tracking history</p>
                    </div>
                  ) : (
                    historyData.map((version) => {
                      const isApplied = appliedVersionId === version.id || (appliedVersionId === null && version.content === savedBrandRules);
                      return (
                        <div
                          key={version.id}
                          className={cn(
                            "bg-(--bg-input) border rounded-xl p-4 hover:border-(--border-hover) transition-all group",
                            isApplied ? "border-green-500/30" : "border-(--border)"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Star button */}
                            <button
                              onClick={() => handleToggleStar(version)}
                              className="mt-0.5 shrink-0 transition-colors"
                            >
                              <Star
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  version.starred
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-(--fg-dim) hover:text-yellow-400"
                                )}
                              />
                            </button>

                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => { setViewingVersion(version); setDetailNotesText(''); }}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {version.label && (
                                  <span className="text-[10px] font-black text-[#00AEEF] uppercase">{version.label}</span>
                                )}
                                <span className="text-[9px] text-(--fg-faint) font-mono">#{version.id}</span>
                                {isApplied && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md text-[8px] font-black text-green-400 uppercase tracking-widest">
                                    <Check className="w-2.5 h-2.5" />
                                    Active
                                  </span>
                                )}
                                {version.notes && (
                                  <span className="flex items-center gap-1 text-[9px] text-(--fg-dim)">
                                    <MessageSquare className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-(--fg-label) truncate">{version.content.slice(0, 120)}...</p>
                              <div className="flex items-center gap-3 mt-2 text-[9px] text-(--fg-dim)">
                                <span>{new Date(version.created_at + 'Z').toLocaleString()}</span>
                                {version.author && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {version.author}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setViewingVersion(version); setDetailNotesText(''); }}
                                className="px-3 py-1.5 bg-(--bg-surface) text-(--fg-label) border border-(--border) rounded-lg text-[8px] font-black uppercase tracking-widest hover:text-(--fg-secondary) transition-all flex items-center gap-1"
                              >
                                <Maximize2 className="w-3 h-3" />
                                View
                              </button>
                              <button
                                onClick={() => {
                                  if (diffVersions[0] === null) {
                                    setDiffVersions([version, null]);
                                  } else if (diffVersions[1] === null) {
                                    setDiffVersions([diffVersions[0], version]);
                                    setShowDiff(true);
                                  } else {
                                    setDiffVersions([version, null]);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                  diffVersions[0]?.id === version.id
                                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                    : "bg-(--bg-surface) text-(--fg-label) border-(--border) hover:text-(--fg-secondary)"
                                )}
                              >
                                {diffVersions[0]?.id === version.id ? 'Selected' : 'Compare'}
                              </button>
                              {isApplied ? (
                                <span className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Applied
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleApplyVersion(version)}
                                  className="px-3 py-1.5 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#00AEEF]/20 transition-all"
                                >
                                  Apply
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-(--modal-backdrop) backdrop-blur-sm p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-(--modal-bg) border border-(--border-hover) rounded-3xl p-8 max-w-lg w-full shadow-(--shadow-canvas) space-y-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-[#00AEEF]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-(--fg)">Settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)}>
                  <X className="w-5 h-5 text-(--fg-label) hover:text-(--fg) transition-colors" />
                </button>
              </div>

              {/* Author Name */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Your Name (for version tracking)
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    localStorage.setItem('aiim-author', e.target.value);
                  }}
                  placeholder="Enter your name..."
                  className="w-full bg-(--bg-input) border border-(--border) rounded-xl px-4 py-3 text-xs text-(--fg) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                />
              </div>

              {/* Export / Import */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em] flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5" />
                  Export / Import Config
                </label>
                <p className="text-[10px] text-(--fg-faint) leading-relaxed">
                  Export your current prompt configs and reference images as JSON, or import a config shared by a collaborator.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-(--bg-surface) border border-(--border) rounded-xl text-[10px] font-black text-(--fg-muted) uppercase tracking-widest hover:bg-(--bg-surface-hover) transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-(--bg-surface) border border-(--border) rounded-xl text-[10px] font-black text-(--fg-muted) uppercase tracking-widest hover:bg-(--bg-surface-hover) transition-all"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Import
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </div>
              </div>

              {/* Brand Info */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-(--fg-faint) uppercase tracking-[0.2em]">Active Brand</label>
                <div className="flex items-center gap-3 bg-(--bg-input) rounded-xl p-4 border border-(--border)">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                    style={{ backgroundColor: BRANDS[selectedBrand].color }}
                  >
                    {BRANDS[selectedBrand].name[0]}
                  </div>
                  <span className="text-[11px] font-black text-(--fg) uppercase tracking-widest">{BRANDS[selectedBrand].name}</span>
                  <span className="ml-auto text-[9px] font-mono text-(--fg-faint)">{BRANDS[selectedBrand].color}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Editor Modal */}
      <AnimatePresence>
        {showExpandedEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-(--modal-backdrop) backdrop-blur-md p-4 sm:p-8"
            onClick={() => setShowExpandedEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-(--modal-bg) border border-(--border-hover) rounded-3xl p-6 sm:p-8 w-full max-w-4xl h-[85vh] flex flex-col shadow-(--shadow-canvas)"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#00AEEF]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-(--fg)">Design Logic</h2>
                  <span className="text-[9px] font-bold text-(--fg-faint) uppercase tracking-widest bg-(--bg-surface) px-2.5 py-1 rounded-md border border-(--border)">
                    {BRANDS[selectedBrand].name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowHistory(true);
                      loadHistory(selectedBrand);
                    }}
                    className="text-[9px] font-black text-(--fg-label) hover:text-[#00AEEF] uppercase tracking-widest transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-(--bg-surface)"
                  >
                    <History className="w-3 h-3" />
                    History
                  </button>
                  <button
                    onClick={() => setBrandRules(savedBrandRules)}
                    className="text-[9px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-widest transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-[#00AEEF]/5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  {brandRules !== savedBrandRules && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/5 border border-yellow-500/15 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-[8px] font-black text-yellow-400/80 uppercase tracking-widest">Unsaved</span>
                    </div>
                  )}
                  <button onClick={() => setShowExpandedEditor(false)} className="ml-2">
                    <X className="w-5 h-5 text-(--fg-label) hover:text-(--fg) transition-colors" />
                  </button>
                </div>
              </div>

              {/* Full-size textarea */}
              <textarea
                value={brandRules}
                onChange={(e) => setBrandRules(e.target.value)}
                className={cn(
                  "flex-1 w-full bg-(--bg-input) border rounded-2xl p-6 text-[12px] font-mono text-(--fg-muted) focus:ring-1 focus:ring-[#00AEEF]/50 outline-none resize-none leading-relaxed transition-all hover:border-(--border-hover)",
                  brandRules !== savedBrandRules ? "border-yellow-500/20" : "border-(--border)"
                )}
                autoFocus
              />

              {/* Save controls */}
              <div className="mt-4 space-y-3 shrink-0">
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Notes about this change (optional)..."
                  className="w-full h-14 bg-(--bg-input) border border-(--border) rounded-xl p-3 text-[10px] text-(--fg-label) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 resize-none transition-all"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder="Version label (optional)..."
                    className="flex-1 bg-(--bg-input) border border-(--border) rounded-xl px-4 py-2.5 text-[10px] text-(--fg-muted) placeholder:text-(--fg-dim) focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                  />
                  <button
                    onClick={handleSavePrompt}
                    disabled={isSaving}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                      saveSuccess
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 hover:bg-[#00AEEF]/20"
                    )}
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : saveSuccess ? <Check className="w-3.5 h-3.5" />
                      : <Save className="w-3.5 h-3.5" />}
                    {saveSuccess ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
