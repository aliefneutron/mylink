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

Halaman `#layanan/penjadwalan-kegiatan` menyediakan formulir SAPA, pengecekan ketersediaan dan daftar pemesanan. Hanya Ruang Lingkar Barat yang dapat dipesan. Setiap pemesanan memblokir satu hari penuh pada semua tanggal mulai sampai selesai (inklusif), maksimal 31 hari. Jam kegiatan tetap dicatat tetapi tidak digunakan sebagai slot pemesanan. Hari ruangan mengikuti waktu Sumenep (Asia/Jakarta); jam perangkat di header situs tetap mengikuti perangkat pengunjung.

Google Sheet `1T6Hs4KLAMvxOO-mMmAt7xKDlJLCRHNqBvMMUH2cXKdg`, tab **Kegiatan Harian Bidang** (gid 1258200469), menjadi sumber data utama. Penulisan diperiksa dan dilakukan di bawah satu Apps Script ScriptLock. Pengiriman ulang dengan ID permintaan sama mengembalikan pesanan yang telah tersimpan. Tidak ada jalur penyimpanan lokal yang mengabaikan spreadsheet ketika sambungan gagal. Kolom A–U dipertahankan; metadata SAPA menggunakan kolom V–Z yang harus kosong atau sudah memakai header SAPA. Rincian bidang di L–Q tidak diubah untuk data lama; formulir baru menulis bidang utama di K. Lampiran formulir baru berupa tautan HTTPS, bukan unggahan berkas langsung.

### Pengaktifan sekali oleh pemilik spreadsheet

1. Buka spreadsheet tersebut → **Extensions → Apps Script**. Tambahkan file script dan salin seluruh `SAPA-Spreadsheet.gs`. Jika ada fungsi `doPost` lain, gunakan proyek Apps Script terpisah agar tidak bertabrakan; ID spreadsheet sudah tertanam di script.
2. Simpan lalu jalankan **siapkanSAPA**. Otorisasi memakai akun pemilik spreadsheet/form. Fungsi memeriksa header, menambahkan metadata V–Z, membuat kunci koneksi, dan **menutup penerimaan Google Form yang terhubung ke spreadsheet** supaya pesanan baru tidak melewati pengecekan. Data lama tidak dihapus. Jika form dibuka kembali, penghubung menolak pemesanan baru sampai penerimaan form ditutup.
3. Di **Project Settings → Script Properties**, salin nilai **SAPA_KEY**. Jangan masukkan kunci ke HTML atau commit ke GitHub.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Salin URL yang berakhiran `/exec`.
5. LADINI → **Admin → SAPA**. Masukkan URL `/exec` dan SAPA_KEY lalu **Periksa dan sambungkan**. Worker memeriksa identitas spreadsheet dan menyimpan koneksi terenkripsi AES-GCM menggunakan turunan secret `CODE_PEPPER`. Kunci tidak ditampilkan oleh API publik atau dashboard setelah disimpan.

Sebelum langkah ini selesai, formulir publik dinonaktifkan dan menampilkan status belum dibuka. Pengaktifan Apps Script membutuhkan akun Google pemilik dan tidak dilakukan hanya dengan menerbitkan HTML atau Worker.

Data lama yang menyebut Lingkar Barat/Jokotole/Gedungan/Selatan ikut memblokir tanggal. Lokasi Utara/Dr. Cipto, Labkesda, hotel, puskesmas dan lokasi luar yang jelas diabaikan. Lokasi generik seperti “Ruang Pertemuan Dinkes” diperlakukan sebagai belum pasti dan ikut memblokir tanggal; admin perlu memperjelas kolom I pada baris lama jika diperlukan. Tanggal teks lama memakai urutan bulan/hari/tahun sesuai locale en_US spreadsheet; nilai tanggal native memakai timezone spreadsheet/ruangan.

Daftar publik secara default menampilkan pemesanan yang dicatat dalam 30 hari kalender terakhir, dengan filter bidang dan pencarian nama/kegiatan. Opsi Jadwal Mendatang menampilkan jadwal yang belum selesai sampai satu tahun ke depan. Publik tidak menerima catatan, tujuan, lampiran atau undangan. Admin dapat mengedit dan membatalkan pemesanan SAPA; pembatalan membuka kembali tanggal. Baris lama tanpa ID SAPA dikelola langsung di spreadsheet. Operasi langsung oleh editor di spreadsheet tidak mengikuti ScriptLock: gunakan SAPA untuk memasukkan dan mengubah pemesanan aktif.

Untuk memperbarui penghubung yang sudah aktif, simpan kode baru dan **Deploy → Manage deployments → Edit → New version** agar URL tetap sama. Jangan membuat ulang SAPA_KEY. Jalankan `node check-sapa.mjs` untuk pengujian lokal script dan API (memakai mock Apps Script dan SQLite, tidak menulis data produksi).
