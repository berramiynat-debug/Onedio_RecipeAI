import dns from 'dns';
import { promisify } from 'util';
import ipaddr from 'ipaddr.js';

const lookupAsync = promisify(dns.lookup);

/**
 * Bir IP adresinin güvenli (public) olup olmadığını kontrol eder.
 * Loopback, private IP'ler, link-local ve cloud metadata IP'lerini engeller (SEC-2).
 */
export function isSafeIp(ipString: string): boolean {
  try {
    const addr = ipaddr.parse(ipString);
    const range = addr.range();

    // İzin verilmemesi gereken IP aralıkları
    const forbiddenRanges = [
      'loopback',      // 127.0.0.1, ::1
      'private',       // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      'linkLocal',     // 169.254.0.0/16 (AWS/GCP metadata)
      'uniqueLocal',   // fc00::/7
      'unspecified'    // 0.0.0.0
    ];

    if (forbiddenRanges.includes(range)) {
      return false;
    }

    return true;
  } catch (error) {
    // Geçersiz IP formatı
    return false;
  }
}

/**
 * Verilen URL'in IP adresini çözümler ve güvenli olup olmadığını doğrular (SSRF Shield).
 */
export async function validateUrlForSsrf(urlStr: string): Promise<string> {
  try {
    const parsedUrl = new URL(urlStr);
    const hostname = parsedUrl.hostname;

    // Eğer doğrudan IP verilmişse kontrol et
    if (ipaddr.isValid(hostname)) {
      if (!isSafeIp(hostname)) {
        throw new Error(`Forbidden IP address requested: ${hostname}`);
      }
      return urlStr;
    }

    // Hostname'in IP adresini çöz (DNS resolve)
    const lookupResult = await lookupAsync(hostname, { all: true });
    
    for (const entry of lookupResult) {
      if (!isSafeIp(entry.address)) {
        throw new Error(`SSRF Block: Resolved address ${entry.address} for hostname ${hostname} is private/restricted.`);
      }
    }

    return urlStr;
  } catch (error: any) {
    if (error.message && error.message.includes('SSRF Block')) {
      throw error;
    }
    throw new Error(`SSRF Shield: Failed to validate URL DNS resolution. Details: ${error.message}`);
  }
}
