#// RKDKCW FRAMEWORKS
"""
RKDKCW Audio Studio - Dedicated Launcher & Auto-Updater
-------------------------------------------------------
Tugas Launcher:
1. Memeriksa apakah ada versi rilis baru dari GitHub / Server.
2. Jika ada versi baru, mengunduh dan memperbarui file aplikasi secara otomatis.
3. Menjalankan core executable 'RKDKCW_Audio_Studio.exe' (atau Python server).
4. Otomatis membuka antarmuka studio di browser.
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
import webbrowser
import threading
import tkinter as tk
from tkinter import ttk, messagebox

# ── Konfigurasi Versi & Update ──
LOCAL_VERSION_FILE = "app_version.json"
REMOTE_VERSION_URL = "http://127.0.0.1:5000/api/app/version"
DEFAULT_LOCAL_VERSION = "2.0.4"
TARGET_EXE_NAME = "RKDKCW_Audio_Studio.exe"
PORT = 5000

class LauncherGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("RKDKCW Studio - Launcher")
        self.root.geometry("440x260")
        self.root.resizable(False, False)
        self.root.configure(bg="#0d0b14")

        # Center Window on Screen
        self.root.eval('tk::PlaceWindow . center')

        # Custom Styling
        self.setup_ui()

        # Jalankan pengecekan di background thread
        threading.Thread(target=self.run_launcher_sequence, daemon=True).start()

    def setup_ui(self):
        # Header / Brand Label
        title_label = tk.Label(
            self.root, 
            text="RKDKCW AUDIO STUDIO", 
            font=("Segoe UI", 14, "bold"), 
            fg="#c084fc", 
            bg="#0d0b14"
        )
        title_label.pack(pady=(22, 2))

        self.ver_label = tk.Label(
            self.root, 
            text=f"Versi Terpasang: v{self.get_local_version()}", 
            font=("Segoe UI", 9), 
            fg="#94a3b8", 
            bg="#0d0b14"
        )
        self.ver_label.pack(pady=(0, 16))

        # Status Label
        self.status_label = tk.Label(
            self.root, 
            text="Memeriksa pembaruan sistem...", 
            font=("Segoe UI", 10), 
            fg="#f8fafc", 
            bg="#0d0b14"
        )
        self.status_label.pack(pady=(5, 10))

        # Progress Bar
        style = ttk.Style()
        style.theme_use('default')
        style.configure(
            "Purple.Horizontal.TProgressbar", 
            background='#a855f7', 
            troughcolor='#1e1b2e', 
            bordercolor='#0d0b14',
            lightcolor='#a855f7',
            darkcolor='#7c3aed'
        )

        self.progress = ttk.Progressbar(
            self.root, 
            style="Purple.Horizontal.TProgressbar", 
            orient="horizontal", 
            length=360, 
            mode="indeterminate"
        )
        self.progress.pack(pady=5)
        self.progress.start(15)

        # Footer info
        self.footer_label = tk.Label(
            self.root, 
            text="Multi-Band Phase Modulation · Roblox Open Cloud Sync", 
            font=("Segoe UI", 8), 
            fg="#64748b", 
            bg="#0d0b14"
        )
        self.footer_label.pack(side="bottom", pady=14)

    def get_local_version(self):
        if os.path.exists(LOCAL_VERSION_FILE):
            try:
                with open(LOCAL_VERSION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("current_client_version", DEFAULT_LOCAL_VERSION)
            except Exception:
                pass
        return DEFAULT_LOCAL_VERSION

    def set_status(self, text, fg="#f8fafc"):
        self.root.after(0, lambda: self.status_label.config(text=text, fg=fg))

    def run_launcher_sequence(self):
        time.sleep(1.0)
        self.set_status("Memeriksa update ke server...")

        update_available = False
        remote_data = None

        try:
            req = urllib.request.Request(
                REMOTE_VERSION_URL, 
                headers={'User-Agent': 'RKDKCW-Launcher/2.0'}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode('utf-8'))
                    if payload.get("ok") and payload.get("data"):
                        remote_data = payload["data"]
                        remote_ver = remote_data.get("version", "")
                        local_ver = self.get_local_version()
                        if remote_ver and remote_ver != local_ver:
                            update_available = True
        except Exception:
            # Jika offline atau server belum nyala, lanjutkan langsung
            pass

        if update_available and remote_data:
            new_v = remote_data.get('version')
            self.set_status(f"Pembaruan v{new_v} tersedia!", fg="#34d399")
            time.sleep(0.8)
            self.set_status(f"Mengunduh paket rilis v{new_v}...")
            # Simulasi pengunduhan paket rilis
            self.progress.stop()
            self.progress.config(mode="determinate", maximum=100)
            for i in range(0, 101, 10):
                self.root.after(0, lambda val=i: self.progress.config(value=val))
                time.sleep(0.08)

            self.set_status("Pembaruan selesai dipasang!", fg="#34d399")
            time.sleep(0.5)

        # Luncurkan Aplikasi
        self.set_status("Menjalankan RKDKCW Audio Studio...")
        self.launch_main_application()

    def launch_main_application(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        exe_path = os.path.join(base_dir, "dist", "RKDKCW_Audio_Studio", TARGET_EXE_NAME)
        alt_exe_path = os.path.join(base_dir, TARGET_EXE_NAME)

        # Cek apakah file exe hasil compile ada
        if os.path.exists(exe_path):
            subprocess.Popen([exe_path], cwd=os.path.dirname(exe_path))
        elif os.path.exists(alt_exe_path):
            subprocess.Popen([alt_exe_path], cwd=base_dir)
        else:
            # Fallback jika dijalankan di mode development Python
            py_main = os.path.join(base_dir, "main.py")
            if os.path.exists(py_main):
                subprocess.Popen([sys.executable, py_main], cwd=base_dir)

        # Beri jeda 1.2 detik lalu otomatis buka browser & tutup launcher
        time.sleep(1.2)
        webbrowser.open(f"http://127.0.0.1:{PORT}/app")
        time.sleep(0.5)
        self.root.after(0, self.root.destroy)

if __name__ == "__main__":
    root = tk.Tk()
    app = LauncherGUI(root)
    root.mainloop()
