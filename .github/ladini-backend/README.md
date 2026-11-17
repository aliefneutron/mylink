# Admin dan statistik LADINI

GitHub Pages menyajikan halaman publik. Cloudflare Worker menerima permintaan admin dan D1 menyimpan akun, tautan, serta statistik. Panel mengelola tautan tambahan. Pada situs publik, menu Admin dan widget statistik ditampilkan setelah URL API dikonfigurasi.

## Pratinjau lokal

Gunakan Node.js 24 atau lebih baru. Di PowerShell, setel kode khusus pratinjau dan jalankan server.

```powershell
$env:LADINI_PREVIEW_CODE = node -p "'LDN-' + require('node:crypto').randomBytes(24).toString('hex')"
node preview.mjs
```

Jika menjalankan dari folder `.github/ladini-backend` di repositori, buat HTML khusus pratinjau dengan `node build.mjs ../../ladini/index.html index.html`, lalu jalankan `node preview.mjs`. File pratinjau adalah hasil lokal, jadi jangan commit file tersebut.

Buka `http://127.0.0.1:8790/`. Masukkan nilai variabel `LADINI_PREVIEW_CODE` pada menu Admin untuk membuat akun pemilik. Data pratinjau disimpan di memori. Jika butuh data lokal yang bertahan saat server berhenti, isi `LADINI_DB` dengan path file SQLite lokal.

`node check.mjs` menguji autentikasi, hak akses, konten, dan penghitung menggunakan basis data lokal terpisah.

## Aktifkan online

1. Masuk ke akun Cloudflare pemilik dengan `npx wrangler login`. Jalankan `npx wrangler d1 create ladini` dan isi `database_id` pada `wrangler.toml` dengan ID yang diberikan. `SITE_ORIGIN` sudah disetel ke domain LADINI.
2. Jalankan `npx wrangler d1 migrations apply ladini --remote`, lalu `npx wrangler deploy`.
3. Buat kode pemilik acak yang panjang melalui pengelola kata sandi. Simpan sebagai secret Worker menggunakan `npx wrangler secret put BOOTSTRAP_CODE`. Masukkan kode hanya pada prompt Wrangler dan menu Admin. Kode minimal 24 karakter.
4. Gunakan URL Worker yang dicetak oleh perintah deploy. Dari folder `.github/ladini-backend`, jalankan `node build.mjs ../../ladini/index.html ../../ladini/index.html https://ALAMAT-WORKER`. Jika menggunakan paket unduhan, jalankan `node build.mjs site-base.html index.html https://ALAMAT-WORKER`.
5. Ganti `ladini/index.html` di branch `main` repositori `aliefneutron/mylink` dengan HTML hasil build. Setelah publikasi, buka LADINI dan masuk sebagai pemilik. Sesudah pemilik berhasil masuk untuk pertama kali, secret `BOOTSTRAP_CODE` dapat dihapus karena basis data sudah menyimpan hash kode pemilik.

Pemilik dapat membuat kode editor dan mencabut akses beserta sesi editor. Kode baru hanya ditampilkan saat dibuat. Statistik memakai waktu Jakarta, menghitung browser anonim, serta menganggap browser online bila mengirim aktivitas dalam lima menit terakhir. Hitungan dimulai dari pemasangan fitur.
