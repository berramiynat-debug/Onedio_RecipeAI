import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { canonicalizeUrl, isAllowedDomain, resolveRedirectsSafely } from '../services/urlService';
import { jobRepo } from '../database/repos';
import { scrapeUrl } from '../services/scraperService';
import { extractRecipeFromText } from '../services/llmService';
import { config } from '../config';

// Sabit demo kullanıcı ID'si (Bölüm 5.2 - Tek kullanıcılı demo)
const DEMO_USER_ID = 1;

/**
 * Arka planda çalışacak olan tarif çekme ve çıkarma işçisi (Background Worker)
 */
async function runImportJob(jobId: string, initialUrl: string) {
  try {
    // 1. Durumu processing yap (sub_status: fetching)
    await jobRepo.updateJobStatus(jobId, 'processing', 'fetching');

    // 2. Kısa linkleri çöz (TikTok vb.) ve SSRF doğrulaması yap (SEC-3)
    const resolvedUrl = await resolveRedirectsSafely(initialUrl);

    // 3. Linki sadeleştir (Canonicalize)
    const canonicalUrl = canonicalizeUrl(resolvedUrl);

    // 4. İçerik toplama (Scraping)
    const scrapedData = await scrapeUrl(canonicalUrl);

    // 5. Durumu güncelle (sub_status: extracting)
    await jobRepo.updateJobStatus(jobId, 'processing', 'extracting');

    let recipeData: any;

    if (config.geminiApiKey) {
      // 6. LLM ile tarif çıkarma
      const recipe = await extractRecipeFromText(scrapedData.content);

      // Eğer tarif değilse reddet (FR-10)
      if (!recipe.is_recipe) {
        throw new Error('no_recipe: Metinde yemek tarifi bulunamadı.');
      }

      // Orijinal kaynak atıflarını güvenilir metadata'dan ezerek eşle (SEC-6, FR-16)
      recipeData = {
        ...recipe,
        platform: scrapedData.platform,
        author: scrapedData.author,
        original_url: scrapedData.originalUrl
      };
    } else {
      // Şimdilik API anahtarı eklenmemişse 1. Hafta fallback mock verisi oluştur
      recipeData = {
        title: scrapedData.title,
        servings: 4,
        prep_time: 15,
        cook_time: 20,
        platform: scrapedData.platform,
        author: scrapedData.author,
        original_url: scrapedData.originalUrl,
        confidence_map: {
          title: 'high',
          ingredients: 'low',
          steps: 'low'
        },
        ingredients: [
          { amount: 1, unit: 'adet', name: 'Örnek Malzeme (Yapay Zeka API Anahtarı Bekleniyor)' }
        ],
        steps: [
          'Kaynak gönderinin açıklaması okundu. Gemini API Anahtarı .env dosyasında eksik olduğu için mock tarif döndürüldü.',
          `Ham İçerik: ${scrapedData.content.substring(0, 150)}...`
        ]
      };
    }

    // 7. İşlemi tamamla (ready_for_review)
    await jobRepo.updateJobStatus(
      jobId, 
      'ready_for_review', 
      null, 
      null, 
      null, 
      recipeData
    );

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error.message);

    // Hata sınıflandırması (Taksonomi - Bölüm 6)
    let errorClass: 'invalid_input' | 'inaccessible' | 'no_recipe' | 'system_error' = 'system_error';
    let errorMessage = error.message || 'Bilinmeyen bir sistem hatası oluştu.';

    if (error.message.includes('inaccessible')) {
      errorClass = 'inaccessible';
      errorMessage = 'Gönderiye erişilemedi (Hesap gizli veya gönderi silinmiş olabilir).';
    } else if (error.message.includes('SSRF')) {
      errorClass = 'invalid_input';
      errorMessage = 'Güvenlik nedeniyle bu URL adresine erişim engellendi.';
    } else if (error.message.includes('no_recipe')) {
      errorClass = 'no_recipe';
      errorMessage = 'Bu içerikte yemek tarifi bulamadık (Restoran incelemesi veya alakasız içerik).';
    }

    await jobRepo.updateJobStatus(jobId, 'failed', null, errorClass, errorMessage);
  }
}

export const importController = {
  /**
   * POST /api/import
   * Yeni bir tarif içe aktarma talebi oluşturur
   */
  async startImport(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        res.status(400).json({ 
          error_class: 'invalid_input', 
          message: 'Lütfen geçerli bir URL adresi gönderin.' 
        });
        return;
      }

      // 1. Alan adı izinli mi kontrol et (FR-1)
      if (!isAllowedDomain(url)) {
        res.status(400).json({ 
          error_class: 'invalid_input', 
          message: 'Desteklenmeyen bir web sitesi veya sosyal medya linki girdiniz.' 
        });
        return;
      }

      // 2. Mükerrer Kontrolü (FR-4): Aynı link daha önce eklenmiş mi?
      const cleanUrl = canonicalizeUrl(url);
      const existingRecipe = await jobRepo.getRecipeByUrl(DEMO_USER_ID, cleanUrl);
      if (existingRecipe) {
        res.status(200).json({
          status: 'completed',
          recipeId: existingRecipe.id,
          message: 'Bu tarifi daha önce eklemiştiniz.'
        });
        return;
      }

      // 3. Benzersiz Job ID oluştur
      const jobId = uuidv4();

      // 4. Veritabanına 'queued' durumunda kaydet (FR-23)
      await jobRepo.createJob(jobId, DEMO_USER_ID, cleanUrl);

      // 5. Arka plan işçisini asenkron olarak tetikle (await etmiyoruz!)
      runImportJob(jobId, url);

      // 6. Hemen 202 Accepted dön (FR-23)
      res.status(202).json({
        jobId,
        status: 'queued',
        message: 'İçe aktarma işlemi sıraya alındı.'
      });

    } catch (error: any) {
      console.error('Start import endpoint error:', error);
      res.status(500).json({
        error_class: 'system_error',
        message: 'İşlem başlatılırken beklenmedik bir hata oluştu.'
      });
    }
  }
};
