# Server mesin FlexCut (tanpa instalasi lokal)

Motion (Remotion) dan Klip (transkripsi, pembingkaian wajah, render) membutuhkan Node.js, Python, dan ffmpeg,
jadi prosesnya berjalan di sebuah server. FlexCut di browser hanya mengirim perintah, sama seperti Voicebox.

## Kebutuhan server
- VPS Linux dengan Docker dan Docker Compose. Disarankan minimal 4 vCPU dan 8 GB RAM (render dan transkripsi berat).
- Satu domain/subdomain yang mengarah ke IP server (record A), port 80 dan 443 terbuka.

## Pasang
```bash
git clone https://github.com/aliefneutron/mylink.git
cd mylink/flexcut-studio/server
cp .env.example .env      # isi FLEXCUT_DOMAIN, FLEXCUT_TOKEN, FLEXCUT_ORIGINS
docker compose up -d --build
```
Caddy mengurus sertifikat HTTPS otomatis. Cek `https://DOMAIN/api/flexcut/health`; harus muncul JSON `"service": "flexcut-motion"`.

## Hubungkan dari FlexCut
Motion & Klip -> Mesin: isi alamat `https://DOMAIN` dan token, klik **Hubungkan mesin**,
lalu klik **Siapkan Motion** dan **Siapkan Klip** satu kali (mengunduh dependensi ke volume server).

## Keamanan
- Server menolak start bila `FLEXCUT_HOST` bukan alamat lokal dan `FLEXCUT_TOKEN` kurang dari 24 karakter.
- Semua endpoint selain health dan berkas aplikasi memerlukan `Authorization: Bearer <token>`.
- Hanya origin di `FLEXCUT_ORIGINS` yang boleh memanggil server dari browser.
- Sumber klip hanya tautan http(s) atau berkas yang diunggah lewat FlexCut; path server lain ditolak.
- Pemasangan CLI, login CLI, dan penarikan model Ollama dinonaktifkan pada mode server.
- API key AI disimpan di volume `/data` server. Gunakan token yang kuat dan jangan bagikan.
