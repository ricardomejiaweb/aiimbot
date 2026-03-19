import React, { useState, useCallback, useEffect } from 'react';
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
  Plus,
  Search,
  Globe,
  Info,
  Layers,
  Check,
  Tag,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play
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
    color: '#00a6e4',
    rules: `Role: You are a Senior Brand Designer for Acopa Tableware. Create high-end, catalog-style product graphics that are minimal, refined, and product-focused. The product must be the dominant visual element (60–80% weight).

Brand Colors:
- Blue: #00a6e4
- Light Blue: #01aeef
- White: #ffffff
- Black: #231f20
- Gray: #b2b0b1
- Dark Gray: #838383

Design Guidelines:
- Palette: Use a sophisticated mix of Slate, Charcoal, and White. 
- Layout: Use clean geometric sections (Vertical panels, bottom bands, or split backgrounds).
- Background: White (#ffffff) or a mix of White and Blue (#00a6e4) with clean 30/70 or 50/50 splits.
- Logo: Place only on the White sections.
- Footer: Use for feature icons. Either a Blue band with White icons or a White background with a Dark Gray divider and Blue icons.

Typography & Copy:
- Style: Classic, high-contrast Serif for headings.
- Hook: Elegant, editorial, and concise (max 10 words).
- Features: Clear and brief (2–6 words).

Output Types:
1. Hero (Template C): Focus on the product with a single hook. No icons. Hook sits on the Blue panel if present.
2. Feature Highlight (Template B): Max 2–3 icons. Use subtle Blue circular callouts with white text.
3. Dimensions Highlight (Template A): Minimal gray dimension lines (#b2b0b1) with Black Serif labels in Black circles.

Execution Strategy:
- Prioritize clean, premium catalog design.
- Use one clear layout strategy (e.g., LEFT_PANEL, BOTTOM_BAND, or SPLIT_HALF).
- Ensure professional lighting and realistic shadows for the product.`,
    defaultReferences: [
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample3.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample2.png',
      'https://www.webstaurantstore.com/uploads/images/2026/3/acopa-sample1.png'
    ]
  }
};

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
    if (pattern.test(text)) {
      activeFlags.push(label);
    }
  }

  return activeFlags;
}

export default function App() {
  const [referenceImgs, setReferenceImgs] = useState<ImageState[]>([]);
  const [productImg, setProductImg] = useState<ImageState>({ file: null, preview: null });
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [currentScrapedImgIdx, setCurrentScrapedImgIdx] = useState(0);
  const [showFeatures, setShowFeatures] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('acopa');
  const [brandRules, setBrandRules] = useState(BRANDS.acopa.rules);
  const [assetType, setAssetType] = useState<AssetType>('hero');
  const [imageSize, setImageSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

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
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const onDropProduct = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setProductImg({
        file,
        preview: URL.createObjectURL(file)
      });
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
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerate = async () => {
    if (!productImg.file) {
      setError("Please upload a product image.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Use API_KEY (user-selected) or GEMINI_API_KEY (default)
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No API key found. Please select an API key.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let refParts: any[] = [];
      
      if (referenceImgs.length > 0) {
        refParts = await Promise.all(referenceImgs.map(async (img) => {
          const base64 = await fileToBase64(img.file!);
          return {
            inlineData: {
              data: base64,
              mimeType: img.file!.type,
            },
          };
        }));
      } else {
        // Use default references for the brand
        const defaults = BRANDS[selectedBrand].defaultReferences;
        refParts = await Promise.all(defaults.map(async (url) => {
          const base64 = await urlToBase64(url);
          return {
            inlineData: {
              data: base64,
              mimeType: 'image/jpeg',
            },
          };
        }));
      }

      const prodBase64 = await fileToBase64(productImg.file);

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            ...refParts,
            {
              inlineData: {
                data: prodBase64,
                mimeType: productImg.file.type,
              },
            },
            {
              text: `Reference Images: The first ${refParts.length} images are the layout and style guides.
Product Image: The last image is the raw product to be inserted.
${scrapedData ? `Product Title: ${scrapedData.title}` : ''}
Selected Output Type: ${assetType.toUpperCase()}
${prompt}`,
            },
          ],
        },
        config: {
          systemInstruction: brandRules + "\n\nContext: Analyze all provided reference images to understand the consistent layout, lighting, and shadow styles of the brand.",
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: imageSize
          }
        },
      });

      let foundImage = false;
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            setResultImage(imageUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("No image was generated in the response.");
      }
    } catch (err: any) {
      console.error(err);
      // Handle 403 Permission Denied or other key-related errors
      if (err.message?.includes("403") || err.message?.includes("PERMISSION_DENIED") || err.message?.includes("Requested entity was not found")) {
        setError("Permission Denied (403). This model requires a paid/preview API key. Please select a valid API key from your Google Cloud project.");
        setHasApiKey(false);
      } else {
        setError(err.message || "An error occurred during generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!resultImage || !refinementPrompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No API key found. Please select an API key.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Convert current resultImage (data URL) to base64
      const currentImageBase64 = resultImage.split(',')[1];
      const mimeType = resultImage.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: currentImageBase64,
                mimeType: mimeType,
              },
            },
            {
              text: `Refinement Task: Modify the provided image based on these instructions: ${refinementPrompt}. 
Maintain the brand consistency (Colors: ${BRANDS[selectedBrand].color}, Style: ${selectedBrand.toUpperCase()}). 
The original product should remain the focus.`,
            },
          ],
        },
        config: {
          systemInstruction: brandRules + "\n\nYou are refining an existing marketing asset. Follow the user's instructions precisely while maintaining brand integrity.",
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: imageSize
          }
        },
      });

      let foundImage = false;
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            setResultImage(imageUrl);
            setRefinementPrompt(''); // Clear prompt on success
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("No image was generated in the refinement response.");
      }
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
      setCurrentScrapedImgIdx(0);
      setShowFeatures(false);
      
      // Auto-select best image (prefer white background/PNG if identifiable)
      if (data.galleryImages && data.galleryImages.length > 0) {
        // Try to find a "white" background image or a PNG if possible, otherwise default to first
        const bestImage = data.galleryImages.find(url => 
          url.toLowerCase().includes('white') || 
          url.toLowerCase().includes('transparent') ||
          url.toLowerCase().endsWith('.png')
        ) || data.galleryImages[0];
        
        selectScrapedImage(bestImage);
      }
      
      // Auto-generate a concise expert prompt
      const keySpec = data.specs['Capacity'] || data.specs['Top Diameter'] || data.specs['Height'] || Object.values(data.specs)[0] || "";
      
      // Use first feature detail if available for the hook
      const firstFeature = data.featureDetails && Object.keys(data.featureDetails).length > 0 
        ? Object.keys(data.featureDetails)[0] 
        : (data.features[0] || "");

      const newPrompt = ``;
      
      setPrompt(newPrompt);
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
    } catch (err) {
      setError("Failed to select image");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00AEEF]/30">
      {/* Header */}
      <header className="bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-[#00AEEF] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-11 h-11 bg-[#00AEEF] rounded-xl flex items-center justify-center shadow-2xl">
              <Sparkles className="text-white w-6 h-6" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic">AIIM Bot<span className="text-[#00AEEF]">.</span></h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {!hasApiKey && (
            <button 
              onClick={openKeyDialog}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00AEEF]/10 text-[#00AEEF] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#00AEEF]/20 hover:bg-[#00AEEF]/20 transition-all active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              Connect API
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 space-y-12">
          {/* Brand Configuration */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-gray-500">
                <Tag className="w-4 h-4" />
                <h2 className="font-black uppercase tracking-[0.3em] text-[10px]">Brand Identity</h2>
              </div>
              <div className="h-[1px] flex-1 bg-white/5 ml-4" />
            </div>
            <div className="bg-[#0A0A0A] rounded-[2.5rem] border border-white/5 p-6 md:p-10 space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00AEEF]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[#00AEEF]/10 transition-colors" />
              
              <div className="space-y-4 relative">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Active Profile</label>
                <div className="grid grid-cols-1 gap-3">
                  {(Object.keys(BRANDS) as BrandKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedBrand(key);
                        setBrandRules(BRANDS[key].rules);
                      }}
                      className={cn(
                        "flex items-center gap-5 p-5 rounded-2xl border transition-all duration-300 active:scale-[0.98]",
                        selectedBrand === key 
                          ? "border-[#00AEEF]/50 bg-[#00AEEF]/10 text-white shadow-[0_0_30px_rgba(0,174,239,0.1)]" 
                          : "border-white/5 hover:border-white/10 text-gray-500 hover:bg-white/5"
                      )}
                    >
                      <div 
                        className="w-5 h-5 rounded-lg shadow-2xl flex items-center justify-center text-[10px] font-black text-white" 
                        style={{ backgroundColor: BRANDS[key].color }}
                      >
                        {BRANDS[key].name[0]}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest">{BRANDS[key].name}</span>
                      {selectedBrand === key && (
                        <motion.div layoutId="active-brand" className="ml-auto">
                          <Check className="w-4 h-4 text-[#00AEEF]" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Design Logic
                  </label>
                  <button 
                    onClick={() => setBrandRules(BRANDS[selectedBrand].rules)}
                    className="text-[9px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-widest transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-3 h-3" />
                    Reset
                  </button>
                </div>
                <div className="relative group/textarea">
                  <textarea 
                    value={brandRules}
                    onChange={(e) => setBrandRules(e.target.value)}
                    className="w-full h-56 bg-black/40 border border-white/5 rounded-2xl p-5 text-[11px] font-mono text-gray-400 focus:ring-1 focus:ring-[#00AEEF]/50 outline-none resize-none leading-relaxed transition-all group-hover/textarea:border-white/10"
                  />
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                    <div className="px-2 py-1 bg-white/5 rounded text-[8px] font-bold text-gray-600 border border-white/5 uppercase">Editable</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Asset Configuration */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-gray-500">
                <Layers className="w-4 h-4" />
                <h2 className="font-black uppercase tracking-[0.3em] text-[10px]">Asset Specs</h2>
              </div>
              <div className="h-[1px] flex-1 bg-white/5 ml-4" />
            </div>

            <div className="bg-[#0A0A0A] rounded-[2.5rem] border border-white/5 p-6 md:p-10 space-y-8 shadow-2xl">
              <div className="grid grid-cols-2 gap-4">
                {(['hero', 'feature', 'dimensions'] as AssetType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAssetType(type)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 text-center space-y-2 active:scale-[0.98]",
                      assetType === type 
                        ? "border-[#00AEEF]/50 bg-[#00AEEF]/10 text-white" 
                        : "border-white/5 hover:border-white/10 text-gray-500 hover:bg-white/5"
                    )}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest">{type}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Output Resolution</label>
                <div className="flex gap-2">
                  {(['1K', '2K', '4K'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={cn(
                        "flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        imageSize === size 
                          ? "border-[#00AEEF]/50 bg-[#00AEEF]/10 text-white" 
                          : "border-white/5 hover:border-white/10 text-gray-500"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Studio Canvas */}
        <div className="lg:col-span-8 space-y-12">
          {/* Data Extraction Bar */}
          <div className="bg-[#0A0A0A] rounded-[2rem] border border-white/5 p-2 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-2xl">
            <div className="flex-1 relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#00AEEF] transition-colors" />
              <input 
                type="text" 
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="Paste WebstaurantStore URL..."
                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#00AEEF]/30 transition-all"
              />
            </div>
            <button 
              onClick={handleScrape}
              disabled={isScraping || !scrapeUrl}
              className="bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Extract
            </button>
          </div>


          {/* Main Studio Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Input Stack */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-gray-500">
                  <Upload className="w-4 h-4" />
                  <h2 className="font-black uppercase tracking-[0.3em] text-[10px]">Source Assets</h2>
                </div>
                
                <div className="space-y-4">
                  {/* Product Upload */}
                  <div {...getProdRootProps()} className={cn(
                    "aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group relative overflow-hidden",
                    isProdDragActive ? "border-[#00AEEF] bg-[#00AEEF]/5" : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                  )}>
                    <input {...getProdInputProps()} />
                    {productImg.preview ? (
                      <div className="w-full h-full relative">
                        <img src={productImg.preview} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductImg({ file: null, preview: null });
                          }}
                          className="absolute top-4 right-4 w-8 h-8 bg-black/80 rounded-full flex items-center justify-center hover:bg-black transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-gray-600" />
                        </div>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Product Image</p>
                      </>
                    )}
                  </div>

                  {/* Extracted Gallery */}
                  {scrapedData && scrapedData.galleryImages.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Extracted Gallery</label>
                        <span className="text-[8px] font-bold text-gray-700 uppercase">{scrapedData.galleryImages.length} Assets</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {scrapedData.galleryImages.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectScrapedImage(url)}
                            className={cn(
                              "aspect-square rounded-xl border-2 overflow-hidden transition-all relative group",
                              productImg.preview === url 
                                ? "border-[#00AEEF] ring-4 ring-[#00AEEF]/10" 
                                : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                            )}
                          >
                            <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            {productImg.preview === url && (
                              <div className="absolute inset-0 bg-[#00AEEF]/20 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reference Uploads */}
                  <div className="grid grid-cols-2 gap-4">
                    {referenceImgs.map((img, idx) => (
                      <div key={idx} className="aspect-square rounded-2xl border border-white/5 bg-white/[0.02] relative group overflow-hidden">
                        <img src={img.preview} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => removeReferenceImg(idx)}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {referenceImgs.length < 4 && (
                      <div {...getRefRootProps()} className="aspect-square rounded-2xl border-2 border-dashed border-white/5 hover:border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                        <input {...getRefInputProps()} />
                        <ImageIcon className="w-5 h-5 text-gray-700" />
                        <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest">Ref {referenceImgs.length + 1}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Prompting
                </label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-40 bg-black/40 border border-white/5 rounded-2xl p-5 text-[11px] text-gray-400 focus:ring-1 focus:ring-[#00AEEF]/50 outline-none resize-none leading-relaxed transition-all"
                  placeholder="Describe the marketing angle..."
                />
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !productImg.file}
                  className="w-full bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(0,174,239,0.2)] active:scale-95"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Generate Studio Asset
                </button>
              </div>
            </div>

            {/* Canvas Preview Area */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#00AEEF]">
                  <Maximize2 className="w-4 h-4" />
                  <h2 className="font-black uppercase tracking-[0.3em] text-[10px]">Studio Canvas</h2>
                </div>
                {resultImage && (
                  <a 
                    href={resultImage} 
                    download="brandengine-asset.png"
                    className="flex items-center gap-3 text-[10px] font-black text-[#00AEEF] hover:text-[#0096ce] uppercase tracking-[0.2em] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export 4K
                  </a>
                )}
              </div>

              <div className="relative aspect-square bg-[#080808] rounded-[3.5rem] border border-white/5 shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center group">
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-8 p-12 text-center relative z-10"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 border-2 border-[#00AEEF]/10 border-t-[#00AEEF] rounded-full animate-spin" />
                        <Sparkles className="w-10 h-10 text-[#00AEEF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">Rendering Asset</h3>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest leading-relaxed max-w-[240px]">Applying brand logic • Matching lighting • 4K Upscaling</p>
                      </div>
                    </motion.div>
                  ) : resultImage ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full h-full relative z-10 p-12"
                    >
                      <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/5">
                        <img src={resultImage} alt="Generated Asset" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-8 text-gray-800 p-12 text-center relative z-10"
                    >
                      <div className="w-32 h-32 rounded-[2.5rem] bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:scale-105 transition-transform duration-500">
                        <ImageIcon className="w-12 h-12 opacity-10" />
                      </div>
                      <div className="space-y-3">
                        <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.3em]">Awaiting Generation</p>
                        <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest max-w-[240px] leading-relaxed">Configure brand rules and provide inputs to begin studio rendering</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {resultImage && !isGenerating && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl"
                >
                  <div className="flex items-center gap-3 text-[#00AEEF]">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Refine Generation</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative group">
                      <input 
                        type="text"
                        value={refinementPrompt}
                        onChange={(e) => setRefinementPrompt(e.target.value)}
                        placeholder="e.g. 'Make the text larger'..."
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#00AEEF]/30 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      />
                    </div>
                    <button 
                      onClick={handleRefine}
                      disabled={!refinementPrompt.trim() || isGenerating}
                      className="bg-[#00AEEF] hover:bg-[#0096ce] disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Refine
                    </button>
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="bg-[#050505] border-t border-white/5 py-12 sm:py-16 mt-12 sm:mt-24">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-12 flex flex-col md:flex-row items-center justify-between gap-12 text-gray-700">
          <div className="flex items-center gap-5">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
              <Sparkles className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">AIIM Bot Studio</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-700">© 2026 Professional v1.2</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {scrapedData ? (
              detectFlags(scrapedData).map((flag, idx) => (
                <span key={idx} className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-gray-500 transition-colors cursor-default">
                  {flag}
                </span>
              ))
            ) : (
              <>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-gray-500 transition-colors cursor-default">Durable Stoneware</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-gray-500 transition-colors cursor-default">Dishwasher Safe</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-gray-500 transition-colors cursor-default">Microwave Safe</span>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
