# Mesin lokal FlexCut

Mesin ini menghubungkan FlexCut dengan klip dan 24 template Remotion dari Studio Maliki.

Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id

Sumber https://github.com/malikisaputra-source/studio-maliki dengan Lisensi Nonkomersial Maliki Studio 1.0. Lisensi dan kredit disertakan di ../vendor/studio-maliki. Penggunaan jasa berbayar membutuhkan izin tertulis kreator.

## Mulai di Windows

1. Ekstrak seluruh ZIP ke satu folder. Pasang Node.js LTS dan Python jika belum tersedia.
2. Klik dua kali **Mulai FlexCut.cmd**. Peluncur menyiapkan uv dan Python 3.12 bila dibutuhkan.
3. FlexCut terbuka pada http://127.0.0.1:8791/app/. Pertahankan jendela mesin selama dipakai.
4. Buka **Motion & Klip → Mesin lokal** dan hubungkan mesin. Klik **Siapkan Motion** atau **Siapkan Klip** sesuai fitur yang dipakai.

Pada macOS/Linux jalankan uv run --no-project --python 3.12 local-engine/server.py. Node.js diperlukan.

Versi GitHub Pages juga bisa terhubung ke mesin yang sedang berjalan. Isi alamat http://127.0.0.1:8791 pada panel Koneksi dan izinkan akses jaringan lokal jika browser memintanya.

## AI

Mode lokal menerima naskah JSON atau menyusun poin dari template gratis. Ollama memerlukan server dan model Ollama yang sudah berjalan. Pilihan Gemini dan OpenAI-compatible memakai API key dan model akun masing-masing. Claude Code, Codex, dan OpenCode memerlukan CLI resmi yang sudah terpasang dan login. Kuota langganan chat dan kuota API mengikuti penyedia masing-masing.

API key disimpan pada ~/FlexCut Studio/pengaturan.env. Folder ini juga menyimpan hasil dan mesin render. Jangan unggah folder data tersebut ke GitHub.

## Kloning suara lokal (tanpa API)

Di FlexCut, buka **Motion & Klip → Kloning suara**. Pilih salah satu mesin, keduanya berjalan di komputer Anda:

| Mesin | Ukuran model | Cocok untuk |
|---|---|---|
| **Pocket TTS Indonesian** (ringan) | ±0,5 GB | Laptop biasa tanpa GPU. Cocok untuk satu suara narator. |
| **VoxCPM2** (kualitas tinggi) | ±5 GB | Suara paling natural. Butuh RAM 16 GB, dan GPU agar cepat. |

Pertama kali memakai sebuah mesin, panel menjelaskan prosedurnya: klik **Unduh model**, tunggu sampai selesai dengan jendela mesin tetap terbuka, lalu model tersimpan dan tidak diunduh lagi. Setelah itu unggah rekaman 10–20 detik, tulis narasi, centang pernyataan izin, dan klik **Buat narasi**. Tidak perlu transkrip, API key, atau server. Hanya tersedia pada mesin lokal, tidak pada mode server.

Peluncur memasang `uv` otomatis bila belum ada. Node.js hanya diperlukan untuk fitur Motion. Pocket TTS menuliskan angka dengan huruf secara otomatis dan mengubah tanda seru menjadi titik.

Gunakan hanya suara sendiri atau suara yang sudah memberi izin, dan beri label "suara AI" saat mengunggah hasilnya.

Kredit: VoxCPM2 oleh OpenBMB (Apache-2.0). Pocket TTS Indonesian oleh anak10thn, berdasarkan Kyutai pocket-tts, berlisensi CC-BY-4.0 dengan data latih LEMAS Project. Template suara oleh Maliki Saputra (@malikisaputra).

Hasil WAV dan MP4 dapat dimasukkan ke timeline melalui tombol **Tambahkan ke timeline**. Klip menyediakan analisis momen, pemilihan klip, subtitle, dan pembingkaian wajah melalui mesin asli.
