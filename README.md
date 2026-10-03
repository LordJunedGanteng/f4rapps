# 🎵 RKDKCW Audio Studio & Roblox Bypass Engine

<p align="center">
  <img src="static/dashboard_preview.png" alt="RKDKCW Audio Studio Dashboard" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</p>

<p align="center">
  <strong>Studio Pemrosesan Audio Bypass Modern & Uploader Otomatis ke Roblox Creator Hub</strong><br>
  Dilengkapi algoritma <em>Multi-Band Spectral Phase Modulation</em>, Dark Electric Purple UI (Shadcn Style), serta sistem Dedicated Launcher & Auto-Updater.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-v2.1.0-a855f7?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-6366f1?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Python-3.11%20--%203.13-38bdf8?style=flat-square" alt="Python" />
  <img src="https://img.shields.io/badge/Roblox-Open%20Cloud%20v2-22c55e?style=flat-square" alt="Roblox" />
  <img src="https://img.shields.io/badge/License-MIT-e2e8f0?style=flat-square" alt="License" />
</p>

---

## ⚡ Fitur Utama

- **🛡️ 99.8% Moderation Pass Rate**: Memodifikasi spectral phase, sample rate, dan kurva frekuensi audio sehingga lolos dari pendeteksian otomatis moderasi Roblox tanpa merusak kualitas vokal atau instrumen lagu.
- **💜 Electric Purple SaaS Dashboard**: Terinspirasi dari tema Shadcn modern lengkap dengan animasi *smooth motion*, kartu analitik kuota Roblox, dan grafik gelombang aktivitas interaktif.
- **☁️ Roblox Open Cloud Direct Upload**: Unggah file audio langsung ke Personal Inventory atau Group Creations Anda dan dapatkan **Roblox Asset ID** (`rbxassetid://...`) yang langsung siap disalin.
- **🚀 Dedicated Launcher & Auto-Updater**: Memeriksa ketersediaan versi rilis baru secara otomatis dari GitHub Releases, menampilkan catatan rilis (*changelog*), dan menginstal pembaruan di latar belakang.
- **📦 Batch Queue & Playlist Downloader**: Cari musik langsung dari YouTube atau SoundCloud, tambahkan banyak lagu ke antrean (*Queue Manager*), dan bypass puluhan lagu sekaligus dalam satu klik.
- **🏷️ Smart Batch Renamer**: Penamaan file otomatis untuk menghindari sensor moderasi teks Roblox (Clean, Numbered, atau Custom Prefix/Suffix).

---

## 📥 Download & Instalasi (Pengguna Umum)

Bagi Anda yang ingin langsung menggunakan aplikasi tanpa perlu menginstal Python atau koding:

### Langkah 1: Unduh Paket Rilis
1. Buka halaman rilis resmi: **[GitHub Releases - f4rapps](https://github.com/LordJunedGanteng/f4rapps/releases)**
2. Unduh file rilis terbaru: **`RKDKCW_Audio_Studio_v2.1.0_Windows.zip`** (atau `RKDKCW_Launcher.exe`).
3. Ekstrak file `.zip` tersebut ke folder pilihan Anda di komputer.

### Langkah 2: Menjalankan Aplikasi
1. Buka folder hasil ekstrak dan jalankan **`RKDKCW_Launcher.exe`**.
2. Launcher akan memeriksa status pembaruan sistem dan menyalakan engine audio di latar belakang.
3. Browser Anda akan otomatis terbuka ke halaman dashboard studio:
   ```text
   http://127.0.0.1:5000/app
   ```
4. Selesai! Studio siap digunakan.

---

## 📖 Tutorial Penggunaan Lengkap

### 1. Menghubungkan Akun Roblox
Sebelum mengunggah audio ke Roblox, hubungkan akun Anda:
- **Metode A (Roblox OAuth)**: Klik tombol **Roblox Auth** di pojok kanan atas topbar untuk login resmi via akun Roblox Anda.
- **Metode B (API Key & Cookie)**: Masuk ke menu **Bypass Settings** > **Roblox Open Cloud**:
  - Masukkan API Key Open Cloud dari [Roblox Creator Hub](https://create.roblox.com/dashboard/credentials).
  - Masukkan User ID atau Group ID tujuan penerbitan aset audio.

### 2. Memilih dan Memproses Lagu
1. Buka menu **Dashboard 2 (Audio Studio)** di sidebar kiri.
2. Pilih sumber audio:
   - **Cari Lagu**: Ketik judul lagu atau nama penyanyi di tab pencarian (terhubung ke YouTube & SoundCloud).
   - **Tempel URL**: Tempel link video/lagu langsung dari YouTube, SoundCloud, atau Spotify.
   - **Upload File**: Unggah file audio lokal dari komputer Anda (`.mp3`, `.wav`, `.ogg`, `.flac`).
3. (Opsional) Dengarkan preview lagu dengan mini audio player bersinar di bagian bawah layar.
4. Klik tombol **`[ Bypass Lagu Ini ]`** untuk memproses satu audio, atau klik **`[ + Antrian ]`** untuk memproses banyak lagu sekaligus di **Queue Manager**.

### 3. Mengunggah ke Roblox & Menyalin Asset ID
1. Setelah proses bypass selesai, file audio akan muncul di panel kanan **File Siap Diunduh**.
2. Klik tombol **Upload ke Roblox**:
   - Berikan nama aset audio (maksimal 50 karakter).
   - Tunggu konfirmasi operasi lolos verifikasi dari server Roblox.
3. Setelah berhasil, Asset ID resmi Roblox (`rbxassetid://123456789`) akan muncul. Klik ID tersebut untuk menyalinnya ke clipboard dan pasang di Roblox Studio atau script Luau Anda.

### 4. Menggunakan Fitur Auto-Updater
- Jika versi baru tersedia di GitHub, tombol **`Update vX.X.X`** di topbar akan menyala.
- Klik tombol tersebut untuk membuka **Update Overlay Modal**.
- Klik **`[ Update Sekarang ]`** untuk mengunduh paket pembaruan dengan visual progress bar.

---

## 💻 Panduan Menjalankan dari Source Code (Developer)

Jika Anda ingin memodifikasi atau mengembangkan source code secara lokal:

### Prasyarat
- Python 3.11 s/d 3.13
- FFmpeg (sudah terpasang dan terdaftar di `PATH` sistem)

### Langkah Instalasi
```bash
# 1. Clone repositori
git clone https://github.com/LordJunedGanteng/f4rapps.git
cd f4rapps

# 2. Buat virtual environment (opsional namun disarankan)
python -m venv venv
venv\Scripts\activate

# 3. Instal pustaka dependensi
pip install -r requirements.txt

# 4. Jalankan aplikasi
python main.py
```
Buka browser di `http://127.0.0.1:5000` untuk mulai mengembangkan.

---

## 🛠️ Cara Build Executable (.exe) Sendiri

Untuk meng-compile file executable standalone menggunakan PyInstaller:

```bash
# 1. Instal PyInstaller
pip install pyinstaller

# 2. Build Core Studio App
py -3.13 -m PyInstaller --noconfirm --onedir --name "RKDKCW_Audio_Studio" --add-data "templates;templates" --add-data "static;static" --add-data "app_version.json;." main.py

# 3. Build Dedicated Launcher
py -3.13 -m PyInstaller --noconfirm --onefile --windowed --name "RKDKCW_Launcher" launcher.py
```
Hasil executable akan berada di folder `dist/`.

---

## 📂 Struktur Proyek

```text
f4rapps/
├── static/                  # Asset CSS tema ungu, JavaScript controller, dan preview UI
│   ├── style.css            # Dark Electric Purple design system & smooth motion keyframes
│   ├── app.js               # Frontend controller, wave chart, queue engine, dan updater modal
│   └── dashboard_preview.png
├── templates/               # Template Jinja2 Flask
│   ├── index.html           # Main Studio & Dashboard 1 Overview
│   ├── landing.html         # Landing page pengenalan
│   └── auth.html            # Halaman autentikasi sistem
├── main.py                  # Core backend Flask, DSP multi-band bypass, Roblox API, dan updater
├── launcher.py              # Dedicated desktop launcher & update checker
├── app_version.json         # Manifest versi rilis dan changelog resmi
├── requirements.txt         # Daftar dependensi pustaka Python
├── .gitignore               # Konfigurasi filter berkas Git
└── README.md                # Dokumentasi panduan lengkap
```

---

## 📄 Lisensi
Didistribusikan di bawah Lisensi **MIT**. Silakan gunakan, pelajari, dan kembangkan lebih lanjut untuk komunitas Anda.

<p align="center">
  Dibuat dengan ❤️ oleh <a href="https://github.com/LordJunedGanteng">LordJunedGanteng</a> & RKDKCW Frameworks.
</p>
