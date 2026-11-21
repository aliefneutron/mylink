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

## Kloning suara lokal (VoxCPM2, tanpa API)

Di FlexCut, buka **Motion & Klip → Kloning suara**. Panel ini memakai VoxCPM2 (OpenBMB, Apache-2.0) yang berjalan di komputer Anda lewat mesin lokal. Klik **Pasang VoxCPM2** sekali (unduhan ±5 GB), unggah rekaman 10–20 detik, tulis narasi, centang pernyataan izin, lalu klik **Buat narasi**. Tidak perlu transkrip, API key, atau server. Hanya tersedia pada mesin lokal, tidak pada mode server. Gunakan hanya suara sendiri atau suara yang sudah memberi izin, dan beri label "suara AI" saat mengunggah hasilnya.

## Kloning suara lewat Voicebox

Di FlexCut, buka **Motion & Klip → Kloning suara**. Masukkan alamat HTTPS server Voicebox, pilih bahasa dan model, lalu unggah rekaman referensi beserta transkripnya. Setelah proses selesai, unduh WAV atau tambahkan ke timeline.

Untuk menyiapkan server, ikuti [petunjuk Docker Voicebox](https://github.com/jamiepine/voicebox#download). Letakkan API di balik reverse proxy HTTPS dengan autentikasi Bearer dan atur `VOICEBOX_CORS_ORIGINS` ke `https://aliefneutron.my.id`. Jika FlexCut juga dibuka dari paket lokal, tambahkan `http://127.0.0.1:8791` sebagai origin dengan pemisah koma. Izinkan permintaan OPTIONS tanpa token untuk preflight CORS, dengan akses API lainnya dilindungi token.

Integrasi menggunakan API `/health`, `/profiles`, `/generate`, `/history/{id}`, dan `/audio/{id}`. FlexCut meminta Voicebox menghapus profil sementara setelah pekerjaan selesai. Server Voicebox menyimpan model dan menjalankan proses kloning.

Hasil WAV dan MP4 dapat dimasukkan ke timeline melalui tombol **Tambahkan ke timeline**. Klip menyediakan analisis momen, pemilihan klip, subtitle, dan pembingkaian wajah melalui mesin asli.
