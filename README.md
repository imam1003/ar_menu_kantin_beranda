# AR Menu Kantin Beranda

## Isi
- `ar.html`: halaman web AR
- `ar.css`: tampilan antarmuka
- `ar.js`: WebXR hit-test, penempatan otomatis, tombol kategori
- `assets/`: empat poster menu asli

## Menjalankan
1. Unggah seluruh isi folder ini ke satu repository GitHub. Jangan mengubah struktur folder `assets`.
2. Di GitHub buka Settings → Pages → Deploy from a branch → pilih `main` dan `/ (root)` → Save.
3. Tunggu alamat Pages aktif, lalu buka `ar.html` dari alamat HTTPS Pages, misalnya `https://username.github.io/nama-repo/ar.html`.
4. Di Samsung Galaxy A36, perbarui Chrome, aktifkan izin kamera untuk situs, dan gunakan pencahayaan cukup.
5. Tekan **Mulai kamera AR** dan izinkan kamera. Arahkan HP perlahan ke meja; menu seharusnya muncul otomatis ketika WebXR menghasilkan hit-test.

## Catatan kompatibilitas penting
Markerless AR ini membutuhkan browser yang mendukung `navigator.xr`, sesi `immersive-ar`, fitur `hit-test`, dan dukungan ARCore pada perangkat. HTTPS wajib. Dukungan dapat berbeda menurut versi Chrome, layanan Google Play untuk AR, dan konfigurasi perangkat.

Jika tidak tersedia, halaman akan menampilkan pratinjau gambar biasa. Pratinjau tersebut bukan AR. Jangan menganggap tampilan kamera penuh layar sebagai bukti bahwa permukaan meja berhasil dideteksi.

## Jika AR tidak bekerja
- Buka melalui HTTPS, bukan `file://` atau Live Server HTTP.
- Coba Chrome Android versi terbaru.
- Pastikan layanan Google Play untuk AR tersedia/aktif pada perangkat.
- Pastikan browser/device mendukung `immersive-ar` dan `hit-test`.
- Periksa Console pada desktop Chrome remote debugging jika sesi gagal.
