# Mesin lokal FlexCut

Mesin ini menghubungkan FlexCut dengan klip, 24 template Remotion, dan suara VoxCPM2 dari Studio Maliki.

Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id

Sumber https://github.com/malikisaputra-source/studio-maliki dengan Lisensi Nonkomersial Maliki Studio 1.0. Lisensi dan kredit disertakan di ../vendor/studio-maliki. Penggunaan jasa berbayar membutuhkan izin tertulis kreator.

## Mulai di Windows

1. Ekstrak seluruh ZIP ke satu folder. Pasang Node.js LTS dan Python jika belum tersedia.
2. Klik dua kali **Mulai FlexCut.cmd**. Peluncur menyiapkan uv dan Python 3.12 bila dibutuhkan.
3. FlexCut terbuka pada http://127.0.0.1:8791/app/. Pertahankan jendela mesin selama dipakai.
4. Buka **Motion & Klip → Koneksi** dan hubungkan mesin. Klik **Siapkan Motion**, **Siapkan Klip**, atau **Siapkan suara lokal** sesuai fitur yang dipakai.

Pada macOS/Linux jalankan uv run --no-project --python 3.12 local-engine/server.py. Node.js diperlukan.

Versi GitHub Pages juga bisa terhubung ke mesin yang sedang berjalan. Isi alamat http://127.0.0.1:8791 pada panel Koneksi dan izinkan akses jaringan lokal jika browser memintanya.

## AI

Mode lokal menerima naskah JSON atau menyusun poin dari template gratis. Ollama memerlukan server dan model Ollama yang sudah berjalan. Pilihan Gemini dan OpenAI-compatible memakai API key dan model akun masing-masing. Claude Code, Codex, dan OpenCode memerlukan CLI resmi yang sudah terpasang dan login. Kuota langganan chat dan kuota API mengikuti penyedia masing-masing.

API key disimpan pada ~/FlexCut Studio/pengaturan.env. Folder ini juga menyimpan hasil dan mesin render. Jangan unggah folder data tersebut ke GitHub.

## Suara dan kloning

VoxCPM2 mengunduh model sekitar 5 GB pada penyiapan pertama. Pilih netral, desain suara, atau unggah rekaman referensi 10–20 detik untuk kloning. Pakai rekaman suara sendiri atau rekaman yang telah mendapat izin. Model berjalan lokal dan proses di CPU dapat membutuhkan waktu lebih lama.

Hasil WAV dan MP4 dapat dimasukkan ke timeline melalui tombol **Tambahkan ke timeline**. Klip menyediakan analisis momen, pemilihan klip, subtitle, dan pembingkaian wajah melalui mesin asli.
