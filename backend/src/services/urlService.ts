import axios from 'axios';
import { config } from '../config';
import { validateUrlForSsrf } from './securityService';

/**
 * URL canonicalization: UTM parametrelerini temizler ve standard formata çevirir (FR-2).
 */
export function canonicalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);

    // UTM ve igsh, si gibi tracking parametrelerini temizle (FR-2)
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si', 'igsh', 'ig_mid'];
    paramsToRemove.forEach(p => parsed.searchParams.delete(p));

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // 1. YouTube Canonicalization (FR-2)
    if (host === 'youtu.be') {
      const videoId = path.replace('/', '');
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    if (host.includes('youtube.com')) {
      if (path.startsWith('/shorts/')) {
        const videoId = path.split('/')[2];
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
      
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        const cleanUrl = new URL('https://www.youtube.com/watch');
        cleanUrl.searchParams.set('v', videoId);
        return cleanUrl.toString();
      }
    }

    // 2. Instagram Canonicalization (FR-2)
    if (host.includes('instagram.com')) {
      // /reel/C3abc/ veya /p/C3abc/ -> /p/C3abc/
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2 && ['p', 'reel', 'tv'].includes(parts[0])) {
        const shortcode = parts[1];
        return `https://www.instagram.com/p/${shortcode}/`;
      }
    }

    return parsed.toString();
  } catch (error) {
    return urlStr; // Geçersiz URL ise olduğu gibi dön, daha sonraki katman hata fırlatacak
  }
}

/**
 * Bir URL'in alan adının allowlist'te olup olmadığını kontrol eder (FR-1).
 */
export function isAllowedDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    
    return config.domainAllowlist.some(allowed => 
      hostname === allowed || hostname.endsWith('.' + allowed)
    );
  } catch (error) {
    return false;
  }
}

/**
 * TikTok gibi kısa linklerin redirect (yönlendirme) zincirini güvenli bir şekilde takip eder.
 * Her yönlendirmede yeni adresi SSRF filtresinden geçirir (SEC-3).
 */
export async function resolveRedirectsSafely(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;
  const maxRedirects = 5;

  for (let i = 0; i < maxRedirects; i++) {
    // 1. Önce güncel URL'i SSRF kontrolünden geçir (SEC-3)
    await validateUrlForSsrf(currentUrl);

    const parsed = new URL(currentUrl);
    
    // Yönlendirme yapabilecek kısa link servisleri (TikTok vb.) dışında takip etmeye gerek yok
    if (!parsed.hostname.includes('tiktok.com') && !parsed.hostname.includes('youtu.be')) {
      break;
    }

    try {
      // Yönlendirmeyi manuel takip etmek için axios'un otomatik yönlendirmesini kapatıyoruz (maxRedirects: 0)
      const response = await axios.head(currentUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      });

      const nextUrl = response.headers.location;
      if (nextUrl) {
        // Göreli (relative) yönlendirmeleri mutlak (absolute) yap
        const resolvedNextUrl = new URL(nextUrl, currentUrl).toString();
        currentUrl = resolvedNextUrl;
      } else {
        break;
      }
    } catch (error) {
      // Yönlendirme kodu dönmediğinde (örneğin 200 OK alındığında) veya istek çöktüğünde döngüden çık
      break;
    }
  }

  // 2. Yönlendirme sonundaki nihai URL'i de son kez doğrula
  await validateUrlForSsrf(currentUrl);
  return currentUrl;
}
