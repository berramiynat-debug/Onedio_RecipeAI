import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../config';

// Gemini istemcisini ilklendir
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

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

// Gemini modelinin uymak zorunda olduğu JSON Şeması
const recipeSchema = {
  type: 'object',
  properties: {
    is_recipe: {
      type: 'boolean',
      description: 'Metin gerçek bir yemek/içecek tarifi içeriyorsa true, sadece restoran incelemesi, sohbet veya alakasız bir konu ise false olmalıdır.'
    },
    title: { 
      type: 'string', 
      description: 'Tarifin Türkçe adı.' 
    },
    servings: { 
      type: 'integer', 
      description: 'Porsiyon sayısı (kişi sayısı). Kaynakta belirtilmemişse null bırakılmalıdır.',
      nullable: true 
    },
    prep_time: { 
      type: 'integer', 
      description: 'Dakika cinsinden hazırlık süresi. Kaynakta belirtilmemişse null bırakılmalıdır.',
      nullable: true 
    },
    cook_time: { 
      type: 'integer', 
      description: 'Dakika cinsinden pişirme süresi. Kaynakta belirtilmemişse null bırakılmalıdır.',
      nullable: true 
    },
    ingredients: {
      type: 'array',
      description: 'Tarif malzemeleri listesi.',
      items: {
        type: 'object',
        properties: {
          amount: { 
            type: 'number', 
            description: 'Miktar değeri (sayı olarak, örn: 1, 2.5, 0.5). Belirtilmemişse null bırakılmalıdır.',
            nullable: true 
          },
          unit: { 
            type: 'string', 
            description: 'Miktar birimi. Örn: "su bardağı", "yemek kaşığı", "gram", "adet", "diş". Belirtilmemişse null veya boş string bırakılmalıdır.',
            nullable: true 
          },
          name: { 
            type: 'string', 
            description: 'Malzemenin adı (örn: un, kuru soğan, zeytinyağı).' 
          }
        },
        required: ['name']
      }
    },
    steps: {
      type: 'array',
      description: 'Tarif adımlarının sırasıyla listesi.',
      items: { type: 'string' }
    },
    confidence_map: {
      type: 'object',
      description: 'Her bir alan için yapay zekanın güven derecesini belirtir.',
      properties: {
        title: { type: 'string', enum: ['high', 'low', 'missing'] },
        servings: { type: 'string', enum: ['high', 'low', 'missing'] },
        prep_time: { type: 'string', enum: ['high', 'low', 'missing'] },
        cook_time: { type: 'string', enum: ['high', 'low', 'missing'] },
        ingredients: { type: 'string', enum: ['high', 'low', 'missing'] },
        steps: { type: 'string', enum: ['high', 'low', 'missing'] }
      },
      required: ['title', 'servings', 'prep_time', 'cook_time', 'ingredients', 'steps']
    }
  },
  required: ['is_recipe', 'title', 'ingredients', 'steps', 'confidence_map']
};

const recipeZodSchema = z.object({
  is_recipe: z.boolean(),
  title: z.string(),
  servings: z.number().nullable(),
  prep_time: z.number().nullable(),
  cook_time: z.number().nullable(),
  ingredients: z.array(z.object({
    amount: z.number().nullable(),
    unit: z.string().nullable(),
    name: z.string()
  })),
  steps: z.array(z.string()),
  confidence_map: z.object({
    title: z.enum(['high', 'low', 'missing']),
    servings: z.enum(['high', 'low', 'missing']),
    prep_time: z.enum(['high', 'low', 'missing']),
    cook_time: z.enum(['high', 'low', 'missing']),
    ingredients: z.enum(['high', 'low', 'missing']),
    steps: z.enum(['high', 'low', 'missing']),
  })
});

/**
 * Ham metinden yapay zeka kullanarak Türkçe tarif verilerini ayıklar (FR-7 - FR-14)
 */
export async function extractRecipeFromText(text: string): Promise<ExtractedRecipe> {
  if (!config.geminiApiKey) {
    throw new Error('system_error: Gemini API Key is missing in the configuration.');
  }

  const systemInstruction = `
Aşağıda verilen ham metni analiz et ve içerisinden yemek tarifini çıkar.

KURALLAR:
1. Çıktı dili tamamen Türkçe olmalıdır. Kaynak metin yabancı dilde olsa bile malzemeleri ve adımları Türkçe'ye çevir. (FR-12)
2. Malzeme miktarlarında ve birimlerinde "imperial" ölçüleri (örneğin: cups, oz, lbs, Fahrenheit) Türkçe mutfak ölçülerine (su bardağı, yemek kaşığı, gram, ml, Derece) çevir. Eğer dönüşüm belirsizse orijinal birimi koru ve o malzemenin confidence_map değerini 'low' yap. (FR-13)
3. Türkçe karşılığı olmayan malzemeleri uydurma çeviri yapmak yerine orijinal adı ve parantez içinde kısa bir açıklamasıyla bırak (Örn: "Maple Syrup (Akçaağaç Şurubu)"). (FR-14)
4. Kaynak metinde belirtilmeyen hiçbir miktar, süre veya porsiyon bilgisini uydurma (Halüsinasyon yasak!). Kaynakta yoksa null bırak ve confidence_map değerini 'missing' yap. (FR-9)
5. Metin bir yemek tarifi içermiyorsa (örneğin sadece restoran yorumu, gezi vlogu veya alakasız bir yazıysa), is_recipe alanını kesinlikle false olarak işaretle. (FR-10)
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: recipeSchema as any,
        temperature: 0.1 // Daha kararlı ve tutarlı çıktılar için düşük sıcaklık
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('LLM returned an empty response.');
    }

    const parsedJson = JSON.parse(responseText);
    const recipe = recipeZodSchema.parse(parsedJson) as ExtractedRecipe;
    return recipe;
  } catch (error: any) {
    throw new Error(`system_error: LLM extraction failed. Details: ${error.message}`);
  }
}
