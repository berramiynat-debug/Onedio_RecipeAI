# PRD — Sosyal Medyadan Tarif İçe Aktarma
## Stajyer Projesi (Fullstack Web)

**Süre:** 4 hafta
**Platform:** Web (tek uygulama: web UI + backend API)
**Statü:** Proje tanımı — geliştirmeye hazır
**Hedef kitle:** Stajyer geliştirici + mentor

---

## 1. Proje özeti

Kullanıcılar yemek tariflerini giderek daha fazla YouTube, Instagram ve TikTok üzerinden keşfediyor; ancak bu içerik yapılandırılmamış durumda. Malzeme listesi yok, adımlar yok, video kaydedilen klasörde kayboluyor.

Bu projede, kullanıcının bir sosyal medya veya tarif blogu linkini yapıştırdığı; sistemin bu linkten yapılandırılmış bir tarif (malzemeler, miktarlar, sıralı adımlar) çıkardığı ve kullanıcının kişisel koleksiyonuna Türkçe olarak kaydettiği bir web uygulaması geliştirilecek.

Çıkarılan tarif **özel (private) bir kullanıcı nesnesidir**: yayınlanmaz, başka kullanıcılara gösterilmez, arama motorlarına açılmaz.

### 1.1 Öğrenme hedefleri

Bu proje bilinçli olarak şu konuları kapsayacak şekilde tasarlandı:

- **Asenkron iş (job) mimarisi:** Uzun süren işlemlerin durable job olarak modellenmesi, durum takibi, polling.
- **LLM entegrasyonu:** Untrusted içerikten structured output üretme, prompt injection'a karşı savunma.
- **Üçüncü parti içerik erişimi:** oEmbed / Open Graph metadata, URL canonicalization.
- **Güvenlik temelleri:** SSRF, input validation, güvenilmeyen veri işleme.
- **Uçtan uca ürün düşüncesi:** Hata durumlarının UX olarak tasarlanması, edit edilebilir review ekranı.

### 1.2 Beklenen çıktı

Staj sonunda: çalışan bir demo, kaynak kod (README ve kurulum talimatlarıyla), ve mimari kararları açıklayan kısa bir teknik döküman (2-3 sayfa).

---

## 2. Kapsam

### 2.1 Kapsam dahilinde (core)

| Bileşen | Açıklama |
|---|---|
| Link gönderme | Web arayüzünde paste alanı; URL format ve domain doğrulaması |
| Metadata toplama | oEmbed / Open Graph / açıklama-caption metni üzerinden içerik alma |
| LLM ile tarif çıkarma | Metadata metninden structured tarif üretimi |
| Türkçe normalizasyon | Kaynak dili ne olursa olsun Türkçe çıktı; imperial → metrik dönüşüm |
| Review & edit ekranı | Kayıttan önce zorunlu, düzenlenebilir önizleme |
| Koleksiyon | Kullanıcının kayıtlı tarifleri: liste + detay sayfası |
| Hata yönetimi | Tanımlı failure sınıfları, her biri için ayrı UI durumu |

### 2.2 Kapsam dışı (bu projede yapılmayacak)

- Video/ses indirme ve transkripsiyon (bkz. stretch goals)
- Ödeme, abonelik, quota, paywall
- Mobil uygulama, share sheet, clipboard algılama
- Kullanıcılar arası paylaşım veya yayınlama
- Cross-user deduplication cache
- Toplu import
- Fotoğraftan / ekran görüntüsünden tarif çıkarma
- Besin değeri hesaplama

### 2.3 Desteklenen kaynaklar

| Kaynak | Erişim yöntemi (core scope) |
|---|---|
| Instagram post / Reel | oEmbed + caption metni |
| TikTok video | oEmbed + açıklama metni |
| YouTube video / Shorts | oEmbed + video açıklaması |
| Tarif blogu / web sayfası | Sayfa HTML'i (Open Graph + article gövdesi) |

**Önemli not:** Instagram ve TikTok'ta tarif paylaşan içerik üreticilerinin büyük kısmı tarifin tamamını caption'a yazar. Bu proje o senaryoyu hedefler. Caption'da tarif yoksa bu bir hata değil, tanımlı bir ürün durumudur (bkz. §6).

---

## 3. Kullanıcı akışı

```
Link yapıştır
  → Doğrulama (format + desteklenen domain)
  → İşleme (asenkron job, aşamalı progress)
  → [Başarılı]  → Review & Edit → Kaydet → Tarif Detay
  → [Kısmi]     → Review & Edit (eksik alanlar işaretli) → Kaydet
  → [Başarısız] → Anlaşılır hata ekranı + tekrar deneme
```

1. **Gönderim.** Kullanıcı linki yapıştırır. Geçersiz format veya desteklenmeyen domain, sunucuya gitmeden inline mesajla reddedilir.
2. **İşleme.** İşlem asenkron çalışır. Kullanıcıya anlamlı aşamalar gösterilir: "içerik alınıyor" → "tarif çıkarılıyor" → "Türkçe hazırlanıyor". Jenerik spinner kabul edilmez.
3. **Review ekranı.** Çıkarılan tarif kaydedilmeden önce düzenlenebilir halde gösterilir. Düşük güvenli veya eksik alanlar görsel olarak işaretlenir. **Bu ekran zorunludur** — sistem hiçbir zaman doğrulanmamış bir çıkarımı sessizce kaydetmez.
4. **Kayıt.** Tarif kullanıcının koleksiyonuna yazılır.
5. **Detay.** Tarif detay sayfası içeriği + kaynak atfını (platform, üretici, orijinal link) gösterir.

---

## 4. Fonksiyonel gereksinimler

### 4.1 URL işleme

- **FR-1.** Desteklenen domain'ler bir allowlist'te tutulur; allowlist config dosyasından yönetilir, kod değişikliği gerektirmez.
- **FR-2.** URL'ler canonical hale getirilir: `youtu.be` / `youtube.com/watch` / `/shorts/` aynı video ID'ye; Instagram `/p/` ve `/reel/` aynı shortcode'a çözülür; tüm tracking parametreleri (`utm_*`, `si`, `igsh` vb.) temizlenir.
- **FR-3.** TikTok kısa linkleri (`vm.tiktok.com`) redirect takibiyle çözülür. Redirect takibi §7.1'deki SSRF kontrollerinden geçer.
- **FR-4.** Aynı kullanıcının daha önce import ettiği bir canonical URL tekrar gönderilirse, kullanıcı mevcut tarife yönlendirilir.

### 4.2 İçerik toplama

- **FR-5.** İçerik erişimi yalnızca herkese açık metadata kanallarından yapılır: oEmbed endpoint'leri, Open Graph tag'leri, sayfa gövdesi. Video veya ses dosyası indirilmez.
- **FR-6.** Erişilemeyen içerik (silinmiş, private, geo-blocked) teknik olmayan, anlaşılır bir mesajla raporlanır.

### 4.3 Tarif çıkarma

- **FR-7.** Çıkarılacak alanlar: başlık, malzeme listesi (miktar + birim + isim olarak üç ayrı alan), sıralı hazırlık adımları, ve kaynakta belirtilmişse: porsiyon, hazırlık süresi, pişirme süresi.
- **FR-8.** LLM çıktısı katı bir JSON şemasına zorlanır ve kaydedilmeden önce şema doğrulamasından geçer. Şemaya uymayan çıktı reddedilir, saklanmaz.
- **FR-9.** **Kaynakta belirtilmemiş hiçbir miktar, süre veya porsiyon uydurulmaz.** Eksik alan boş kalır ve kullanıcıya boş gösterilir. Bu kural prompt talimatına bırakılmaz; validation katmanında da kontrol edilir (ör: kaynak metinde geçmeyen sayısal miktarlar flag'lenir).
- **FR-10.** Tarif içermeyen içerik (restoran vlog'u, yemek incelemesi) tespit edilir ve reddedilir. **Kendinden emin bir halüsinasyon, temiz bir hatadan daha kötüdür.**
- **FR-11.** Her alana basit bir güven işareti eklenir (`high` / `low` / `missing`). Sinyal kaynağı: değer kaynak metinde açıkça geçiyor mu, çıkarım mı yapıldı. Kullanıcıya sayısal skor gösterilmez; `low` alanlar "kontrol et" işaretiyle vurgulanır.

### 4.4 Türkçe çıktı ve normalizasyon

- **FR-12.** Kaynak dili ne olursa olsun çıktı Türkçe'dir.
- **FR-13.** Imperial ve hacimsel birimler güvenli bir dönüşüm varsa metriğe çevrilir. Belirsiz dönüşümlerde (ör. katı bir malzemenin "1 cup" ölçüsü) orijinal birim korunur ve alan `low` confidence olarak işaretlenir. Tahmini kütle uydurulmaz.
- **FR-14.** Türkçe karşılığı olmayan malzemeler yanlış çevrilmek yerine orijinal adıyla ve kısa bir parantez açıklamasıyla bırakılır.

### 4.5 Review & edit ekranı

- **FR-15.** Tüm alanlar düzenlenebilir: başlık, porsiyon, süreler, malzemeler (miktar/birim/isim ayrı input'lar), adımlar (sıralanabilir, eklenebilir, silinebilir).
- **FR-16.** Kaynak atfı (platform, üretici adı, orijinal link) düzenlenemez ve metadata'dan gelir — asla LLM çıktısından gelmez.
- **FR-17.** `low` ve `missing` alanlar görsel olarak işaretlenir; kullanıcı alanı düzenlediğinde işaret kalkar. İşaretleme yalnızca renkle yapılmaz (erişilebilirlik).
- **FR-18.** Kaydedilmemiş bir review'dan çıkarken kullanıcı uyarılır.

### 4.6 Koleksiyon ve detay

- **FR-19.** Koleksiyon listesi: kullanıcının tüm import edilmiş tarifleri, import tarihine ve isme göre sıralanabilir.
- **FR-20.** Detay sayfası sırası: tarif içeriği → kaynak atfı bloğu ("orijinali görüntüle" dış linkiyle).
- **FR-21.** Kayıtlı tarif her zaman düzenlenebilir ve silinebilir. Silme anında ve tamdır.
- **FR-22.** Arayüzde paylaşım, yayınlama veya dışa aktarma aksiyonu bulunmaz.

---

## 5. Mimari gereksinimler

### 5.1 Asenkron iş modeli

İşleme süresi birkaç saniyeden 30+ saniyeye kadar değişebilir. Bu nedenle:

- **FR-23.** Her import, backend'de durumu sorgulanabilir bir job'dır. Job durumları: `queued` → `processing` (alt aşamalarıyla) → `ready_for_review` | `failed`.
- **FR-24.** Client, job durumunu polling ile takip eder (basit ve yeterli; WebSocket/SSE stretch goal'dür). Sayfa yenilense bile devam eden job kaybolmaz.
- **FR-25.** Client tanımadığı bir job durumuyla karşılaşırsa jenerik "işleniyor" durumuna düşer, kırılmaz.

### 5.2 Veri modeli (kavramsal)

| Nesne | Temel alanlar |
|---|---|
| ImportJob | id, kullanıcı, canonical URL, durum, alt aşama, hata sınıfı, timestamps |
| Recipe | id, kullanıcı, başlık, porsiyon, süreler, malzemeler[], adımlar[], confidence map, atıf (platform, üretici, orijinal URL, import tarihi) |
| User | Basit oturum yeterli (tek kullanıcılı demo kabul edilebilir; çok kullanıcılı auth stretch goal) |

### 5.3 Veri saklama ilkesi

- **FR-26.** Kaynak içeriğin ham metni (caption, açıklama, sayfa HTML'i) kalıcı olarak saklanmaz; yalnızca işleme sırasında bellekte tutulur. Kalıcı olan tek şey türetilmiş yapılandırılmış tariftir.
- **FR-27.** Log'lara caption/açıklama içeriği yazılmaz. Job ID, durum ve hata sınıfı loglanır; payload loglanmaz.

### 5.4 Konfigürasyon

Şunlar deploy gerektirmeden (config/env üzerinden) değiştirilebilir olmalı: domain allowlist, LLM model seçimi, işleme timeout süresi, confidence eşiği.

---

## 6. Hata taksonomisi

Hata bir "error page" değil, tasarlanmış bir ürün durumudur. Her sınıfın ayrı kopyası ve kurtarma yolu vardır:

| Sınıf | Örnek | Retry | Kullanıcıya sunulan |
|---|---|---|---|
| Geçersiz girdi | Desteklenmeyen domain, bozuk URL | Hayır | Inline mesaj, gönderim öncesi |
| Erişilemez içerik | Private, silinmiş, geo-blocked | Hayır | Anlaşılır açıklama |
| Tarif değil | İçerikte tarif yok | Hayır | Nötr açıklama, suçlayıcı olmayan dil |
| Yetersiz içerik | Caption'da tarif için yeterli bilgi yok | Hayır | "Bu videoda tarif metni bulamadık" + varsa kısmi sonuçla review'a geçiş |
| Sistem hatası | Timeout, LLM/upstream hatası | Evet | Tekrar dene aksiyonu |

**Kopya kuralı:** Özür dileyen AI dili kullanılmaz ("üzgünüm, anlayamadım" yasak). Düşük güven bir inceleme adımı olarak çerçevelenir. Pipeline iç detayları (model, transcription vb.) kullanıcıya sızdırılmaz.

---

## 7. Güvenlik gereksinimleri

Bu feature iki doğal saldırı yüzeyi içerir: kullanıcıdan gelen keyfi URL'ler ve LLM'e beslenen güvenilmeyen üçüncü parti metin. İkisi de stajyerin öğrenmesi gereken gerçek üretim riskleridir.

### 7.1 SSRF

- **SEC-1.** Domain allowlist gönderim anında zorunludur.
- **SEC-2.** Fetch öncesi hedef IP çözülür ve doğrulanır: private (`10.x`, `172.16-31.x`, `192.168.x`), loopback, link-local ve cloud metadata (`169.254.169.254`) aralıkları bloklanır.
- **SEC-3.** Her redirect sonrası hedef yeniden doğrulanır. TikTok kısa link çözümü redirect takip eden bir işlemdir ve en bariz saldırı vektörüdür.

### 7.2 Prompt injection

- **SEC-4.** Caption, açıklama ve sayfa içeriği saldırgan kontrolündeki veridir. LLM'e her zaman **veri olarak** verilir, talimat olarak değil; sistem talimatı ile içerik yapısal olarak ayrılır.
- **SEC-5.** LLM'in tool erişimi, network erişimi veya aksiyon tetikleme yetkisi yoktur. Tek çıktısı şemaya uyan tarif JSON'ıdır.
- **SEC-6.** Kaynak URL ve üretici atfı asla model çıktısından alınmaz — canonicalization ve metadata'dan gelir. Model, client'ın "güvenilir" olarak render ettiği hiçbir alanı etkileyemez.

### 7.3 Genel

- **SEC-7.** LLM API anahtarı yalnızca backend'de tutulur; client'a hiçbir koşulda sızmaz.
- **SEC-8.** Basit rate limit: kullanıcı/IP başına dakikada N gönderim (config'den).
- **SEC-9.** İşleme timeout'u ve maksimum içerik boyutu limitleri uygulanır.

---

## 8. Kalite hedefleri

Sert SLA yok — bu bir stajyer projesi — ama şu hedefler yön verir:

| Metrik | Hedef |
|---|---|
| Import başarı oranı (test setinde) | Caption'ında tarif olan içeriklerde ≥ %80 review'a ulaşma |
| Malzeme doğruluğu | Test setinde manuel değerlendirmeyle ≥ %90 |
| Halüsinasyon | Test setinde uydurulmuş miktar: **sıfır tolerans** |
| İşleme süresi | Metadata yolu için p50 < 15 sn |

**Test seti:** Proje başında mentor ile birlikte 20 içerikten oluşan bir test seti hazırlanır (Instagram/TikTok caption'lı, YouTube açıklamalı, blog, tarif olmayan içerik, erişilemeyen link karışık). Kabul değerlendirmesi bu set üzerinden yapılır.

---

## 9. Haftalık plan

| Hafta | Hedef | Teslim |
|---|---|---|
| **1** | Proje iskeleti, URL doğrulama + canonicalization, metadata toplama (oEmbed/OG), job modeli | Link gönderilebiliyor, metadata çekiliyor, job durumu API'den sorgulanabiliyor |
| **2** | LLM extraction, JSON şema doğrulama, Türkçe normalizasyon, hata taksonomisi | Curl ile uçtan uca: URL → yapılandırılmış Türkçe tarif JSON'ı |
| **3** | Web UI: gönderim, işleme durumu (polling), review & edit ekranı | Tarayıcıda uçtan uca akış çalışıyor |
| **4** | Koleksiyon + detay sayfası, confidence işaretleri, güvenlik kontrolleri, test seti değerlendirmesi, dokümantasyon | Demo + README + teknik karar dökümanı |

Hafta sonlarında mentor ile 30 dakikalık checkpoint önerilir. Hafta 2 sonundaki curl demosu en kritik ara kontroldür — pipeline çalışmıyorsa UI'a geçilmez.

---

## 10. Stretch goals

Core scope erken biterse, sırasıyla:

1. **YouTube altyazı yolu:** Açıklamada tarif yoksa, videonun public altyazısını (varsa) çekip extraction'a beslemek. Metadata-yetersiz YouTube içeriğinin önemli kısmını kurtarır.
2. **Çok kullanıcılı auth:** Basit e-posta/şifre veya magic link ile gerçek kullanıcı ayrımı.
3. **SSE ile canlı progress:** Polling yerine server-sent events.
4. **Porsiyon ölçekleme:** Detay sayfasında porsiyon değiştirildiğinde miktarların otomatik ölçeklenmesi (FR-7'deki üç parçalı malzeme yapısı bunun ön koşuludur).
5. **Alışveriş listesi:** Tariften malzeme listesi üretme.

Video/ses indirme ve Whisper transkripsiyonu bilinçli olarak stretch'e bile alınmadı: hem hukuki/ToS boyutu mentor kararı gerektirir hem de 1 aylık kapsamı dağıtır. İlgi varsa staj sonunda tartışma konusu olarak ele alınabilir.

---

## 11. Değerlendirme kriterleri

| Alan | Ağırlık | Bakılan |
|---|---|---|
| Çalışan uçtan uca akış | 35% | Test setindeki başarı, hata durumlarının doğru ele alınması |
| Kod kalitesi | 25% | Okunabilirlik, katman ayrımı, anlamlı commit geçmişi |
| Güvenlik | 20% | SEC gereksinimlerinin uygulanması; özellikle SSRF ve şema doğrulama |
| Ürün düşüncesi | 10% | Hata kopyaları, review UX, boş/eksik durumların ele alınışı |
| Dokümantasyon | 10% | README, kurulum, mimari karar dökümanı |

---

## 12. Açık sorular (mentor ile ilk hafta netleştirilecek)

1. LLM sağlayıcısı ve model seçimi — şirket API anahtarı hangi sağlayıcıda?
2. Deploy hedefi: local demo yeterli mi, yoksa bir staging ortamına mı çıkılacak?
3. Test setinin içerik dağılımı (platform ve dil karışımı).
4. Tek kullanıcılı demo mu, basit auth core scope'a mı alınsın?
