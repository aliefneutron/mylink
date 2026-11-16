# Motion — dari topik jadi video motion graphic 9:16

Cukup tulis naskah per adegan. Alat ini membuat suara narator, subtitle dengan kata kunci disorot, dan animasi, lalu merender
MP4 **1080×1920**. Ada 3 gaya: `garis`, `neon`, `kertas`. Render di Mac sendiri, tanpa watermark.
Riset ada di `dokumentasi/22-riset-alat-motion.md`.

## Langkah 1 — Pasang Node.js (sekali saja)
Unduh versi LTS dari https://nodejs.org lalu pasang. ffmpeg tidak perlu dipasang terpisah karena Remotion sudah membawanya.

## Langkah 2 — Pasang alat
```bash
cd alat/motion
npm install
```

## Langkah 3 — Coba contoh
```bash
node buat.mjs naskah/contoh.json
```
Hasilnya `hasil/contoh-garis.mp4`. Coba gaya lain:
```bash
node buat.mjs naskah/contoh.json --gaya=neon
```

## Opsi A — Gratis
1. Buka Claude (akun gratis), salin isi `PROMPT-NASKAH.md`, lalu ganti `[TOPIK]` dengan topikmu.
2. Simpan balasan JSON dari Claude sebagai `naskah/topikku.json`.
3. Render:
```bash
node buat.mjs naskah/topikku.json
```
Suara memakai **Damayanti** (suara Indonesia bawaan macOS, gratis).
Ingin suara sendiri? Rekam satu file WAV per adegan, lalu taruh di `rekaman/topikku/01.wav`, `02.wav`, dan seterusnya. Alat otomatis memakainya.

## Opsi B — Berbayar
- **Claude Pro + Claude Code:** ketik *"buat video motion tentang [topik] dengan alat/motion, gaya neon, lalu render"*.
  Claude Code akan menulis JSON, menjalankan `buat.mjs`, dan merevisi sampai pas.
- **Suara lebih natural (ElevenLabs, berbayar):** buat suara tiap adegan, simpan sebagai WAV ke `rekaman/topikku/NN.wav`, lalu render lagi.

## Isi naskah JSON
| Kolom | Arti |
|---|---|
| `judul` | judul video |
| `gaya` | `garis` / `neon` / `kertas` |
| `handle` | teks di pojok atas, mis. `@akunmu` |
| `aksen` | (opsional) warna utama, mis. `"#22C55E"` |
| `adegan[].judul` | tulisan besar di layar (2–5 kata, kata terakhir diberi warna aksen) |
| `adegan[].teks` | kalimat narasi, juga dipakai sebagai subtitle |
| `adegan[].kunci` | kata yang disorot di subtitle |
| `adegan[].ikon` | emoji besar di atas judul |

## Pratinjau dan ubah tampilan
```bash
npm run studio
```
Remotion Studio terbuka di browser. Tema setiap gaya ada di `src/Video.tsx` (objek `TEMA` dan komponen `Latar`).

## Lisensi Remotion
Gratis untuk individu dan perusahaan sampai 3 orang (remotion.dev/license). Tim yang lebih besar perlu lisensi Company.

## Hibrid: klip asli + kartu animasi (gabungan dengan `alat/klip`)
Satu reel yang menyelipkan kartu animasi di antara klip asli: pembuka → kartu "Momen 1" → klip 1 → kartu "Momen 2" → klip 2 → ajakan.
1. Potong dulu video panjangnya dengan `alat/klip` (hasilnya `alat/klip/hasil-klip/klip.json` dan `klip-NN.mp4`).
2. Buat naskah hibrid:
```bash
node hibrid.mjs ../klip/hasil-klip --gaya=neon --judul="Judul videomu" --handle=@akunmu
```
3. Ubah teks kartu di `naskah/hibrid.json` sendiri (gratis) atau minta Claude (Pro: Claude Code bisa langsung mengedit dan merender).
4. Render:
```bash
node buat.mjs naskah/hibrid.json
```
Setiap adegan yang punya `"video": "path/ke/klip.mp4"` diputar layar penuh dengan label judul di atas (subtitle karaoke sudah ada dari `alat/klip`).
Adegan tanpa `video` menjadi kartu animasi bersuara. Kartu dan klip bisa dicampur dalam urutan apa pun.

## Topik → naskah otomatis dengan AI milikmu sendiri (opsional)
```bash
cp .env.contoh .env
```
Isi kunci AI-mu di `.env` (Gemini gratis, Ollama gratis, atau OpenAI-compatible; langganan Claude/ChatGPT lewat CLI di Studio), lalu:
```bash
node naskah.mjs "3 kebiasaan pagi produktif" --ai=gemini --gaya=neon
```
```bash
node buat.mjs naskah/3-kebiasaan-pagi-produktif.json
```
Periksa isi naskah sebelum render, karena AI bisa salah. Langganan Claude Pro **tidak** termasuk API. Pengguna Pro pakai
`PROMPT-NASKAH.md` di claude.ai, atau minta Claude Code membuat naskah dan merender langsung.
File `.env` berisi kuncimu. Jangan dibagikan ke orang lain.
