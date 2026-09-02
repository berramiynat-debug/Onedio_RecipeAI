import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../config';

export interface ExtractedRecipe {
  is_recipe: boolean;
  title: string;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: {
    amount: number | null;
    unit: string | null;
    name: string;
  }[];
  steps: string[];
  confidence_map: {
    title: 'high' | 'low' | 'missing';
    servings: 'high' | 'low' | 'missing';
    prep_time: 'high' | 'low' | 'missing';
    cook_time: 'high' | 'low' | 'missing';
    ingredients: 'high' | 'low' | 'missing';
    steps: 'high' | 'low' | 'missing';
  };
}

const confidenceValue = z.union([z.enum(['high', 'medium', 'low', 'missing']), z.string()]).transform((v) => {
  if (v === 'high') return 'high' as const;
  if (v === 'missing') return 'missing' as const;
  return 'low' as const;
});

const recipeZodSchema = z.object({
  is_recipe: z.boolean(),
  title: z.string().nullable().optional().transform(val => (val && val.trim() ? val : 'Nefis Yemek Tarifi')),
  servings: z.number().nullable().optional().transform(val => val ?? null),
  prep_time: z.number().nullable().optional().transform(val => val ?? null),
  cook_time: z.number().nullable().optional().transform(val => val ?? null),
  ingredients: z.array(z.object({
    amount: z.number().nullable().optional().transform(val => val ?? null),
    unit: z.string().nullable().optional().transform(val => val ?? null),
    name: z.string().nullable().optional().transform(val => (val && val.trim() ? val : 'Malzeme'))
  })).optional().transform(val => val || []),
  steps: z.array(z.string()).optional().transform(val => val || []),
  confidence_map: z.object({
    title: confidenceValue,
    servings: confidenceValue,
    prep_time: confidenceValue,
    cook_time: confidenceValue,
    ingredients: confidenceValue,
    steps: confidenceValue,
  }).optional().transform(val => val || {
    title: 'low' as const,
    servings: 'missing' as const,
    prep_time: 'missing' as const,
    cook_time: 'missing' as const,
    ingredients: 'low' as const,
    steps: 'low' as const
  })
});

const SYSTEM_INSTRUCTION = `
Aşağıda verilen ham metni analiz et ve içerisinden yemek tarifini çıkar.

KURALLAR:
1. Çıktı dili tamamen Türkçe olmalıdır. Kaynak metin yabancı dilde olsa bile malzemeleri ve adımları Türkçe'ye çevir. (FR-12)
2. Malzeme miktarlarında ve birimlerinde imperial ölçüleri Türkçe mutfak ölçülerine çevir. (FR-13)
3. Metin bir yemek tarifi içermiyorsa (örneğin sadece restoran yorumu, gezi vlogu veya alakasız bir yazıysa), is_recipe alanını kesinlikle false olarak işaretle. (FR-10)
4. Eğer metin içerisinde "=== VİDEO KONUŞMA METNİ (TRANSKRİPT) ===" başlığı altında video transkripti yer alıyorsa, tarif malzemelerini ve adımları bu konuşma akışından da çıkarabilirsin. Konuşmadaki tekrarları, zaman damgalarını (örn: [0:05]) ve dağınık/sohbet tarzı ifadeleri temizleyerek nizami bir tarif formatına dönüştür.
5. Çıktı kesinlikle ve YALNIZCA aşağıdaki JSON yapısına uyan geçerli bir JSON objesi olmalıdır:

{
  "is_recipe": true,
  "title": "Tarifin Adı",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 20,
  "ingredients": [
    { "amount": 1, "unit": "adet", "name": "soğan" }
  ],
  "steps": ["1. Adım", "2. Adım"],
  "confidence_map": {
    "title": "high",
    "servings": "high",
    "prep_time": "missing",
    "cook_time": "missing",
    "ingredients": "high",
    "steps": "high"
  }
}
`;

/**
 * Ham metinden yapay zeka (Groq / Gemini) kullanarak Türkçe tarif verilerini ayıklar
 */
export async function extractRecipeFromText(text: string): Promise<ExtractedRecipe> {
  const groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
  const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    throw new Error('system_error: Neither GROQ_API_KEY nor GEMINI_API_KEY is configured.');
  }

  try {
    let responseText = '';

    if (groqApiKey) {
      // Groq Cloud openai/gpt-oss-120b kullanımı
      const groq = new Groq({ apiKey: groqApiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: text }
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      responseText = chatCompletion.choices[0]?.message?.content || '';
    } else if (geminiApiKey) {
      // Gemini API Fallback
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: text,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      responseText = response.text || '';
    }

    if (!responseText) {
      throw new Error('LLM returned an empty response.');
    }

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedJson = JSON.parse(cleanJson);
    const recipe = recipeZodSchema.parse(parsedJson) as ExtractedRecipe;
    
    // Halüsinasyon kontrolü
    const validatedRecipe = validateHallucinations(recipe, text);
    
    return validatedRecipe;
  } catch (error: any) {
    throw new Error(`system_error: LLM extraction failed. Details: ${error.message}`);
  }
}

/**
 * Kaynak metinde geçmeyen sayısal miktarları ve süreleri tespit eder
 */
function validateHallucinations(recipe: ExtractedRecipe, sourceText: string): ExtractedRecipe {
  const numberRegex = /\b\d+(?:[.,]\d+)?\b/g;
  const sourceNumbers = new Set<string>();
  let match;
  while ((match = numberRegex.exec(sourceText)) !== null) {
    const cleanedNum = parseFloat(match[0].replace(',', '.')).toString();
    sourceNumbers.add(cleanedNum);
  }

  const checkNumber = (val: number | null | undefined, field: keyof ExtractedRecipe['confidence_map']) => {
    if (val !== null && val !== undefined) {
      const parsedVal = val.toString();
      if (!sourceNumbers.has(parsedVal)) {
        recipe.confidence_map[field] = 'low';
      }
    }
  };

  checkNumber(recipe.servings, 'servings');
  checkNumber(recipe.prep_time, 'prep_time');
  checkNumber(recipe.cook_time, 'cook_time');

  if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
    let hasHallucinatedAmount = false;
    for (const ing of recipe.ingredients) {
      if (ing.amount !== null && ing.amount !== undefined) {
        const parsedAmount = ing.amount.toString();
        if (!sourceNumbers.has(parsedAmount)) {
          hasHallucinatedAmount = true;
          break;
        }
      }
    }
    if (hasHallucinatedAmount) {
      recipe.confidence_map.ingredients = 'low';
    }
  }

  return recipe;
}

/**
 * Ekran görüntüsünden (base64) yapay zeka (Groq Vision / Gemini) kullanarak Türkçe tarif verilerini ayıklar
 */
export async function extractRecipeFromImage(base64Data: string, mimeType: string): Promise<ExtractedRecipe> {
  const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('system_error: GEMINI_API_KEY sunucuda tanımlı değil. Lütfen Render Environment ayarlarından GEMINI_API_KEY ekleyin.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        'Aşağıdaki ekran görüntüsünde yer alan yazıları (OCR) oku, tarif metnini bul ve Türkçe yemek tarifi JSON verisi olarak çıkar.'
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const responseText = response.text || '';

    if (!responseText) {
      throw new Error('LLM returned an empty response.');
    }

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedJson = JSON.parse(cleanJson);
    const recipe = recipeZodSchema.parse(parsedJson) as ExtractedRecipe;
    
    // Halüsinasyon denetimini JSON'daki başlık metnine göre yapıyoruz
    const validatedRecipe = validateHallucinations(recipe, recipe.title);
    
    return validatedRecipe;
  } catch (error: any) {
    throw new Error(`system_error: LLM image extraction failed. Details: ${error.message}`);
  }
}
