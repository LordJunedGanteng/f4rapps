@echo off
title F4RRRR Web Server
color 0b

:: Pindah ke direktori tempat file start.bat berada
cd /d "%~dp0"

:: Cek apakah main.py ada di folder ini atau di subfolder f4rrrr-main
if not exist "main.py" (
    if exist "f4rrrr-main\main.py" (
        cd f4rrrr-main
    ) else (
        echo [ERROR] main.py tidak ditemukan!
        echo Pastikan start.bat berada di dalam folder project.
        echo.
        pause
        exit /b 1
    )
)

echo ===================================================
echo             F4RRRR SERVER LAUNCHER
echo ===================================================
echo.

:: Deteksi Python yang tersedia
set "PYTHON_CMD="

:: Coba python default terlebih dahulu
python -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    py -3.13 -V >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=py -3.13"
    ) else (
        py -V >nul 2>&1
        if %errorlevel% equ 0 (
            set "PYTHON_CMD=py"
        )
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERROR] Python tidak ditemukan di sistem!
    echo Silakan install Python terlebih dahulu atau tambahkan ke PATH.
    echo.
    pause
    exit /b 1
)

echo [*] Menggunakan:
%PYTHON_CMD% --version
echo.

:: Cek apakah modul utama sudah terinstall
%PYTHON_CMD% -c "import yt_dlp, flask, pydub, requests" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Dependensi belum terinstall di Python ini.
    echo [*] Sedang menginstall dependensi...
    echo.
    %PYTHON_CMD% -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [!] Mencoba install paket inti secara langsung...
        %PYTHON_CMD% -m pip install yt-dlp pydub flask requests psutil python-dotenv audioop-lts
    )
    echo.
)

echo [*] Menjalankan server F4RRRR di http://localhost:5000 ...
echo [*] Tekan Ctrl+C untuk menghentikan server.
echo ===================================================
echo.

:: Jalankan aplikasi
%PYTHON_CMD% main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Program berhenti dengan error (exit code: %errorlevel%).
    echo Silakan periksa pesan error di atas atau file crash_log.txt.
    echo.
    pause
)
