import axios from 'axios';
import { parse } from 'url';
import { validateUrlForSsrf } from './securityService';
import { config } from '../config';

export interface ScrapedMetadata {
  title: string;
  author: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'blog';
  originalUrl: string;
  content: string; // LLM'e gönderilecek asıl metin (caption, video açıklaması veya blog içeriği)
}

/**
 * HTML içerisinden meta etiketlerini Regex ile ayıklar.
 * Ağır HTML parser kütüphaneleri kullanmak yerine hafif ve hızlı regex tercih edilmiştir.
 */
function extractMetaTag(html: string, propertyOrName: string): string {
  // hem name="..." hem de property="..." için eşleşme dene
  const propertyReg = new RegExp(`<meta[^>]*(?:property|name)=["']${propertyOrName}["'][^>]*content=["']([^"']*)["']`, 'i');
  const contentReg = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${propertyOrName}["']`, 'i');

  const matchProperty = html.match(propertyReg);
  if (matchProperty && matchProperty[1]) return matchProperty[1];

  const matchContent = html.match(contentReg);
  if (matchContent && matchContent[1]) return matchContent[1];

  return '';
}

/**
 * HTML kodundaki script, style ve yorum etiketlerini temizler.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Blog sayfalarından ana metin içeriğini çıkarmaya çalışır (p ve li etiketleri)
 */
function extractBlogBody(html: string): string {
  const cleaned = cleanHtml(html);
  // <p> ve <li> etiketleri içerisindeki yazıları topla
  const regex = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  const blocks: string[] = [];
  
  while ((match = regex.exec(cleaned)) !== null) {
    let text = match[2]
      .replace(/<[^>]*>/g, '') // İçerideki HTML tag'lerini temizle
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 3) { // Kısa malzemeleri (örn: "tuz", "1 yumurta") kaçırmamak için sınırı 3 yaptık
      blocks.push(text);
    }
  }

  return blocks.join('\n');
}

/**
 * YouTube URL'sinden 11 karakterlik benzersiz Video ID'sini çıkarır.
 */
function extractVideoId(url: string): string | null {
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/ ]{11})/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

/**
 * YouTube videosundan metadata ve açıklama çeker.
 */
async function scrapeYouTube(url: string): Promise<ScrapedMetadata> {
  try {
    let fetchUrl = url.replace('/shorts/', '/watch?v=');
    if (!fetchUrl.includes('?')) {
      fetchUrl += '?hl=tr&gl=TR&ucbcb=1';
    } else {
      fetchUrl += '&hl=tr&gl=TR&ucbcb=1';
    }

    // 1. oEmbed API'sini dene (başlık ve yazar için çok güvenli)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fetchUrl)}&format=json`;
    let title = '';
    let author = 'Bilinmeyen Yazar';
    
    try {
      await validateUrlForSsrf(oembedUrl);
      const { data } = await axios.get(oembedUrl, { 
        timeout: 5000, 
        maxContentLength: config.maxContentLength 
      });
      title = data.title || '';
      author = data.author_name || 'Bilinmeyen Yazar';
    } catch (e) {
      // oEmbed başarısız olursa HTML'den devam edeceğiz
    }

    // 2. HTML'i çekip açıklama kısmını alalım (Googlebot UA ile Consent/Bot duvarı %100 aşılır)
    let html = '';
    try {
      await validateUrlForSsrf(fetchUrl);
      const { data } = await axios.get(fetchUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        responseEncoding: 'utf8',
        timeout: 8000,
        maxContentLength: config.maxContentLength
      });
      html = data;
    } catch (e) {
      // Googlebot istek başarısız olursa desktop isteğine geç
    }

    if (!html) {
      await validateUrlForSsrf(fetchUrl);
      const { data } = await axios.get(fetchUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Cookie': 'CONSENT=YES+cb.20220301-11-p0.en+FX+111; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_eWbBg',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        responseEncoding: 'utf8',
        timeout: 8000,
        maxContentLength: config.maxContentLength
      });
      html = data;
    }

    if (!title) {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube Videosu';
    }

    // YouTube video açıklamasını çok katmanlı fallback ile çekmeye çalış
    let description = '';
    
    // 1. ytInitialPlayerResponse içinden eksiksiz çek
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?})(?:;|\s*<\/script>)/);
    if (playerResponseMatch) {
      try {
        const json = JSON.parse(playerResponseMatch[1]);
        description = json.videoDetails?.shortDescription || '';
      } catch (e) {
        // JSON parse hatası durumunda fallback'e geç
      }
    }

    // 2. Doğrudan "shortDescription" JSON anahtarı regex'i ile çek
    if (!description) {
      const shortDescMatch = html.match(/"shortDescription":\s*"([^"]+)"/);
      if (shortDescMatch) {
        description = shortDescMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    // 3. "description":{"simpleText":"..."} regex'i ile çek
    if (!description) {
      const simpleDescMatch = html.match(/"description":\s*\{\s*"simpleText":\s*"([^"]+)"/);
      if (simpleDescMatch) {
        description = simpleDescMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    // 4. ytInitialData structuredDescriptionBodyText içinden çek
    if (!description) {
      const attrBodyMatch = html.match(/"attributedDescriptionBodyText":\s*({[\s\S]*?})\s*,\s*"/);
      if (attrBodyMatch) {
        try {
          const bodyJson = JSON.parse(attrBodyMatch[1]);
          description = bodyJson.content || '';
        } catch (e) {
          // Fallback
        }
      }
    }

    // 5. Meta description veya og:description tagı içinden çek
    if (!description) {
      const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                        html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (metaMatch) {
        description = metaMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    // 4. Meta tag'lerden çek
    if (!description) {
      description = extractMetaTag(html, 'description') || extractMetaTag(html, 'og:description');
    }

    // Altyazıyı (konuşma metnini) çekmeye çalış ve açıklamaya ekle
    let transcript = '';
    const videoId = extractVideoId(url);
    if (videoId) {
      try {
        const transcriptUrl = `https://youtube-transcript.ai/transcript/${videoId}.txt`;
        const response = await axios.get(transcriptUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          timeout: 6000,
          responseEncoding: 'utf8'
        });
        if (response.data && typeof response.data === 'string' && response.data.includes('## Transcript')) {
          const parts = response.data.split('## Transcript');
          transcript = parts.length > 1 ? parts[1].trim() : response.data.trim();
        }
      } catch (err: any) {
        // Altyazı çekilemezse veya altyazı yoksa sessizce devam et
        console.warn(`[scrapeYouTube] Could not fetch transcript for video ${videoId}:`, err.message);
      }
    }

    let finalContent = description || title;
    if (transcript) {
      finalContent = `${finalContent}\n\n=== VİDEO KONUŞMA METNİ (TRANSKRİPT) ===\n\n${transcript}`;
    }

    return {
      title,
      author,
      platform: 'youtube',
      originalUrl: url,
      content: finalContent
    };
  } catch (error: any) {
    throw new Error(`youtube_inaccessible: YouTube video metadata could not be fetched. Details: ${error.message}`);
  }
}

/**
 * Instagram gönderisinden metadata ve açıklama çeker.
 */
async function scrapeInstagram(url: string): Promise<ScrapedMetadata> {
  // 1. ddinstagram.com proxy'sini dene (Giriş duvarını aşmak için)
  const ddUrl = url.replace(/(www\.)?instagram\.com/, 'ddinstagram.com');
  try {
    await validateUrlForSsrf(ddUrl);
    const { data: html } = await axios.get(ddUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      responseEncoding: 'utf8',
      timeout: 5000,
      maxContentLength: config.maxContentLength
    });

    const ogDescription = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description');
    if (ogDescription && ogDescription.trim().length > 10) {
      const ogTitle = extractMetaTag(html, 'og:title') || 'Instagram Tarifi';
      const titleMatch = ogTitle.replace(/on Instagram:.*$/i, '').trim();
      let author = 'Instagram Üreticisi';
      const authorMatch = ogTitle.match(/^(.*?) on Instagram:/i);
      if (authorMatch) {
        author = authorMatch[1];
      }

      let description = ogDescription
        .replace(/^.*?on Instagram:[\s"']*/i, '')
        .replace(/^[0-9,.]+ (Likes|Beğenme), [0-9,.]+ Comments (Yorum|-).*?:\s*/i, '');

      return {
        title: titleMatch,
        author,
        platform: 'instagram',
        originalUrl: url,
        content: description || titleMatch
      };
    }
  } catch (e: any) {
    console.warn(`[scrapeInstagram] ddinstagram proxy failed: ${e.message}. Direct fetch'e geçiliyor.`);
  }

  // 2. Doğrudan Instagram'dan çekmeyi dene (Login yönlendirmesi veya çerez engelini göze alarak)
  try {
    await validateUrlForSsrf(url);
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      responseEncoding: 'utf8',
      timeout: 8000,
      maxContentLength: config.maxContentLength
    });

    // Giriş duvarına takıldıysak veya sayfa içeriği boşsa uyaralım
    if (html.includes('/accounts/login') || html.includes('Login • Instagram')) {
      console.warn('[scrapeInstagram] Warning: Redirected to login page.');
    }

    const ogTitle = extractMetaTag(html, 'og:title');
    let author = 'Instagram Üreticisi';
    if (ogTitle) {
      const authorMatch = ogTitle.match(/^(.*?) on Instagram:/i);
      if (authorMatch) {
        author = authorMatch[1];
      }
    }

    let description = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description');
    
    if (description) {
      description = description.replace(/^.*?on Instagram:[\s"']*/i, '');
      description = description.replace(/^[0-9,.]+ (Likes|Beğenme), [0-9,.]+ Comments (Yorum|-).*?:\s*/i, '');
    }

    const titleMatch = ogTitle ? ogTitle.replace(/on Instagram:.*$/i, '').trim() : 'Instagram Tarifi';

    return {
      title: titleMatch,
      author,
      platform: 'instagram',
      originalUrl: url,
      content: description || titleMatch
    };
  } catch (error: any) {
    throw new Error(`instagram_inaccessible: Instagram post is private, deleted, or blocked. Details: ${error.message}`);
  }
}

/**
 * TikTok videosundan metadata ve açıklama çeker.
 */
async function scrapeTikTok(url: string): Promise<ScrapedMetadata> {
  try {
    let title = '';
    let author = 'TikTok Üreticisi';
    let content = '';

    // 1. oEmbed API'sini dene (TikTok'ta oEmbed açıklamayı/başlığı 100% getirir ve bot blokajı yemez)
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      await validateUrlForSsrf(oembedUrl);
      const { data } = await axios.get(oembedUrl, { 
        timeout: 5000,
        maxContentLength: config.maxContentLength
      });
      title = data.title || '';
      author = data.author_name || 'TikTok Üreticisi';
    } catch (e: any) {
      console.warn('[scrapeTikTok] oEmbed failed:', e.message);
    }

    // 2. Doğrudan HTML'i indirip Open Graph tag'lerini parse etmeyi dene
    let ogDescription = '';
    try {
      await validateUrlForSsrf(url);
      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        responseEncoding: 'utf8',
        timeout: 8000,
        maxContentLength: config.maxContentLength
      });

      const ogTitle = extractMetaTag(html, 'og:title');
      if (!title && ogTitle) {
        title = ogTitle;
      }
      ogDescription = extractMetaTag(html, 'og:description');
    } catch (htmlErr: any) {
      // Eğer doğrudan HTML indirme engellendiyse (Render sunucu IP'lerinde çok yaygın), oEmbed sonucunu kullanıp devam et!
      console.warn(`[scrapeTikTok] Direct HTML fetch failed: ${htmlErr.message}. Relying on oEmbed title.`);
    }

    content = ogDescription || title;

    if (!content) {
      throw new Error('TikTok video description/title is empty or inaccessible.');
    }

    return {
      title: title || 'TikTok Videosu',
      author,
      platform: 'tiktok',
      originalUrl: url,
      content
    };
  } catch (error: any) {
    throw new Error(`tiktok_inaccessible: TikTok video could not be fetched. Details: ${error.message}`);
  }
}

/**
 * Yemek Blogu web sayfasından başlık ve makale içeriğini çeker.
 */
async function scrapeBlog(url: string): Promise<ScrapedMetadata> {
  try {
    await validateUrlForSsrf(url);
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      responseEncoding: 'utf8',
      timeout: 8000,
      maxContentLength: config.maxContentLength
    });

    // Başlığı Open Graph'tan veya title etiketinden al
    let title = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'twitter:title');
    if (!title) {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : 'Yemek Blogu Tarifi';
    }

    // Yazar
    const author = extractMetaTag(html, 'author') || extractMetaTag(html, 'article:author') || 'Blog Yazarı';

    // OG Açıklaması + Paragraf gövdelerini birleştir
    const ogDesc = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description');
    const bodyContent = extractBlogBody(html);
    
    const content = `${ogDesc}\n\n=== SAYFA İÇERİĞİ ===\n\n${bodyContent}`;

    return {
      title,
      author,
      platform: 'blog',
      originalUrl: url,
      content
    };
  } catch (error: any) {
    throw new Error(`blog_inaccessible: Blog website could not be accessed. Details: ${error.message}`);
  }
}

/**
 * Verilen URL'e göre doğru scraper'ı seçer ve içeriği toplar.
 */
export async function scrapeUrl(url: string): Promise<ScrapedMetadata> {
  const parsed = parse(url);
  const host = parsed.hostname?.toLowerCase() || '';

  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    return scrapeYouTube(url);
  } else if (host.includes('instagram.com')) {
    return scrapeInstagram(url);
  } else if (host.includes('tiktok.com')) {
    return scrapeTikTok(url);
  } else {
    // Liste dışındaki domainler blog siteleri olarak değerlendirilir (allowlist kontrolünden geçtikten sonra)
    return scrapeBlog(url);
  }
}
