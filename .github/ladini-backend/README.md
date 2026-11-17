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

Pemilik dapat membuat kode editor dan mencabut akses beserta sesi editor. Kode baru hanya ditampilkan saat dibuat. Statistik menghitung browser anonim dan menganggap browser online bila mengirim aktivitas dalam lima menit terakhir. Hitungan dimulai dari pemasangan fitur.

## Dashboard versi terbaru

Menu Konten mengelola tautan bawaan dan tambahan, video, layanan, informasi, dan pengumuman. Tautan bawaan dapat diedit, dihapus dari tampilan, atau dipulihkan. Perubahan disimpan di D1 dan diterapkan ketika halaman dimuat atau setelah perubahan admin disimpan. Tautan baru dapat berupa HTTPS atau hash halaman lokal LADINI. Penomoran SIVA sudah dihapus dari halaman dan navigasi bawaan.

Pilihan Teks Halaman mengelola judul dan isi teks bawaan yang tampil dalam blok terpisah. Gunakan pencarian isi teks untuk menemukan uraian profil atau informasi, lalu edit Isi Teks atau hapus blok tersebut. Penghapusan konten bawaan dapat dibatalkan melalui jenis Konten Dihapus dan tombol Pulihkan. Tautan dan konten tambahan yang dibuat melalui dashboard dapat diedit dan dihapus dari database.

Menu Galeri menerima JPG, PNG, dan WebP maksimal 1 MB per gambar, dengan kapasitas 100 gambar atau 50 MB. Menu Akun Editor tersedia bagi pemilik dan menerima kode pilihan sendiri atau kode acak. Setiap akun dapat mengganti kodenya sendiri melalui Kode Akses dengan memasukkan kode saat ini serta kode baru 10–128 karakter. Sesi lain milik akun berakhir setelah kode diganti.

Secret Worker `CODE_PEPPER` digunakan untuk melindungi kode pilihan. Buat sekali dengan nilai acak panjang melalui `wrangler secret put CODE_PEPPER`. Simpan secret ini tetap sama saat deploy berikutnya agar kode pilihan yang sudah dibuat tetap berlaku. Kode acak pemilik dari versi sebelumnya tetap didukung.

Jam, tanggal, dan zona waktu diambil dari perangkat pengunjung. Statistik hari dan bulan mengikuti zona tersebut. Riwayat yang tercatat sebelum migrasi waktu memakai tanggal pencatatan awalnya.

Pemilik juga memiliki menu Tampilan untuk mengatur nama aplikasi, keterangan, logo/ikon, warna aksen dan background, serta tema gelap, terang atau otomatis mengikuti perangkat. Logo dapat diunggah langsung dari menu Tampilan (PNG/JPG/WebP, maksimal 1 MB), lalu diterapkan ke header, profil dan favicon. Unggahan logo memiliki purpose=logo dan tidak masuk foto galeri. Pilihan gambar background sudah dihapus. Tab tambahan dapat berupa tautan HTTPS/hash internal atau halaman baru dengan teks maksimal 5.000 karakter. Tab dapat diedit, dihapus dan diurutkan melalui tombol Naik. Versi pengaturan mencegah perubahan lama menimpa pengaturan yang baru disimpan di sesi lain. Tombol Keluar berada di kanan bagian sambutan Admin.

## SAPA: penjadwalan Ruang Lingkar Barat

SAPA hanya memakai spreadsheet ORDER RUANG PERTEMUAN (`1Ko90jp7tlq6q4ZsBJaUOQTG2oBdMWNHGhNuOourgd10`), tab Pemesanan SAPA, gid 0. Penghubung versi 3 tidak membaca, menulis, mengimpor, atau memeriksa spreadsheet dan Google Form lain. Setiap pemeriksaan bentrok dan penyimpanan dilakukan pada spreadsheet baru tersebut di bawah satu ScriptLock.

Halaman `#layanan/penjadwalan-kegiatan` menyediakan formulir SAPA, pengecekan ketersediaan dan daftar pemesanan. Ruang Lingkar Barat dipesan seharian untuk semua tanggal mulai sampai selesai (inklusif), maksimal 31 hari. Jam tetap dicatat sebagai informasi. Tanggal ruangan memakai Asia/Jakarta (Sumenep); jam di header mengikuti perangkat pengunjung.

Pengaktifan sekali oleh pemilik spreadsheet baru:
1. Buka ORDER RUANG PERTEMUAN → Extensions → Apps Script. Salin seluruh SAPA-Spreadsheet.gs versi terbaru dan simpan.
2. Jalankan siapkanSAPA dan berikan izin menggunakan akun pemilik spreadsheet baru. Fungsi memeriksa kolom, menyiapkan metadata V–Z, dan membuat SAPA_KEY. Data yang sudah ada tidak dihapus atau ditambah saat penyiapan.
3. Salin SAPA_KEY melalui Project Settings → Script Properties. Jangan simpan kunci dalam HTML, GitHub atau chat.
4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Salin URL /exec.
5. LADINI → Admin → SAPA. Masukkan URL /exec dan SAPA_KEY lalu Periksa dan sambungkan. Worker hanya menerima identitas spreadsheet baru dan penghubung versi 3.

Kode Apps Script membutuhkan otorisasi akun Google pemilik; sekadar menyiapkan spreadsheet belum membuat endpoint web app. Sebelum sambungan aktif, formulir pemesanan ditutup dengan status belum tersambung. Bagian situs lain tetap berfungsi.

Koneksi disimpan terenkripsi AES-GCM dengan turunan CODE_PEPPER; kunci tidak dikirim melalui API publik. Pengiriman ulang dengan ID permintaan yang sama mengembalikan hasil tersimpan. Pemesanan ditolak jika bentrok atau sambungan spreadsheet gagal. Gunakan SAPA untuk pemesanan aktif karena perubahan manual spreadsheet tidak mengikuti ScriptLock.

Publik melihat pemesanan 30 hari terakhir atau jadwal mendatang sampai satu tahun ke depan, dengan filter bidang dan pencarian nama/kegiatan. Tujuan, lampiran, undangan serta catatan hanya diterima Admin. Admin bisa mengedit atau membatalkan pesanan ber-ID SAPA, termasuk data yang sudah ada di spreadsheet baru. Pembatalan membuka tanggal kembali. Kolom A–U mengikuti susunan formulir kegiatan; rincian bidang L–Q dipertahankan pada data yang sudah ada, sedangkan formulir baru mengisi bidang utama di K. Surat/lampiran diisi sebagai tautan HTTPS.

Jika penghubung sebelumnya sudah terpasang, ganti kode lalu Deploy → Manage deployments → Edit → New version. Jangan membuat ulang SAPA_KEY. Sambungkan kembali di Admin → SAPA. Jalankan `node check-sapa.mjs` untuk pengujian script dan API lokal; mock menolak akses ke ID spreadsheet selain file baru dan tidak menyediakan FormApp.
