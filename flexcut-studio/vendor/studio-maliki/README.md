# Studio Maliki — Klip + Motion (gratis, jalan di laptopmu)

Aplikasi desktop untuk:
- **Klip**: memotong video panjang (link YouTube atau file) jadi klip 9:16 dengan subtitle karaoke, bingkai mengikuti wajah, skor, judul, dan caption.
- **Motion**: membuat video motion graphic 9:16 dari satu topik (naskah → suara → animasi → MP4).

Semua diproses di laptopmu: tanpa watermark, tanpa kuota, dan video tidak diunggah ke mana pun.
AI-nya pakai milikmu sendiri (BYOK): Lokal (gratis tanpa kunci), Gemini (ada kuota gratis), Ollama (gratis, offline), atau langganan Claude/ChatGPT lewat Claude Code, Codex, OpenCode.

## Unduh installer (tanpa Terminal) — versi 2.1
- 🍎 **Download for MacBook** (Apple Silicon): [Studio-Maliki-Mac.dmg](https://github.com/malikisaputra-source/unduh/releases/latest/download/Studio-Maliki-Mac.dmg) — buka, seret ke Applications, pertama kali klik kanan → Buka.
- 🪟 **Download for Windows** 10/11 (tahap uji): [Studio-Maliki-Windows.exe](https://github.com/malikisaputra-source/unduh/releases/latest/download/Studio-Maliki-Windows.exe) — jalankan, ikuti wizard. Layar biru SmartScreen → Info selengkapnya → Tetap jalankan.
- 📱 **Download for Android** 10+ (Klip HP): [KlipHP-Android.apk](https://github.com/malikisaputra-source/unduh/releases/latest/download/KlipHP-Android.apk)

Baru di 2.1: gaya Lime Box, Hook Neon, Serif Elegan, Kertas Sobek (judul pembuka beranimasi), layout Split Podcast, transisi sapuan B-roll.

Versi baru? Unduh dan pasang lagi: Mac pilih "Ganti", Windows otomatis jadi wizard pembaruan. Hasil kerjamu tidak terhapus.
Cara membuat installer sendiri: [`pemasang/README.md`](pemasang/README.md).

## Pasang dari kode (macOS)
1. Unduh ZIP dari GitHub (tombol **Code → Download ZIP**) lalu ekstrak.
2. (Opsional, untuk Motion) Pasang Node.js LTS dari https://nodejs.org
3. Klik dua kali **`Pasang Studio Maliki.command`**.
   Kalau macOS menolak, klik kanan → **Open** → **Open**.
4. Tunggu 1–3 menit. Aplikasi **Studio Maliki** muncul di Desktop dan di folder Applications, lalu terbuka sendiri.

Studio terbuka di **jendela sendiri** (WebKit bawaan macOS), jadi tidak butuh Chrome. Menutup jendela atau menekan
**Matikan Studio** akan menghentikan mesinnya.

## Pasang dari kode (Windows 10/11)
1. Unduh ZIP dari GitHub (tombol **Code → Download ZIP**) lalu ekstrak.
2. (Opsional, untuk Motion) Pasang Node.js LTS dari https://nodejs.org
3. Klik dua kali **`Pasang Studio Maliki (Windows).bat`**.
4. Tunggu 1–3 menit. Pintasan **Studio Maliki** muncul di Desktop dan Start Menu, lalu aplikasinya terbuka.

Jendela aplikasi di Windows memakai Microsoft Edge WebView2 (sudah ada di Windows 10/11 yang terbarui). Suara narator Motion
memakai suara bawaan Windows. Kalau suara Bahasa Indonesia (mis. "Microsoft Andika") terpasang, suara itu yang dipakai.

Hasil kerja tersimpan di folder `~/Studio Maliki` (Windows: `C:\Users\<nama>\Studio Maliki`). Kunci AI disimpan di `~/Studio Maliki/pengaturan.env` (hanya bisa dibaca akunmu).

## Pakai
| Menu | Isi |
|---|---|
| **Klip** | **1. Analisis:** tempel link/seret video → AI, durasi, jumlah (1–30), momen yang dicari, rentang khusus, atau unggah .srt → **Cari momen**. Hasil: pemutar sumber + linimasa (heatmap/energi), ringkasan + hashtag, kartu klip (skor viral, waktu, hook, kutipan, judul yang bisa diubah, caption), cari/filter/urut, salin timestamp/MD, unduh JSON/SRT. **2. Render:** centang klip → studio render (rasio 9:16/1:1/4:3/16:9, latar hitam/blur, fokus otomatis/kiri/tengah/kanan, layout facecam atau PiP, banner hook + awalan/akhiran, subtitle sorot/kotak/garis + font/ukuran/huruf/posisi/warna, musik latar, SFX hook, penguat suara) dengan pratinjau langsung → **Render klip terpilih** |
| **Beranda** | Mulai cepat (Klip/Motion), proyek terakhir bergambar, status AI & suara, tips |
| **Motion** | Tulis topik (butuh AI) atau tempel naskah JSON → pilih satu dari **14 gaya** (Garis, Neon, Kertas + 11 gaya dari template video /kode: Panggung Sinematik, Kata Kunci Minimal, Kolase Kertas, Editorial Hangat, UI Aplikasi Kaca, Bicara + Sisipan, Dokumenter Retro, Tekno Gelap Oranye, Iklan Jasa Krem, Grid Lampu Sorot, Daftar Sumber) → **Buat video** |
| **Riwayat** | Semua proyek lama |
| **Pengaturan AI** | Pilih penyedia AI dan tempel kuncinya |

### Pakai langganan yang sudah kamu punya (tanpa kunci API)
Langganan chat **tidak** termasuk kunci API (Claude Pro, ChatGPT Plus/Pro). Tapi langganan bisa dipakai lewat **CLI resminya**,
yang cukup dipasang dan login sekali di Terminal. Di Studio: **Pengaturan AI → Pakai langganan**, lalu pilih:

| Langganan | Aplikasi CLI | Cara Studio memanggil | Pilihan model |
|---|---|---|---|
| Claude Pro/Max | Claude Code | `claude -p` (tanpa alat, sesi tidak disimpan) | `sonnet`, `opus`, `haiku`, `fable`, atau nama lengkap |
| ChatGPT Plus/Pro | Codex CLI (masuk dengan ChatGPT) | `codex exec -` (sandbox read-only) | `--model`, nama lihat `/model` di Codex |
| Model/penyedia apa pun | OpenCode | `opencode run --agent plan` | daftar otomatis dari `opencode models` |

Pemakaian memotong kuota langgananmu. Studio membuang kunci API dari lingkungan saat memanggil CLI, supaya yang terpakai benar-benar langganan.
Google AI Pro belum disediakan: Gemini CLI sudah tidak melayani akun gratis/AI Pro (pindah ke Antigravity CLI), dan izin memanggilnya dari alat
pihak ketiga belum jelas. Pakai kunci Gemini gratis saja.

### Suara AI lokal: VoxCPM2 (opsional)
Di **Pengaturan AI → suara narator motion**, pilih **VoxCPM2 · AI lokal** lalu klik **Pasang suara AI (±5 GB)**.
- VoxCPM2 dari OpenBMB, lisensi **Apache-2.0**, 30 bahasa termasuk Indonesia (diuji: Whisper membaca balik kalimatnya dengan tepat).
- Tiga warna suara: **Netral**, **Desain dari deskripsi** (mis. "pria muda, hangat, bersemangat"), dan **Clone suaraku** dari rekaman 10–20 detik.
  Clone hanya untuk suaramu sendiri atau suara yang pemiliknya sudah memberi izin.
- Kecepatan di MacBook M5 Pro (GPU Apple/MPS): ±1 detik proses untuk 1 detik suara. Di Windows tanpa GPU NVIDIA akan lambat, jadi tetap pakai suara bawaan.
- Tanpa Studio: `uv run suara/suara.py --teks "Halo" --keluar halo.wav [--referensi suaraku.wav | --desain "…"]`

### Pilihan model
Setiap penyedia punya kotak **Model** di Pengaturan AI (pilih dari daftar atau ketik sendiri):
Gemini (`gemini-3.8-flash`, `3.6-flash`, `3.5-flash-lite`, `3.1-flash-lite`, plus model cadangan otomatis saat sibuk),
Ollama/OpenAI (nama model server),
Claude Code, Codex, dan OpenCode.

### Opsi gratis vs berbayar
- **Gratis:** mode Lokal (tanpa kunci), Gemini (kunci gratis dari aistudio.google.com/apikey), atau Ollama di laptop.
- **Berbayar (memakai langganan yang sudah kamu punya):** Claude Pro/Max lewat Claude Code, ChatGPT Plus/Pro lewat Codex.
  Langganan **Claude Pro tidak termasuk API**. Pengguna Pro bisa pakai mode Lokal, atau minta Claude Code menjalankan `klip/klip.py` dan `motion/buat.mjs`.

## Tanpa aplikasi (Terminal)
Lihat `klip/README.md` dan `motion/README.md`. Server tampilan bisa dijalankan manual:
```bash
uv run studio/studio.py            # jendela aplikasi
uv run studio/studio.py --browser  # atau buka di browser
```

## Bingkai mengikuti pembicara
Pada fokus **Otomatis (wajah)**, Klip mendeteksi pergantian kamera di dalam klip, mencari wajah (depan dan samping) per adegan, lalu menggeser
bingkai 9:16 mengikuti pembicara. Cocok untuk podcast multi-kamera.

## Catatan
- Aplikasi menyalakan server lokal di `127.0.0.1:8787`. Server ini hanya bisa diakses dari laptopmu sendiri.
- Kalau folder `alat` dipindah, jalankan installer lagi.
- Installer Windows sudah dicek dari Mac (semua paket Python tersedia untuk Windows, `uvw.exe` ada di rilis resmi uv),
  tapi **belum dicoba di komputer Windows sungguhan**.
- Hanya potong video milikmu sendiri atau video yang sudah diberi izin.

## Lisensi
Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id.
Gratis dengan **Lisensi Nonkomersial Maliki Studio 1.0**: boleh dipakai untuk belajar, keperluan pribadi, atau usaha/organisasimu sendiri,
boleh diubah dan dibagikan gratis dengan kredit utuh; **dilarang dijual, dijual ulang, disewakan, diunggah ke marketplace, atau dipakai
untuk jasa berbayar ke pihak lain**. Teks lengkap: [`LISENSI.md`](LISENSI.md). Pustaka pihak ketiga (Remotion, faster-whisper, VoxCPM2,
font OFL, dll.) tetap mengikuti lisensinya masing-masing.
