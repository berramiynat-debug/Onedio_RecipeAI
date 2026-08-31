# TEKNİK TESLİM RAPORU: SOSYAL MEDYADAN YEMEK TARİFİ İÇE AKTARMA PLATFORMU (ONEYIYO)

**Tarih:** 26 Ağustos 2026  
**Proje Sahibi / Geliştirici:** Berramiynat  
**Uygulama Adı:** Oneyiyo (RecipeAI)  

---

## 1. Teslim Edilen Çıktılar (Project Deliverables)

### Çıktı 1: Çalışan Uygulama Ortamı
Uygulama, frontend ve backend olmak üzere bağımsız iki katmandan (decoupled) oluşmaktadır. Güvenlik ve veri gizliliği politikaları gereğince, canlı sunucu bağlantı adresleri ile ham veritabanı bağlantı detayları bu teslim dökümanına dahil edilmemiştir. Uygulama local ortamda veya bulut servislerinde (Render, Vercel) ayağa kaldırılmaya hazır biçimde yapılandırılmış olup, gerekli tüm servis erişim anahtarları çevre değişkenleri (`.env`) dosyaları üzerinden yönetilmektedir.

### Çıktı 2: Kaynak Kod Deposu ve Dokümantasyon
Projenin tüm kaynak kodları sürüm kontrol standartlarına uygun olarak GitHub üzerinde barındırılmaktadır:
*   **GitHub Depo Adresi:** [https://github.com/berramiynat-debug/Onedio_RecipeAI](https://github.com/berramiynat-debug/Onedio_RecipeAI)
*   **Geliştirici Dokümantasyonu (README.md):** Deponun kök dizininde yer alan; projenin yerel kurulum adımlarını, veritabanı şema yapılandırmasını (MySQL migration) ve API uç noktalarını açıklayan kapsamlı teknik kılavuz.

### Çıktı 3: Teknik Karar ve Mimari Karar Dökümanı (ADD)
Aşağıdaki bölümlerde, projenin mimari tasarımları, teknik tercihleri ve uygulanan pratikler detaylı bir şekilde raporlanmıştır.

---

## 2. Mimari ve Teknik Kararlar Dökümanı (Architectural Decision Document)

### 2.1 Asenkron İş (Job) Mimarisi ve Durum Takibi (FR-23, FR-24, FR-25)
Uzun süren veri çekme ve yapay zeka analiz süreçlerinin kullanıcı deneyimini (UX) bloke etmesini önlemek amacıyla asenkron bir iş modeli tasarlanmıştır:
*   **İş Akışı:** Kullanıcı bir talep gönderdiğinde backend anında benzersiz bir `Job ID` (UUIDv4) üretir, işi veritabanında `queued` (kuyrukta) olarak işaretler ve `202 Accepted` HTTP kodu ile istemciye yanıt döner.
*   **Arka Plan İşçisi (Background Worker):** İşlemler `Promise.race` yapısı ile asenkron olarak arka planda yürütülür. İşin adımları (`fetching` -> `extracting` -> `ready_for_review` veya `failed`) gerçek zamanlı olarak veritabanında güncellenir.
*   **Polling (Sorgulama):** İstemci tarafı, sunucunun durumunu bloke etmeyen 2 saniyelik aralıklarla `GET /api/jobs/:id` ucunu sorgular. Sayfa yenilense veya oturum kapansa dahi arka plandaki iş kaybolmaz.

### 2.2 Veri Saklama ve Gizlilik İlkeleri (FR-26, FR-27)
*   **Kişisel Veri Gizliliği:** Çıkarılan tüm tarifler `private` (özel) veri sınıfındadır. Sadece tarifi ekleyen kullanıcı tarafından görüntülenebilir ve yönetilebilir.
*   **Ham Veri Saklama İlkesi:** Kaynaktan çekilen ham HTML sayfaları, transkriptler veya açıklama metinleri veritabanında **kesinlikle saklanmaz**. Bellekte (RAM) anlık işlendikten sonra hemen yok edilir.
*   **Log Güvenliği (Data Leak Prevention):** Sunucu günlüklerine (logs) hiçbir şekilde kullanıcı verisi, link içeriği veya transkriptler yazılmaz. Sadece Job ID'leri, iş adımları ve hata sınıfları loglanır.

### 2.3 Çok Modlu (Multimodal) Ekran Görüntüsü Analiz Desteği
*   **Kısıt Aşımı:** Mobil sosyal medya uygulamalarında (Instagram/TikTok) metinlerin doğrudan kopyalanamaması kısıtını aşmak için **Llama 3.2 Vision** yapay zeka modeli sisteme entegre edilmiştir.
*   **Çalışma Biçimi:** Kullanıcı arama kutusundaki `➕` butonu üzerinden veya hata durumunda açılan sürükle-bırak paneliyle gönderinin ekran görüntüsünü (SS) yükler. Backend, resmi base64 formatında alarak Groq Vision API'si üzerinden işler ve tarifi başarıyla yapılandırır.

---

## 3. Güvenlik Protokolleri Raporu (Security Verification)

### 3.1 Sunucu Tarafı İstek Sahteciliği (SSRF) Koruması (SEC-1, SEC-2, SEC-3)
Dışarıdan gelen keyfi URL'lerin sunucu güvenliğini tehdit etmesini engellemek için üç aşamalı SSRF filtresi uygulanmıştır:
1.  **Alan Adı İzin Listesi (Domain Allowlist):** Sadece konfigürasyondan yönetilen güvenilir alan adlarından (YouTube, Instagram, TikTok vb.) gelen istekler kabul edilir.
2.  **DNS ve IP Çözümleme Kontrolü:** İstek gönderilmeden önce alan adının IP adresi çözümlenir. Özel IP aralıkları (`10.x`, `192.168.x`), loopback (`127.0.0.1`), link-local ve bulut sağlayıcı meta veri sunucuları (`169.254.169.254`) çözümlendiği an istek derhal bloklanır.
3.  **Redirect (Yönlendirme) Takip Doğrulaması:** TikTok kısa linkleri gibi yönlendirmeli bağlantılarda, her bir yönlendirme adımından sonra ulaşılan yeni IP adresi tekrar SSRF süzgecinden geçirilir.

### 3.2 Yapay Zeka İstismar (Prompt Injection) Savunması (SEC-4, SEC-5, SEC-6)
Üçüncü şahısların ürettiği metinlerin yapay zekayı manipüle etmesini önlemek amacıyla şu tedbirler alınmıştır:
*   **Sistem Talimatı Ayrımı (System vs User Prompt):** LLM'e gönderilen talimatlar (System Instruction) ile kullanıcı verisi (User Data) yapısal olarak birbirinden tamamen ayrılmıştır. Yapay zekaya verinin sadece "analiz edilecek nesne" olduğu katı bir şekilde tanımlanmıştır.
*   **Katı Şema Zorlaması:** Çıktılar Zod şema doğrulamasından geçirilir. Şemaya uymayan veya komut enjekte edilmeye çalışılan tüm yanıtlar reddedilir.
*   **Atıf Güvenliği:** Tariflerin orijinal linki ve üretici ismi asla yapay zeka çıktısından alınmaz; backend tarafındaki güvenilir metadata toplayıcılarından doğrudan veritabanına yazılır.

---

## 4. Hata Taksonomisi ve UX Uyumluluğu
Hata yönetiminde suçlayıcı olmayan, açıklayıcı ve profesyonel bir dil kullanılmıştır:
*   **Geçersiz Girdi (invalid_input):** Sunucuya istek gitmeden arayüzde engellenir.
*   **Erişilemez İçerik (inaccessible):** Instagram bot korumaları veya gizli hesap durumlarında kullanıcıya suçlayıcı olmayan *"Gönderiye erişilemedi (Hesap gizli veya silinmiş olabilir)"* mesajı ile birlikte metin/SS yapıştırma fallback'i sunulur.
*   **Alakasız İçerik (no_recipe):** İçerisinde yemek tarifi barındırmayan metinler tespit edilerek reddedilir.
