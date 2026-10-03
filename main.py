import sys
import webbrowser
import yt_dlp
from pydub import AudioSegment
import os
import json
from flask import Flask, render_template, jsonify, request, send_file, redirect, session, url_for, Response
import requests as _req
import urllib.parse
import datetime
import string
import random
import shutil
import zipfile
import uuid
import threading
import secrets
import hashlib
import base64
try:
    import psutil
except ImportError:
    psutil = None
import time
import functools
from werkzeug.security import generate_password_hash, check_password_hash
try:
    import audioop
except ImportError:
    try:
        import audioop_lts as audioop
    except ImportError:
        audioop = None

def get_random_string(length=8):
    letters = string.ascii_lowercase + string.digits
    return ''.join(random.choice(letters) for i in range(length))

os.makedirs("downloads", exist_ok=True)

# ─────────────────────────────────────────────
#  WEB SERVICE (Flask)
# ─────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    base_resource_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(base_resource_dir, 'templates')
    static_folder = os.path.join(base_resource_dir, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.environ.get("FLASK_SECRET", secrets.token_hex(24))
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

# ─────────────────────────────────────────────
#  ROBLOX OAUTH 2.0 CONFIG
# ─────────────────────────────────────────────
RBX_CLIENT_ID     = os.environ.get('RBX_CLIENT_ID', '5164106374181332901')
RBX_CLIENT_SECRET = os.environ.get('RBX_CLIENT_SECRET', 'RBX-N3mC8H7Q0Euo3XJvkiwK05nXmpgrT8_y18Zg-KqiBNgTeO1XFTVSxTCuwcg-m4We')
RBX_REDIRECT_URI  = os.environ.get('RBX_REDIRECT_URI', 'http://localhost:5000/oauth/callback')
RBX_AUTH_URL      = 'https://apis.roblox.com/oauth/v1/authorize'
RBX_TOKEN_URL     = 'https://apis.roblox.com/oauth/v1/token'
RBX_USERINFO_URL  = 'https://apis.roblox.com/oauth/v1/userinfo'
RBX_SCOPES        = 'openid profile asset:read asset:write'

def _generate_pkce():
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode('ascii')
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode('ascii')).digest()
    ).rstrip(b'=').decode('ascii')
    return code_verifier, code_challenge

def roblox_login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'rbx_user' not in session:
            return redirect(url_for('roblox_login_page'))
        return f(*args, **kwargs)
    return decorated_function

# Global error handler to give reason code
@app.errorhandler(500)
def handle_500(e):
    import traceback
    err = traceback.format_exc()
    return f"<h1>Internal Server Error (500)</h1><p>Reason Code: {str(e)}</p><pre>{err}</pre>", 500

# Data storage (JSON-based)
USERS_FILE  = 'users.json'
HISTORY_FILE = 'history.json'
ADMIN_CREDENTIALS = {
    "username": "rkdkcw",
    "password": generate_password_hash("admin@123")
}

# Helper to load/save JSON data
def load_json(path, default=None):
    if default is None: default = []
    if os.path.exists(path):
        try:
            with open(path, 'r') as f: return json.load(f)
        except: return default
    return default

def save_json(path, data):
    with open(path, 'w') as f: json.dump(data, f, indent=2)

print(f"--- [DEBUG] main.py loaded successfully ---")

# Helper to get user's bypass count for TODAY
def get_today_count(user_id):
    history = load_json(HISTORY_FILE, [])
    today_str = datetime.date.today().isoformat()
    count = 0
    for entry in history:
        if entry.get('user_id') == user_id:
            ts = entry.get('ts') or entry.get('timestamp')
            if ts and ts.startswith(today_str):
                count += 1
    return count

# Auth middleware
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Login system disabled - auto-assign Guest ID
        if 'user_id' not in session:
            session['user_id'] = f"Guest_{get_random_string(4)}"
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'is_admin' not in session:
            return redirect(url_for('admin_login_page'))
        return f(*args, **kwargs)
    return decorated_function

# Job storage: job_id -> {status, progress, step, files, error}
web_jobs = {}
# Token -> file path (for secure download)
download_tokens = {}
download_names  = {}
# Stream URL cache: url -> {stream_url, expires}
stream_url_cache = {}
# Online tracking
active_sessions = {} # session_id -> {ts, user}

def track_activity():
    if 'act_id' not in session: session['act_id'] = str(uuid.uuid4())
    user = session.get('user_id', f"Guest#{session['act_id'][-4:].upper()}")
    active_sessions[session['act_id']] = {'ts': time.time(), 'user': user}

@app.route('/api/online_count')
def api_online_count():
    now = time.time()
    # Prune sessions older than 5 mins
    to_del = [sid for sid, d in active_sessions.items() if now - d['ts'] > 300]
    for sid in to_del: active_sessions.pop(sid, None)
    
    # Get unique usernames, sorted by most recent
    sorted_sessions = sorted(active_sessions.values(), key=lambda x: x['ts'], reverse=True)
    unique_users = []
    seen = set()
    for s in sorted_sessions:
        if s['user'] not in seen:
            unique_users.append(s['user'])
            seen.add(s['user'])
        if len(unique_users) >= 50: break
        
    return jsonify({
        'count': len(active_sessions),
        'users': unique_users
    })

COOKIES_FILE = 'cookies.txt'

def cookies_active():
    active = os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 10
    if active:
        print(f"--- [DEBUG] Cookies active: {COOKIES_FILE} ({os.path.getsize(COOKIES_FILE)} bytes) ---")
    else:
        print(f"--- [DEBUG] Cookies NOT active or too small: {COOKIES_FILE} ---")
    return active

def _get_ffmpeg_location():
    try:
        base = os.path.dirname(os.path.abspath(__file__))
    except NameError:
        import sys
        base = os.path.dirname(os.path.abspath(sys.argv[0]))
    # 1. Cek folder ffmpeg/ di sebelah main.py langsung
    local_exe = os.path.join(base, 'ffmpeg', 'ffmpeg.exe')
    if os.path.isfile(local_exe):
        return os.path.join(base, 'ffmpeg')
    # 2. Baca dari ffmpeg_path.txt
    txt = os.path.join(base, 'ffmpeg_path.txt')
    if os.path.isfile(txt):
        with open(txt, 'r') as f:
            exe = f.read().strip()
        if exe and os.path.isfile(exe):
            return os.path.dirname(exe)
    # 3. Fallback dari env var
    exe = os.environ.get('FFMPEG_PATH_ENV', '').strip()
    if exe and os.path.isfile(exe):
        return os.path.dirname(exe)
    # 4. Cek ffmpeg dari system PATH
    which_ffmpeg = shutil.which('ffmpeg')
    if which_ffmpeg and os.path.isfile(which_ffmpeg):
        return os.path.dirname(which_ffmpeg)
    return None

def _apply_cookies(opts):
    if cookies_active():
        opts['cookiefile'] = COOKIES_FILE
        print(f"--- [DEBUG] Applied cookiefile to yt-dlp opts ---")
    loc = _get_ffmpeg_location()
    if loc:
        opts['ffmpeg_location'] = loc
    return opts

def get_ydl_opts(out_template):
    opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
        'outtmpl': out_template,
        'quiet': True,
        'nocheckcertificate': True,
        'no_warnings': True,
        'default_search': 'auto',
        'source_address': '0.0.0.0',
        'retries': 3,
        'fragment_retries': 3,
        'socket_timeout': 30,
        'no_color': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'extractor_args': {'youtube': {'player_client': ['web', 'android']}},
    }
    loc = _get_ffmpeg_location()
    if loc:
        opts['ffmpeg_location'] = loc
    return _apply_cookies(opts)

def _ts():
    return datetime.datetime.now().strftime('%H:%M:%S')

def process_web_job(job_id, user_id, source, mode, url_or_path, is_upload, speed=2.253, amplify=-2, reverb=False, hz=44100, out_format='ogg', naming_mode='clean', name_prefix='', name_suffix=''):
    job = web_jobs[job_id]

    def log(label, status='active', detail=''):
        job['logs'].append({'label': label, 'status': status, 'detail': detail, 'time': _ts()})

    def done_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'done'
            if detail: job['logs'][-1]['detail'] = detail

    def err_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'error'
            if detail: job['logs'][-1]['detail'] = detail

    try:
        job['status']   = 'processing'
        job['progress'] = 5
        job['logs']     = []

        mp3_file  = None
        tmp_files = []
        title     = ''
        duration  = 0

        if is_upload:
            title = os.path.splitext(os.path.basename(url_or_path))[0]
            log('File diterima dari upload', detail=os.path.basename(url_or_path))
            done_last()
            mp3_file = url_or_path
            job['progress'] = 30
        else:
            src_names = {'youtube': 'YouTube', 'soundcloud': 'SoundCloud', 'spotify': 'Spotify'}
            src_label = src_names.get(source, source)
            log(f'Menghubungi {src_label}...')
            job['progress'] = 10

            random_prefix = get_random_string()
            out_tpl  = f'downloads/web_{random_prefix}.%(ext)s'
            ydl_opts = get_ydl_opts(out_tpl)
            q = f'ytsearch1:{url_or_path}' if source == 'spotify' else url_or_path

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(q, download=True)
                if 'entries' in info:
                    info = info['entries'][0]
                mp3_file = ydl.prepare_filename(info).rsplit('.', 1)[0] + '.mp3'
                tmp_files.append(mp3_file)

            title    = info.get('title', 'unknown')
            duration = info.get('duration', 0)
            dur_str  = f"{int(duration//60)}:{int(duration%60):02d}" if duration else '?'
            done_last(detail=f'{title} — {dur_str}')
            job['progress'] = 30

            log('Konversi ke MP3...')
            job['progress'] = 38
            done_last(detail='192kbps')

        job['progress'] = 40

        # Auto-switch to mixtape if duration > 7 minutes (420s)
        if not duration and is_upload:
            temp_audio = AudioSegment.from_file(mp3_file)
            duration = len(temp_audio) / 1000
        
        if duration > 420 and mode != 'mixtape':
            log('Durasi > 7 menit, otomatis beralih ke Mode Mixtape...', detail='Auto-Mixtape Activated')
            mode = 'mixtape'

        if mode == 'normal':
            log('Menyiapkan file output...')
            token    = get_random_string(16)
            safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip() or "audio"
            clean_name = f"{safe_title[:45]}.mp3"
            out_name = f"{get_random_string()}_{clean_name}"
            out_path = f"downloads/{out_name}"
            shutil.copy(mp3_file, out_path)
            download_tokens[token] = out_path
            download_names[token]  = clean_name
            size = os.path.getsize(out_path)
            done_last(detail=f'{size/1024/1024:.2f} MB')
            job['files']    = [{'name': clean_name, 'size': size, 'token': token}]
            job['progress'] = 100

        elif mode == 'bypassed':
            log('Memuat audio ke memori...')
            job['progress'] = 45
            audio = AudioSegment.from_file(mp3_file)
            dur_s = len(audio) / 1000
            done_last(detail=f'{int(dur_s//60)}:{int(dur_s%60):02d} durasi asli')

            log(f'Speed up audio (x{speed})...')
            job['progress'] = 60
            audio = audio._spawn(audio.raw_data, overrides={
                'frame_rate': int(audio.frame_rate * speed)
            }).set_frame_rate(hz)
            new_dur = len(audio) / 1000
            done_last(detail=f'Durasi baru: {int(new_dur//60)}:{int(new_dur%60):02d}')

            log(f'Amplify volume ({amplify:+d} dB)...')
            job['progress'] = 72
            audio = audio + amplify
            done_last()

            log(f'Export ke {out_format.upper()}...')
            job['progress'] = 82
            token    = get_random_string(16)
            safe_title = "".join(c for c in title if c.isalnum() or c in " _-().,").strip() or "audio"
            if naming_mode == 'custom':
                pre = name_prefix if name_prefix else ""
                suf = name_suffix if name_suffix else ""
                clean_name = f"{pre}{safe_title}{suf}.{out_format}"
            else:
                clean_name = f"{safe_title}.{out_format}"
            out_name = f"{get_random_string()}_{clean_name}"
            out_path = f"downloads/{out_name}"
            
            export_params = []
            if reverb:
                # Natural reverb: aecho=in_gain:out_gain:delay:decay
                export_params.extend(['-af', 'aecho=0.8:0.88:60:0.4'])
            
            if out_format == 'ogg':
                export_params.extend(['-q:a', '10'])
            elif out_format == 'mp3':
                export_params.extend(['-b:a', '192k'])

            audio.export(out_path, format=out_format, parameters=export_params)
            size = os.path.getsize(out_path)
            
            # Roblox specific compression for OGG if it exceeds 8MB
            if out_format == 'ogg' and size > 8 * 1024 * 1024:
                log('File > 8MB, re-encode ke Q8...')
                audio.export(out_path, format='ogg', parameters=['-q:a', '8'] + (['-af', 'aecho=0.8:0.88:60:0.4'] if reverb else []))
                size = os.path.getsize(out_path)
                done_last(detail=f'{size/1024/1024:.2f} MB (dikompresi)')
            else:
                done_last(detail=f'{size/1024/1024:.2f} MB')
                
            download_tokens[token] = out_path
            download_names[token]  = clean_name
            job['files']    = [{'name': clean_name, 'size': size, 'token': token}]
            job['progress'] = 100

        elif mode == 'mixtape':
            log('Memuat audio ke memori...')
            job['progress'] = 42
            audio_original = AudioSegment.from_file(mp3_file)
            total_dur = len(audio_original) / 1000
            done_last(detail=f'Total: {int(total_dur//60)}:{int(total_dur%60):02d}')

            # --- Split logic: max 15:30 per segment ---
            SEG_MS      = 930_000  # 15 min 30 sec
            total_ms    = len(audio_original)
            n_full      = total_ms // SEG_MS
            remainder   = total_ms % SEG_MS
            raw_segments = [audio_original[i * SEG_MS:(i + 1) * SEG_MS] for i in range(n_full)]
            if remainder > 0:
                raw_segments.append(audio_original[n_full * SEG_MS:])
            total_segs  = len(raw_segments)

            # Determine base title
            if is_upload:
                base_title = os.path.basename(url_or_path).rsplit('.', 1)[0][:40]
            else:
                base_title = (title or 'MIXTAPE')[:40]
            safe_title = "".join(c for c in base_title if c.isalnum() or c in " _-").strip().replace(" ", "_") or "MIXTAPE"

            log(f'Membagi menjadi {total_segs} track (max 15:30/track)...')
            job['progress'] = 48
            done_last(detail=f'{total_segs} track terdeteksi')

            # Bypass each segment, collect temp ogg paths
            ogg_paths = []
            ogg_names = []
            for idx, segment in enumerate(raw_segments, 1):
                pct       = 48 + int((idx / total_segs) * 44)
                is_last   = (idx == total_segs)
                track_tag = f'_TRACK{idx}_END' if is_last else f'_TRACK{idx}'
                ogg_name  = f'{safe_title}{track_tag}.ogg'
                out_path  = f'downloads/{get_random_string()}_{ogg_name}'

                log(f'Bypass track {idx}/{total_segs}...')
                job['progress'] = pct

                processed = segment._spawn(segment.raw_data, overrides={
                    'frame_rate': int(segment.frame_rate * speed)
                }).set_frame_rate(hz)
                processed = processed + amplify

                # Apply reverb if enabled
                mix_params = ['-q:a', '10']
                if reverb:
                    mix_params.extend(['-af', 'aecho=0.8:0.88:60:0.4'])

                processed.export(out_path, format='ogg', parameters=mix_params)
                if os.path.getsize(out_path) > 8 * 1024 * 1024:
                    # Re-encode with lower quality if still too big
                    processed.export(out_path, format='ogg', parameters=['-q:a', '8'] + (['-af', 'aecho=0.8:0.88:60:0.4'] if reverb else []))

                seg_dur = len(processed) / 1000
                done_last(detail=f'{int(seg_dur//60)}:{int(seg_dur%60):02d} — {os.path.getsize(out_path)/1024/1024:.2f} MB')
                ogg_paths.append(out_path)
                ogg_names.append(ogg_name)

            # Pack all OGGs into one ZIP
            log('Membuat ZIP...')
            job['progress'] = 95
            zip_name = f'{safe_title}_MIXTAPE.zip'
            zip_path = f'downloads/{get_random_string()}_{zip_name}'
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for ogg_path, ogg_name in zip(ogg_paths, ogg_names):
                    zf.write(ogg_path, ogg_name)

            # Keep individual OGGs alive for Roblox per-part upload
            mixtape_parts = []
            for idx, (ogg_path, ogg_name) in enumerate(zip(ogg_paths, ogg_names), 1):
                is_last  = (idx == total_segs)
                part_tok = get_random_string(16)
                download_tokens[part_tok] = ogg_path
                download_names[part_tok]  = ogg_name
                mixtape_parts.append({
                    'token':   part_tok,
                    'name':    ogg_name,
                    'index':   idx,
                    'is_last': is_last,
                    'size':    os.path.getsize(ogg_path),
                })

            zip_size  = os.path.getsize(zip_path)
            token     = get_random_string(16)
            download_tokens[token] = zip_path
            download_names[token]  = zip_name
            done_last(detail=f'{total_segs} track — {zip_size/1024/1024:.2f} MB')
            job['files']         = [{'name': zip_name, 'size': zip_size, 'token': token}]
            job['mixtape_parts'] = mixtape_parts
            job['progress'] = 100

        # cleanup
        for f in tmp_files:
            if f and os.path.exists(f) and f != url_or_path:
                try: os.remove(f)
                except: pass
        if is_upload and mp3_file and os.path.exists(mp3_file):
            try:
                os.remove(mp3_file)
            except:
                pass

        log('Selesai — file siap diunduh', status='done')
        job['status'] = 'done'
        total_size = sum(f.get('size', 0) for f in job.get('files', []))
        save_history_entry({
            'user_id':  user_id,
            'title':    title or url_or_path,
            'source':   source,
            'mode':     mode,
            'speed':    speed,
            'amplify':  amplify,
            'url':      '' if is_upload else url_or_path,
            'duration': duration,
            'size':     total_size,
            'files':    len(job.get('files', [])),
            'ts':       datetime.datetime.now().isoformat(),
        })

    except Exception as e:
        err_last(detail=str(e))
        job['status'] = 'error'
        job['error']  = str(e)
        print(f'    [!] Web Job Error ({job_id}): {e}')


def get_video_ydl_opts(out_template, quality='1080'):
    quality_str = str(quality).lower().replace('p', '')
    if quality_str == '1080':
        fmt = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best'
    elif quality_str == '720':
        fmt = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/bestvideo[height<=720]+bestaudio/best'
    elif quality_str == '480':
        fmt = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/bestvideo[height<=480]+bestaudio/best'
    elif quality_str == '360':
        fmt = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/bestvideo[height<=360]+bestaudio/best'
    else:
        fmt = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'

    opts = {
        'format': fmt,
        'merge_output_format': 'mp4',
        'outtmpl': out_template,
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'retries': 3,
        'fragment_retries': 3,
        'socket_timeout': 30,
        'no_color': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'extractor_args': {'youtube': {'player_client': ['web', 'android']}},
    }
    loc = _get_ffmpeg_location()
    if loc:
        opts['ffmpeg_location'] = loc
    return _apply_cookies(opts)


def process_video_job(job_id, user_id, url, quality='1080'):
    job = web_jobs[job_id]

    def log(label, status='active', detail=''):
        job['logs'].append({'label': label, 'status': status, 'detail': detail, 'time': _ts()})

    def done_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'done'
            if detail: job['logs'][-1]['detail'] = detail

    def err_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'error'
            if detail: job['logs'][-1]['detail'] = detail

    try:
        job['status']   = 'processing'
        job['progress'] = 10
        job['logs']     = []

        log('Menghubungi YouTube...')
        out_prefix = get_random_string()
        out_tpl = f'downloads/vid_{out_prefix}.%(ext)s'
        ydl_opts = get_video_ydl_opts(out_tpl, quality)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if 'entries' in info:
                info = info['entries'][0]

        title    = info.get('title', 'Video')
        duration = info.get('duration', 0)
        dur_str  = f"{int(duration//60)}:{int(duration%60):02d}" if duration else '?'
        done_last(detail=f"{title} ({dur_str})")

        job['progress'] = 80
        log('Menyiapkan file video MP4...')

        final_file = None
        cand = f'downloads/vid_{out_prefix}.mp4'
        if os.path.exists(cand):
            final_file = cand
        else:
            for fn in os.listdir('downloads'):
                if fn.startswith(f'vid_{out_prefix}'):
                    final_file = os.path.join('downloads', fn)
                    break

        if not final_file or not os.path.exists(final_file):
            raise Exception("Gagal menghasilkan file video MP4.")

        size = os.path.getsize(final_file)
        done_last(detail=f"{size/1024/1024:.2f} MB")

        token = get_random_string(16)
        download_tokens[token] = final_file

        safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip() or "video"
        clean_name = f"{safe_title[:45]}.mp4"
        download_names[token] = clean_name

        job['files'] = [{
            'name': clean_name,
            'size': size,
            'token': token,
            'is_video': True
        }]
        job['progress'] = 100
        job['status'] = 'done'
        log('Selesai — video siap diunduh!', status='done')

        save_history_entry({
            'user_id':  user_id,
            'title':    title,
            'source':   'youtube',
            'mode':     f'video_{quality}',
            'duration': duration,
            'size':     size,
            'files':    1,
            'ts':       datetime.datetime.now().isoformat(),
        })

    except Exception as e:
        err_last(detail=str(e))
        job['status'] = 'error'
        job['error']  = str(e)
        print(f'    [!] Video Job Error ({job_id}): {e}')


def process_playlist_job(job_id, user_id, items, download_type='audio', quality='720', playlist_title='Playlist'):
    job = web_jobs[job_id]

    def log(label, status='active', detail=''):
        job['logs'].append({'label': label, 'status': status, 'detail': detail, 'time': _ts()})

    def done_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'done'
            if detail: job['logs'][-1]['detail'] = detail

    def err_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'error'
            if detail: job['logs'][-1]['detail'] = detail

    try:
        job['status']   = 'processing'
        job['progress'] = 5
        job['logs']     = []

        total = len(items)
        kind_str = 'Audio MP3' if download_type == 'audio' else f'Video MP4 ({quality}p)'
        log(f"Memulai unduhan {total} item playlist ({kind_str})...")
        done_last()

        downloaded_files = []

        for idx, item in enumerate(items, 1):
            v_title = item.get('title') or f"Video_{idx}"
            v_url = item.get('url') or (f"https://www.youtube.com/watch?v={item.get('id')}" if item.get('id') else None)
            if not v_url:
                continue

            pct = 5 + int(((idx - 1) / total) * 80)
            job['progress'] = pct

            log(f"[{idx}/{total}] Mengunduh: {v_title[:45]}...")

            prefix = get_random_string()
            if download_type == 'audio':
                out_tpl = f'downloads/pl_{prefix}.%(ext)s'
                ydl_opts = get_ydl_opts(out_tpl)
            else:
                out_tpl = f'downloads/pl_{prefix}.%(ext)s'
                ydl_opts = get_video_ydl_opts(out_tpl, quality)

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.extract_info(v_url, download=True)

                ext = 'mp3' if download_type == 'audio' else 'mp4'
                cand = f'downloads/pl_{prefix}.{ext}'
                final_f = None
                if os.path.exists(cand):
                    final_f = cand
                else:
                    for fn in os.listdir('downloads'):
                        if fn.startswith(f'pl_{prefix}.'):
                            final_f = os.path.join('downloads', fn)
                            break

                if final_f and os.path.exists(final_f):
                    sz = os.path.getsize(final_f)
                    clean_title = "".join(c for c in v_title if c.isalnum() or c in " _-").strip() or f"Track_{idx}"
                    disp_name = f"{idx:02d}_{clean_title[:40]}.{ext}"
                    downloaded_files.append((final_f, disp_name, sz))
                    done_last(detail=f"{sz/1024/1024:.2f} MB")
                else:
                    done_last(detail="Gagal memproses file")
            except Exception as e_itm:
                done_last(detail=f"Error: {str(e_itm)[:45]}")

        if not downloaded_files:
            raise Exception("Tidak ada file yang berhasil diunduh dari item terpilih.")

        job['progress'] = 88
        log("Mengemas ke dalam file ZIP...")

        safe_pl = "".join(c for c in playlist_title if c.isalnum() or c in " _-").strip() or "Playlist"
        zip_name = f"{safe_pl[:35]}_{download_type.upper()}.zip"
        zip_path = f"downloads/{get_random_string()}_{zip_name}"

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fpath, fname, _ in downloaded_files:
                zf.write(fpath, fname)

        zip_size = os.path.getsize(zip_path)
        zip_token = get_random_string(16)
        download_tokens[zip_token] = zip_path
        download_names[zip_token]  = zip_name
        done_last(detail=f"{len(downloaded_files)} file ({zip_size/1024/1024:.2f} MB)")

        files_list = [{
            'name': zip_name,
            'size': zip_size,
            'token': zip_token,
            'is_zip': True
        }]
        for fpath, fname, sz in downloaded_files:
            tok = get_random_string(16)
            download_tokens[tok] = fpath
            download_names[tok]  = fname
            files_list.append({
                'name': fname,
                'size': sz,
                'token': tok,
                'is_zip': False
            })

        job['files'] = files_list
        job['progress'] = 100
        job['status'] = 'done'
        log(f"Selesai! {len(downloaded_files)} file siap diunduh.", status='done')

        save_history_entry({
            'user_id':  user_id,
            'title':    f"Playlist: {playlist_title} ({len(downloaded_files)}/{total})",
            'source':   'youtube',
            'mode':     f'playlist_{download_type}',
            'duration': 0,
            'size':     zip_size,
            'files':    len(downloaded_files),
            'ts':       datetime.datetime.now().isoformat(),
        })

    except Exception as e:
        err_last(detail=str(e))
        job['status'] = 'error'
        job['error']  = str(e)
        print(f'    [!] Playlist Job Error ({job_id}): {e}')


def process_queue_job(job_id, user_id, items, mode='bypassed', speed=2.253, amplify=-2, reverb=False, hz=44100, out_format='ogg', naming_mode='clean', name_prefix='', name_suffix=''):
    job = web_jobs[job_id]

    def log(label, status='active', detail=''):
        job['logs'].append({'label': label, 'status': status, 'detail': detail, 'time': _ts()})

    def done_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'done'
            if detail: job['logs'][-1]['detail'] = detail

    def err_last(detail=''):
        if job['logs']:
            job['logs'][-1]['status'] = 'error'
            if detail: job['logs'][-1]['detail'] = detail

    try:
        job['status']   = 'processing'
        job['progress'] = 5
        job['logs']     = []

        total = len(items)
        log(f"Memulai proses antrian ({total} lagu, mode: {mode})...")
        done_last()

        downloaded_files = []
        tmp_files = []

        for idx, item in enumerate(items, 1):
            v_title = item.get('title') or f"Lagu_{idx}"
            v_url = item.get('url') or ''
            v_source = item.get('source') or 'youtube'

            if not v_url:
                continue

            job['current_index'] = idx
            if 'items_status' in job and idx - 1 < len(job['items_status']):
                job['items_status'][idx - 1]['status'] = 'processing'

            pct = 5 + int(((idx - 1) / total) * 80)
            job['progress'] = pct

            safe_title = "".join(c for c in v_title if c.isalnum() or c in " _-").strip() or f"Track_{idx}"
            log(f"[{idx}/{total}] Mengunduh: {safe_title[:35]}...")

            prefix = get_random_string()
            out_tpl = f'downloads/q_{prefix}.%(ext)s'
            ydl_opts = get_ydl_opts(out_tpl)

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.extract_info(v_url, download=True)

                cand = f'downloads/q_{prefix}.mp3'
                mp3_file = None
                if os.path.exists(cand):
                    mp3_file = cand
                else:
                    for fn in os.listdir('downloads'):
                        if fn.startswith(f'q_{prefix}.'):
                            mp3_file = os.path.join('downloads', fn)
                            break

                if not mp3_file or not os.path.exists(mp3_file):
                    raise Exception("Gagal mengunduh audio.")

                tmp_files.append(mp3_file)
                done_last(detail="Berhasil diunduh")

                # Bypass audio processing
                log(f"[{idx}/{total}] Memproses bypass audio...")
                audio = AudioSegment.from_file(mp3_file)

                if mode == 'bypassed':
                    audio = audio._spawn(audio.raw_data, overrides={
                        'frame_rate': int(audio.frame_rate * speed)
                    }).set_frame_rate(hz)
                    audio = audio + amplify

                if naming_mode == 'clean':
                    # Pakai nama asli saja tanpa _bypassed
                    clean_name = f"{safe_title}.{out_format}"
                elif naming_mode == 'numbered':
                    # Nomor urut + original
                    clean_name = f"{idx:02d}_{safe_title}.{out_format}"
                elif naming_mode == 'custom':
                    pre = name_prefix if name_prefix else ""
                    suf = name_suffix if name_suffix else ""
                    clean_name = f"{pre}{safe_title}{suf}.{out_format}"
                else:
                    clean_name = f"{safe_title}.{out_format}"

                final_out_path = f"downloads/{get_random_string()}_{clean_name}"

                export_params = []
                if reverb:
                    export_params.extend(['-af', 'aecho=0.8:0.88:60:0.4'])

                if out_format == 'ogg':
                    export_params.extend(['-q:a', '10'])
                elif out_format == 'mp3':
                    export_params.extend(['-b:a', '192k'])

                audio.export(final_out_path, format=out_format, parameters=export_params)
                sz = os.path.getsize(final_out_path)

                if out_format == 'ogg' and sz > 8 * 1024 * 1024:
                    audio.export(final_out_path, format='ogg', parameters=['-q:a', '8'] + (['-af', 'aecho=0.8:0.88:60:0.4'] if reverb else []))
                    sz = os.path.getsize(final_out_path)

                done_last(detail=f"{sz/1024/1024:.2f} MB")
                downloaded_files.append((final_out_path, clean_name, sz))

                if 'items_status' in job and idx - 1 < len(job['items_status']):
                    job['items_status'][idx - 1]['status'] = 'done'

            except Exception as e_itm:
                err_last(detail=f"Error: {str(e_itm)[:45]}")
                if 'items_status' in job and idx - 1 < len(job['items_status']):
                    job['items_status'][idx - 1]['status'] = 'error'

        # cleanup tmp files
        for f in tmp_files:
            if f and os.path.exists(f):
                try: os.remove(f)
                except: pass

        if not downloaded_files:
            raise Exception("Tidak ada lagu yang berhasil diproses dari antrian.")

        job['progress'] = 88
        log("Mengemas ke dalam file ZIP...")

        zip_name = f"Bypass_Queue_{datetime.date.today().strftime('%Y%m%d')}_{get_random_string(4)}.zip"
        zip_path = f"downloads/{get_random_string()}_{zip_name}"

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fpath, fname, _ in downloaded_files:
                zf.write(fpath, fname)

        zip_size = os.path.getsize(zip_path)
        zip_token = get_random_string(16)
        download_tokens[zip_token] = zip_path
        download_names[zip_token]  = zip_name
        done_last(detail=f"{len(downloaded_files)} file ({zip_size/1024/1024:.2f} MB)")

        files_list = [{
            'name': zip_name,
            'size': zip_size,
            'token': zip_token,
            'is_zip': True
        }]
        for fpath, fname, sz in downloaded_files:
            tok = get_random_string(16)
            download_tokens[tok] = fpath
            download_names[tok]  = fname
            files_list.append({
                'name': fname,
                'size': sz,
                'token': tok,
                'is_zip': False
            })

        job['files'] = files_list
        job['progress'] = 100
        job['status'] = 'done'
        log(f"Selesai! {len(downloaded_files)} file antrian siap diunduh.", status='done')

        save_history_entry({
            'user_id':  user_id,
            'title':    f"Queue: {len(downloaded_files)} lagu ({mode})",
            'source':   'queue',
            'mode':     mode,
            'duration': 0,
            'size':     zip_size,
            'files':    len(downloaded_files),
            'ts':       datetime.datetime.now().isoformat(),
        })

    except Exception as e:
        err_last(detail=str(e))
        job['status'] = 'error'
        job['error']  = str(e)
        print(f'    [!] Queue Job Error ({job_id}): {e}')


# ─────────────────────────────────────────────
#  ROBLOX OAUTH 2.0 ROUTES
# ─────────────────────────────────────────────
@app.route('/oauth/login')
def roblox_login_page():
    return render_template('roblox_login.html')

@app.route('/oauth/start')
def roblox_oauth_start():
    code_verifier, code_challenge = _generate_pkce()
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_verifier'] = code_verifier
    params = urllib.parse.urlencode({
        'client_id': RBX_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': RBX_REDIRECT_URI,
        'scope': RBX_SCOPES,
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
    })
    return redirect(f'{RBX_AUTH_URL}?{params}')

@app.route('/oauth/callback')
def roblox_oauth_callback():
    error = request.args.get('error')
    if error:
        return render_template('roblox_login.html', error=f'Roblox menolak akses: {error}')
    code = request.args.get('code')
    state = request.args.get('state')
    if not code:
        return render_template('roblox_login.html', error='Kode otorisasi tidak ditemukan.')
    if state != session.get('oauth_state'):
        return render_template('roblox_login.html', error='State mismatch. Coba login ulang.')
    code_verifier = session.pop('oauth_verifier', '')
    session.pop('oauth_state', None)
    try:
        token_resp = _req.post(RBX_TOKEN_URL, data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': RBX_REDIRECT_URI,
            'client_id': RBX_CLIENT_ID,
            'client_secret': RBX_CLIENT_SECRET,
            'code_verifier': code_verifier,
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)
        if token_resp.status_code != 200:
            print(f'[OAUTH] Token error {token_resp.status_code}: {token_resp.text}')
            return render_template('roblox_login.html', error=f'Gagal mendapatkan token: {token_resp.text[:200]}')
        tokens = token_resp.json()
        access_token = tokens.get('access_token')
        if not access_token:
            return render_template('roblox_login.html', error='Access token tidak ditemukan di response.')
        session['rbx_access_token'] = access_token
        session['rbx_refresh_token'] = tokens.get('refresh_token', '')
        user_resp = _req.get(RBX_USERINFO_URL, headers={
            'Authorization': f'Bearer {access_token}'
        }, timeout=10)
        if user_resp.status_code == 200:
            user_info = user_resp.json()
            session['rbx_user'] = {
                'sub': user_info.get('sub', ''),
                'name': user_info.get('preferred_username') or user_info.get('name', 'RobloxUser'),
                'picture': user_info.get('picture', ''),
                'nickname': user_info.get('nickname', ''),
            }
            session['user_id'] = user_info.get('preferred_username') or user_info.get('name', 'RobloxUser')
            print(f"[OAUTH] Login OK: {session['rbx_user']['name']} (sub={session['rbx_user']['sub']})")
        else:
            print(f'[OAUTH] Userinfo error {user_resp.status_code}: {user_resp.text}')
            session['rbx_user'] = {'sub': 'unknown', 'name': 'RobloxUser', 'picture': '', 'nickname': ''}
            session['user_id'] = 'RobloxUser'
        return redirect(url_for('app_dashboard'))
    except Exception as e:
        print(f'[OAUTH] Exception: {e}')
        import traceback
        traceback.print_exc()
        return render_template('roblox_login.html', error=f'Error saat OAuth: {str(e)[:200]}')

@app.route('/oauth/logout')
def roblox_logout():
    session.clear()
    return redirect(url_for('roblox_login_page'))

# ─────────────────────────────────────────────
#  CORE ROUTES (Landing & Auth)
# ─────────────────────────────────────────────
@app.route('/')
def landing_page():
    track_activity()
    rbx_user = session.get('rbx_user')
    user_id = rbx_user.get('name') if rbx_user else session.get('user_id', 'Guest')
    is_logged_in = bool(rbx_user or session.get('user_id'))
    return render_template('landing.html',
                           is_logged_in=is_logged_in,
                           rbx_user=rbx_user,
                           user=user_id)

@app.route('/login')
def login_page():
    return redirect(url_for('roblox_login_page'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('landing_page'))

@app.route('/app')
@login_required
def app_dashboard():
    track_activity()
    rbx_user = session.get('rbx_user', {})
    user_id = rbx_user.get('name') if (rbx_user and isinstance(rbx_user, dict)) else session.get('user_id', 'Guest')
    session['user_id'] = user_id
    is_premium = True
    usage_today = get_today_count(user_id)
    is_logged_in = bool(rbx_user)
    return render_template('index.html', 
                           user=user_id, 
                           is_premium=is_premium,
                           usage_today=usage_today,
                           max_free=999,
                           is_logged_in=is_logged_in,
                           rbx_user=rbx_user)

@app.route('/launcher')
def launcher_page():
    frontend_dir = os.path.join(os.path.dirname(__file__), 'dist_frontend')
    if os.path.isdir(frontend_dir):
        return send_from_directory(frontend_dir, 'index.html')
    return "Launcher frontend directory not found", 404

@app.route('/launcher_bg.jpg')
def launcher_bg_route():
    frontend_dir = os.path.join(os.path.dirname(__file__), 'dist_frontend')
    return send_from_directory(frontend_dir, 'launcher_bg.jpg')

# ─────────────────────────────────────────────
#  ADMIN PANEL
# ─────────────────────────────────────────────
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login_page():
    if request.method == 'POST':
        user = request.form.get('username', '').strip()
        pw   = request.form.get('password', '').strip()
        if user == ADMIN_CREDENTIALS['username'] and check_password_hash(ADMIN_CREDENTIALS['password'], pw):
            session['is_admin'] = True
            return redirect(url_for('admin_dashboard'))
        return render_template('auth.html', error="Invalid Admin Credentials", mode='admin')
    return render_template('auth.html', mode='admin')

@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    track_activity()
    return render_template('admin.html')

@app.route('/api/admin/stats')
@admin_required
def api_admin_stats():
    users   = load_json(USERS_FILE, {})
    history = load_json(HISTORY_FILE, [])
    # System Stats
    mem_stats = {'total': 'N/A', 'used': 'N/A', 'percent': 'N/A'}
    if psutil:
        mem = psutil.virtual_memory()
        mem_stats = {
            'total': mem.total,
            'used': mem.used,
            'percent': mem.percent
        }
    
    def check_status(url):
        try: return 200 <= _req.head(url, timeout=3).status_code < 400
        except: return False
    
    return jsonify({
        'total_users': len(users),
        'premium_users': sum(1 for u in users.values() if u.get('is_premium')),
        'total_tasks': len(history),
        'memory': mem_stats,
        'apis': {
            'youtube': check_status('https://www.youtube.com'),
            'spotify': check_status('https://www.spotify.com'),
            'roblox':  check_status('https://apis.roblox.com/assets/v1/assets'),
        }
    })

@app.route('/api/admin/users')
@admin_required
def api_admin_users():
    return jsonify(load_json(USERS_FILE, {}))

@app.route('/api/admin/toggle_premium', methods=['POST'])
@admin_required
def api_admin_toggle_premium():
    target = request.json.get('username')
    users  = load_json(USERS_FILE, {})
    if target in users:
        users[target]['is_premium'] = not users[target].get('is_premium', False)
        save_json(USERS_FILE, users)
        return jsonify({'ok': True, 'new_status': users[target]['is_premium']})
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/admin/analytics')
@admin_required
def api_admin_analytics():
    history = load_json(HISTORY_FILE, [])
    
    stats = {} # (speed, amplify) -> {accepted: 0, total: 0}
    for entry in history:
        s = entry.get('speed', 2.253)
        a = entry.get('amplify', -2)
        key = f"{s}|{a}"
        if key not in stats: stats[key] = {'accepted': 0, 'total': 0}
        stats[key]['total'] += 1
        # Mark as accepted if it has 'done' status or an asset_id
        if entry.get('roblox_status') == 'accepted' or entry.get('asset_id'):
            stats[key]['accepted'] += 1
    
    # Find best setting
    best_key = None
    best_rate = -1
    for key, val in stats.items():
        rate = val['accepted'] / val['total'] if val['total'] > 0 else 0
        if rate > best_rate:
            best_rate = rate
            best_key = key
    
    # Default if no history
    recommendation = {"speed": 2.253, "amplify": -2, "confidence": 0}
    if best_key:
        try:
            s_str, a_str = best_key.split('|')
            recommendation = {
                "speed": float(s_str),
                "amplify": float(a_str),
                "confidence": int(best_rate * 100)
            }
        except: pass
    return jsonify({
        'recommendation': recommendation,
        'total_history': len(history),
        'success_trend': stats
    })

# ─────────────────────────────────────────────
#  COOKIES API
# ─────────────────────────────────────────────
@app.route('/api/cookies', methods=['GET', 'POST', 'DELETE'])
@login_required
def api_cookies():
    if request.method == 'GET':
        active = cookies_active()
        entries = 0
        if active:
            with open(COOKIES_FILE, 'r') as f: entries = sum(1 for line in f if line.strip() and not line.startswith('#'))
        return jsonify({'active': active, 'entries': entries})
    
    if request.method == 'POST':
        c_text = request.json.get('cookies', '').strip()
        if not c_text: return jsonify({'error': 'Empty content'}), 400
        dir_name = os.path.dirname(COOKIES_FILE)
        if dir_name: os.makedirs(dir_name, exist_ok=True)
        with open(COOKIES_FILE, 'w') as f: f.write(c_text)
        entries = sum(1 for line in c_text.splitlines() if line.strip() and not line.startswith('#'))
        print(f"--- [DEBUG] Saved {entries} cookie entries to {COOKIES_FILE} ---")
        if c_text:
            print(f"--- [DEBUG] Cookie file starts with: {c_text[:50]}... ---")
        return jsonify({'ok': True, 'entries': entries})
    
    if request.method == 'DELETE':
        if os.path.exists(COOKIES_FILE): os.remove(COOKIES_FILE)
        return jsonify({'ok': True})

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/api/process', methods=['POST'])
@login_required
def api_process():
    # Usage Check Disabled (Free to Use)
    user_id = session.get('user_id', 'Guest')

    source = request.form.get('source', 'youtube')
    mode   = request.form.get('mode', 'bypassed')
    url    = request.form.get('url', '').strip()
    f      = request.files.get('file')

    is_upload = False
    path_or_url = url

    if source == 'upload':
        if not f:
            return jsonify({'error': 'Tidak ada file yang diupload.'}), 400
        ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else 'mp3'
        if ext not in ['mp3', 'wav', 'ogg', 'm4a', 'flac']:
            return jsonify({'error': 'Format file tidak didukung.'}), 400
        tmp_name   = f"downloads/web_upload_{get_random_string()}.{ext}"
        os.makedirs('downloads', exist_ok=True)
        f.save(tmp_name)
        path_or_url = tmp_name
        is_upload   = True
    else:
        if not url:
            return jsonify({'error': 'URL tidak boleh kosong.'}), 400
        # Auto-strip playlist URLs
        if source == 'youtube':
            from urllib.parse import urlparse, parse_qs, urlunparse, urlencode
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            if 'v' in qs:
                # Keep only video ID 'v', strip 'list', 'start_radio', etc.
                video_id = qs['v'][0]
                new_qs = urlencode({'v': video_id})
                path_or_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_qs, parsed.fragment))
    job_id = str(uuid.uuid4())
    web_jobs[job_id] = {'status': 'processing', 'progress': 5, 'step': 'Antri...', 'files': [], 'error': None, 'logs': []}

    try:
        speed_val = float(request.form.get('speed', 2.253))
    except:
        speed_val = 2.253

    try:
        amplify_val = int(request.form.get('amplify', -2))
    except:
        amplify_val = -2

    reverb_val = request.form.get('reverb') == 'true'
    try:
        hz_val = int(request.form.get('hz', 44100))
    except:
        hz_val = 44100
    out_format = request.form.get('format', 'ogg').lower()
    if out_format not in ['ogg', 'mp3', 'wav']:
        out_format = 'ogg'

    naming_mode = request.form.get('naming_mode', 'clean')
    name_prefix = request.form.get('name_prefix', '').strip()
    name_suffix = request.form.get('name_suffix', '').strip()

    # Spawn job
    threading.Thread(target=process_web_job, args=(
        job_id, session['user_id'], source, mode, path_or_url, is_upload,
        speed_val,
        amplify_val,
        reverb_val,
        hz_val,
        out_format,
        naming_mode,
        name_prefix,
        name_suffix
    )).start()
    return jsonify({'ok': True, 'job_id': job_id})

@app.route('/api/process_video', methods=['POST'])
@login_required
def api_process_video():
    url = request.form.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL video tidak boleh kosong.'}), 400

    from urllib.parse import urlparse, parse_qs, urlunparse, urlencode
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if 'v' in qs:
        video_id = qs['v'][0]
        new_qs = urlencode({'v': video_id})
        url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_qs, parsed.fragment))

    quality = request.form.get('quality', '1080')
    job_id = str(uuid.uuid4())
    web_jobs[job_id] = {'status': 'processing', 'progress': 5, 'step': 'Antri...', 'files': [], 'error': None, 'logs': []}

    threading.Thread(target=process_video_job, args=(
        job_id, session['user_id'], url, quality
    )).start()

    return jsonify({'ok': True, 'job_id': job_id})

@app.route('/api/playlist/info')
@login_required
def api_playlist_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL playlist tidak boleh kosong.'}), 400

    ydl_opts = {
        'extract_flat': 'in_playlist',
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'playlistend': 100,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'extractor_args': {'youtube': {'player_client': ['web', 'android']}},
    }
    _apply_cookies(ydl_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return jsonify({'error': 'Playlist tidak ditemukan atau bersifat pribadi.'}), 404

            entries = info.get('entries', [])
            if not entries and info.get('_type') != 'playlist':
                entries = [info]

            items = []
            for idx, e in enumerate(entries, 1):
                if not e: continue
                vid_id = e.get('id')
                v_title = e.get('title') or f"Video #{idx}"
                dur = e.get('duration') or 0
                dur_str = f"{int(dur//60)}:{int(dur%60):02d}" if dur else "?"
                thumb = e.get('thumbnail') or (f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg" if vid_id else "")
                v_url = e.get('url') or (f"https://www.youtube.com/watch?v={vid_id}" if vid_id else "")
                if v_url and not v_url.startswith('http'):
                    v_url = f"https://www.youtube.com/watch?v={v_url}"

                items.append({
                    'id': vid_id or f"item_{idx}",
                    'index': idx,
                    'title': v_title,
                    'duration': dur,
                    'duration_str': dur_str,
                    'thumbnail': thumb,
                    'uploader': e.get('uploader') or e.get('channel') or info.get('uploader') or '',
                    'url': v_url
                })

            playlist_title = info.get('title') or 'YouTube Playlist'
            uploader = info.get('uploader') or info.get('channel') or ''

            return jsonify({
                'ok': True,
                'title': playlist_title,
                'uploader': uploader,
                'total': len(items),
                'playlist_count': info.get('playlist_count') or len(items),
                'items': items
            })
    except Exception as e:
        return jsonify({'error': f'Gagal membaca playlist: {str(e)}'}), 400

@app.route('/api/playlist/download', methods=['POST'])
@login_required
def api_playlist_download():
    data = request.json or {}
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Tidak ada video yang dipilih untuk diunduh.'}), 400

    download_type  = data.get('download_type', 'audio')
    quality        = data.get('quality', '720')
    playlist_title = data.get('title', 'Playlist')

    job_id = str(uuid.uuid4())
    web_jobs[job_id] = {'status': 'processing', 'progress': 5, 'step': 'Antri...', 'files': [], 'error': None, 'logs': []}

    threading.Thread(target=process_playlist_job, args=(
        job_id, session['user_id'], items, download_type, quality, playlist_title
    )).start()

    return jsonify({'ok': True, 'job_id': job_id})

@app.route('/api/queue/process', methods=['POST'])
@login_required
def api_queue_process():
    data = request.json or {}
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Daftar antrian kosong. Silakan tambahkan lagu ke antrian.'}), 400

    if len(items) > 50:
        return jsonify({'error': 'Maksimal 50 lagu per antrian bypass.'}), 400

    try:
        speed_val = float(data.get('speed', 2.253))
    except Exception:
        speed_val = 2.253

    try:
        amplify_val = int(data.get('amplify', -2))
    except Exception:
        amplify_val = -2

    reverb_val = bool(data.get('reverb', False))
    try:
        hz_val = int(data.get('hz', 44100))
    except Exception:
        hz_val = 44100

    out_format = str(data.get('format', 'ogg')).lower()
    if out_format not in ['ogg', 'mp3', 'wav']:
        out_format = 'ogg'

    mode = str(data.get('mode', 'bypassed')).lower()
    if mode not in ['bypassed', 'normal']:
        mode = 'bypassed'

    naming_mode = str(data.get('naming_mode', 'clean')).lower()
    name_prefix = str(data.get('name_prefix', '')).strip()
    name_suffix = str(data.get('name_suffix', '')).strip()

    job_id = str(uuid.uuid4())
    web_jobs[job_id] = {
        'status': 'processing',
        'progress': 5,
        'step': 'Antri...',
        'files': [],
        'error': None,
        'logs': [],
        'is_queue': True,
        'total_items': len(items),
        'completed_items': 0,
        'current_index': 0,
        'items_status': [
            {
                'id': it.get('id') or str(i),
                'title': it.get('title', f'Track {i+1}'),
                'uploader': it.get('uploader', ''),
                'thumbnail': it.get('thumbnail', ''),
                'source': it.get('source', 'youtube'),
                'duration_str': it.get('duration_str', ''),
                'status': 'waiting'
            }
            for i, it in enumerate(items)
        ]
    }

    threading.Thread(target=process_queue_job, args=(
        job_id, session['user_id'], items, mode, speed_val, amplify_val, reverb_val, hz_val, out_format,
        naming_mode, name_prefix, name_suffix
    )).start()

    return jsonify({'ok': True, 'job_id': job_id})


@app.route('/api/status/<job_id>')
@login_required
def api_status(job_id):
    job = web_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job tidak ditemukan.'}), 404
    return jsonify(job)

@app.route('/api/download/<token>')
@login_required
def api_download(token):
    path = download_tokens.get(token)
    if not path or not os.path.exists(path):
        return jsonify({'error': 'File tidak ditemukan atau sudah kedaluwarsa.'}), 404
    
    # Preferred name from query param, then download_names dict, then basename of path
    req_name = request.args.get('name')
    name = req_name or download_names.get(token) or os.path.basename(path)
    
    # Clean filename: remove illegal Windows characters and unicode emojis
    name = "".join(c for c in name if c.isalnum() or c in " ._-").strip()
    if not name:
        name = os.path.basename(path)
        
    _, ext = os.path.splitext(path)
    if ext and not name.lower().endswith(ext.lower()):
        name = f"{name}{ext}"

    response = send_file(path, as_attachment=True, download_name=name)
    response.headers["Content-Disposition"] = f'attachment; filename="{name}"'
    return response

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'bot': 'running'})

# ─────────────────────────────────────────────
#  ROBLOX INTEGRATION
# ─────────────────────────────────────────────
ROBLOX_CONFIG_FILE  = 'roblox_config.json'
ROBLOX_ASSET_URL    = 'https://apis.roblox.com/assets/v1/assets'
ROBLOX_OP_URL       = 'https://apis.roblox.com/assets/v1/operations'
ROBLOX_AUTH_URL     = 'https://apis.roblox.com/oauth/v1/authorize'
ROBLOX_TOKEN_URL    = 'https://apis.roblox.com/oauth/v1/token'
ROBLOX_USERINFO_URL = 'https://apis.roblox.com/oauth/v1/userinfo'

def save_history_entry(entry):
    history = load_json(HISTORY_FILE, [])
    history.insert(0, entry)
    history = history[:100] # keep last 100
    save_json(HISTORY_FILE, history)

@app.route('/api/preview')
@login_required
def api_preview():
    url = request.args.get('url', '').strip()
    if not url: return jsonify({'error': 'URL kosong'}), 400
    
    print(f"--- [DEBUG] Preview request for: {url} ---")
    
    is_pure_playlist = ('/playlist' in url or ('list=' in url and 'v=' not in url))
    if is_pure_playlist:
        return jsonify({
            'is_playlist': True,
            'message': 'Link playlist terdeteksi.'
        })

    ydl_opts = {
        'quiet': True, 'no_warnings': True, 'skip_download': True,
        'nocheckcertificate': True, 'noplaylist': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'extractor_args': {'youtube': {'player_client': ['web', 'android']}},
    }
    _apply_cookies(ydl_opts)
    
    try:
        print(f"--- [DEBUG] Extracting metadata... (Cookies: {cookies_active()}) ---")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info and 'entries' in info:
                info = info['entries'][0]
        return jsonify({
            'title':        info.get('title', ''),
            'uploader':     info.get('uploader') or info.get('channel') or info.get('artist') or '',
            'duration':     info.get('duration', 0),
            'thumbnail':    info.get('thumbnail', ''),
            'has_playlist': ('list=' in url),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/search')
@login_required
def api_search():
    q = request.args.get('q', '').strip()
    source = request.args.get('source', 'youtube').lower().strip()
    try:
        limit = min(max(int(request.args.get('limit', 30)), 1), 80)
    except Exception:
        limit = 30

    if not q:
        return jsonify({'error': 'Kata kunci pencarian tidak boleh kosong.'}), 400

    if source not in ('youtube', 'soundcloud'):
        source = 'youtube'

    prefix = f"ytsearch{limit}:" if source == 'youtube' else f"scsearch{limit}:"
    search_query = f"{prefix}{q}"

    ydl_opts = {
        'extract_flat': True,
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    }
    if source == 'youtube':
        ydl_opts['extractor_args'] = {'youtube': {'player_client': ['web', 'android']}}
    _apply_cookies(ydl_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            entries = info.get('entries', []) if info else []

            results = []
            for e in entries:
                if not e:
                    continue
                v_id = e.get('id') or ''
                v_title = e.get('title') or 'Unknown Title'
                e_type = e.get('_type', '')
                raw_url = e.get('url') or e.get('webpage_url') or ''
                ie_key = e.get('ie_key', '')

                # Skip channels, playlists, or tab objects from song search
                if e_type in ('channel', 'playlist') or ie_key in ('YoutubeTab', 'YoutubePlaylist'):
                    continue
                if '/channel/' in raw_url or '/user/' in raw_url or '/@' in raw_url or '/playlist' in raw_url:
                    continue
                if source == 'youtube' and v_id.startswith('UC') and len(v_id) == 24:
                    continue

                dur = e.get('duration') or 0
                dur_str = f"{int(dur // 60)}:{int(dur % 60):02d}" if dur else "?"

                if source == 'youtube':
                    thumb = e.get('thumbnail') or (f"https://i.ytimg.com/vi/{v_id}/mqdefault.jpg" if v_id else "")
                    url = e.get('url') or (f"https://www.youtube.com/watch?v={v_id}" if v_id else "")
                    if url and not url.startswith('http'):
                        url = f"https://www.youtube.com/watch?v={url}"
                    uploader = e.get('uploader') or e.get('channel') or ''
                else:
                    thumb = e.get('thumbnail') or ""
                    url = e.get('webpage_url') or e.get('url') or ""
                    uploader = e.get('uploader') or ""

                results.append({
                    'id': v_id,
                    'title': v_title,
                    'duration': dur,
                    'duration_str': dur_str,
                    'thumbnail': thumb,
                    'uploader': uploader,
                    'url': url,
                    'source': source
                })

            return jsonify({
                'ok': True,
                'query': q,
                'source': source,
                'total': len(results),
                'results': results
            })
    except Exception as e:
        return jsonify({'error': f'Pencarian gagal: {str(e)}'}), 500

@app.route('/api/stream')
@login_required
def api_stream():
    target_url = request.args.get('url', '').strip()
    if not target_url:
        return jsonify({'error': 'URL tidak boleh kosong.'}), 400

    now = time.time()
    stream_url = None
    stream_headers = {}
    cached = stream_url_cache.get(target_url)
    if cached and cached.get('expires', 0) > now:
        stream_url = cached.get('stream_url')
        stream_headers = cached.get('headers', {})
    else:
        is_youtube = ('youtube.com' in target_url) or ('youtu.be' in target_url)
        if is_youtube:
            ydl_opts = {
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'quiet': True,
                'skip_download': True,
                'nocheckcertificate': True,
                'noplaylist': True,
                'extractor_args': {'youtube': {'player_client': ['android', 'ios', 'mweb']}},
            }
        else:
            ydl_opts = {
                'format': 'bestaudio[ext=mp3]/bestaudio[ext=m4a]/bestaudio/best',
                'quiet': True,
                'skip_download': True,
                'nocheckcertificate': True,
                'noplaylist': True,
            }
        _apply_cookies(ydl_opts)
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(target_url, download=False)
                if info and 'entries' in info and info['entries']:
                    info = info['entries'][0]

                chosen_fmt = None
                if info and 'formats' in info:
                    audio_fmts = [f for f in info['formats'] if f.get('url') and f.get('acodec') != 'none']
                    if audio_fmts:
                        chosen_fmt = audio_fmts[-1]
                    elif info.get('url'):
                        chosen_fmt = info
                elif info and info.get('url'):
                    chosen_fmt = info

                if chosen_fmt:
                    stream_url = chosen_fmt.get('url')
                    stream_headers = chosen_fmt.get('http_headers') or info.get('http_headers') or {}

                if stream_url:
                    stream_url_cache[target_url] = {
                        'stream_url': stream_url,
                        'headers': stream_headers,
                        'expires': now + 900
                    }
        except Exception as e:
            return jsonify({'error': f'Gagal membaca stream audio: {str(e)}'}), 400

    if not stream_url:
        return jsonify({'error': 'URL stream audio tidak dapat ditemukan.'}), 404

    req_headers = dict(stream_headers or {})
    if not req_headers:
        req_headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'}
    range_hdr = request.headers.get('Range')
    if range_hdr:
        req_headers['Range'] = range_hdr

    try:
        remote_resp = _req.get(stream_url, headers=req_headers, stream=True, allow_redirects=True, timeout=25)
        if remote_resp.status_code >= 400:
            stream_url_cache.pop(target_url, None)
            return jsonify({'error': f'Gagal memutar audio (HTTP {remote_resp.status_code})'}), remote_resp.status_code

        resp_headers = {}
        for h in ('Content-Type', 'Content-Range', 'Content-Length', 'Accept-Ranges'):
            if h in remote_resp.headers:
                resp_headers[h] = remote_resp.headers[h]
        if 'Accept-Ranges' not in resp_headers:
            resp_headers['Accept-Ranges'] = 'bytes'

        def generate():
            try:
                for chunk in remote_resp.iter_content(chunk_size=65536):
                    if chunk:
                        yield chunk
            except Exception:
                pass

        return Response(
            generate(),
            status=remote_resp.status_code,
            headers=resp_headers,
            direct_passthrough=True
        )
    except Exception as e:
        return jsonify({'error': f'Gagal streaming audio: {str(e)}'}), 500

@app.route('/api/history', methods=['GET'])
@login_required
def api_history_get():
    history = load_json(HISTORY_FILE, [])
    user_id = session.get('user_id')
    user_history = [h for h in history if h.get('user_id') == user_id]
    return jsonify(user_history[:50])

@app.route('/api/history', methods=['DELETE'])
@login_required
def api_history_delete():
    history = load_json(HISTORY_FILE, [])
    user_id = session.get('user_id')
    new_history = [h for h in history if h.get('user_id') != user_id]
    save_json(HISTORY_FILE, new_history)
    return jsonify({'ok': True})

@app.route('/api/roblox/thumbnail/<asset_id>')
@login_required
def api_roblox_thumbnail(asset_id):
    try:
        resp = _req.get(
            'https://thumbnails.roblox.com/v1/assets',
            params={
                'assetIds':     asset_id,
                'returnPolicy': 'PlaceHolder',
                'size':         '150x150',
                'format':       'Png',
                'isCircular':   'false',
            },
            timeout=10,
        )
        data_list = resp.json().get('data', [])
        item      = data_list[0] if data_list else {}
        image_url = item.get('imageUrl', '')
        state     = item.get('state', '')
        if state == 'Completed' or 't2.rbxcdn.com' in image_url:
            status = 'accepted'
        elif state in ('Blocked', 'Moderated') or 't6.rbxcdn.com' in image_url:
            status = 'rejected'
        else:
            status = 'pending'
        return jsonify({'status': status, 'image_url': image_url, 'state': state})
    except Exception as e:
        return jsonify({'error': str(e)}), 502

@app.route('/api/roblox/upload', methods=['POST'])
@login_required
def api_roblox_upload():
    data      = request.get_json(force=True) or {}
    token     = data.get('token', '')
    name      = (data.get('name', 'AudioBypassBot') or 'AudioBypassBot')[:50]
    target    = data.get('target', 'personal')
    file_path = download_tokens.get(token)
    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'File tidak ditemukan atau sudah kadaluarsa.'}), 404
    if target == 'group':
        api_key  = data.get('group_api_key', '').strip()
        group_id = data.get('group_id', '').strip()
        if not api_key or not group_id:
            return jsonify({'error': 'Group API Key dan Group ID harus diisi.'}), 400
        headers = {'x-api-key': api_key}
        creator = {'groupId': group_id}
    else:
        api_key = data.get('api_key', '').strip()
        user_id = data.get('user_id', '').strip()
        if not api_key or not user_id:
            return jsonify({'error': 'API Key dan User ID harus diisi.'}), 400
        headers = {'x-api-key': api_key}
        creator = {'userId': user_id}
    ext      = file_path.rsplit('.', 1)[-1].lower()
    mime     = {'ogg': 'audio/ogg', 'mp3': 'audio/mpeg', 'wav': 'audio/wav'}.get(ext, 'audio/mpeg')
    asset_req = json.dumps({
        'assetType':       'Audio',
        'displayName':     name,
        'description':     '',
        'creationContext': {'creator': creator},
    })
    try:
        with open(file_path, 'rb') as f:
            resp = _req.post(
                ROBLOX_ASSET_URL,
                headers=headers,
                data={'request': asset_req},
                files={'fileContent': (os.path.basename(file_path), f, mime)},
                timeout=60,
            )
    except Exception as e:
        return jsonify({'error': f'Koneksi ke Roblox gagal: {e}'}), 502
    if resp.status_code not in (200, 202):
        try:    err_msg = resp.json().get('message', resp.text)
        except: err_msg = resp.text
        return jsonify({'error': f'Roblox API: {err_msg}'}), 502
    result = resp.json()
    path   = result.get('path', '')
    op_id  = result.get('operationId') or (path.split('/')[-1] if path else '')
    return jsonify({'ok': True, 'operation_id': op_id, 'path': path})

@app.route('/api/roblox/operation/<op_id>')
@login_required
def api_roblox_operation(op_id):
    target = request.args.get('target', 'personal')
    if target == 'group':
        headers = {'x-api-key': request.args.get('group_api_key', '')}
    else:
        headers = {'x-api-key': request.args.get('api_key', '')}
    try:
        resp = _req.get(f'{ROBLOX_OP_URL}/{op_id}', headers=headers, timeout=15)
    except Exception as e:
        return jsonify({'error': str(e)}), 502
    if resp.status_code != 200:
        return jsonify({'error': f'HTTP {resp.status_code}'}), 502
    result   = resp.json()
    done     = result.get('done', False)
    asset_id = None
    rejected = False
    if done:
        response_data = result.get('response', {})
        asset_id      = response_data.get('assetId')
# ─────────────────────────────────────────────
#  APP UPDATER & TAURI AUTO-UPDATE ENDPOINTS
# ─────────────────────────────────────────────
APP_VERSION_FILE = os.path.join(os.path.dirname(__file__), 'app_version.json')

DEFAULT_VERSION_DATA = {
    "version": "2.1.1",
    "min_version": "2.0.0",
    "current_client_version": "2.1.0",
    "pub_date": "2026-10-03T05:45:00Z",
    "force_update": False,
    "title": "Pembaruan RKDKCW Studio v2.1.1",
    "notes": [
        "Perbaikan Bug Scaling UI: Sumber Audio buttons tidak lagi overflow keluar kartu",
        "Auto-Fit Dynamic Layout: Responsif penuh di resolusi laptop (1366x768) dan layar sempit",
        "Perbaikan KPI Stat Cards: Text sub-keterangan tidak lagi terpotong vertikal per-kata",
        "Optimasi Grid Workspace: Kolom samping hanya aktif saat ada hasil konversi atau riwayat"
    ],
    "download_url": "https://github.com/LordJunedGanteng/f4rapps/releases/latest",
    "file_size": "24.6 MB",
    "platforms": {
        "windows-x86_64": {
            "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6...",
            "url": "https://github.com/LordJunedGanteng/f4rapps/releases/download/v2.1.1/RKDKCW_Audio_Studio_Setup_v2.1.1.exe"
        }
    }
}

def get_app_version_info():
    if os.path.exists(APP_VERSION_FILE):
        try:
            with open(APP_VERSION_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_VERSION_DATA

def save_app_version_info(data):
    try:
        with open(APP_VERSION_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False

@app.route('/api/app/version', methods=['GET', 'POST'])
def api_app_version():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        curr = get_app_version_info()
        if 'force_update' in data:
            curr['force_update'] = bool(data['force_update'])
        if 'version' in data and data['version']:
            curr['version'] = str(data['version']).strip()
        if 'notes' in data and isinstance(data['notes'], list):
            curr['notes'] = data['notes']
        save_app_version_info(curr)
        return jsonify({'ok': True, 'data': curr})
    return jsonify({'ok': True, 'data': get_app_version_info()})

@app.route('/launcher')
def serve_launcher():
    dist_file = os.path.join(os.path.dirname(__file__), 'dist_frontend', 'index.html')
    if os.path.exists(dist_file):
        with open(dist_file, 'r', encoding='utf-8') as f:
            return f.read()
    return "Launcher not found", 404

@app.route('/launcher_bg.jpg')
def serve_launcher_bg():
    bg_path = os.path.join(os.path.dirname(__file__), 'dist_frontend', 'launcher_bg.jpg')
    if os.path.exists(bg_path):
        return send_file(bg_path, mimetype='image/jpeg')
    return "Not found", 404

if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", 5000))
        print(f"--- [STARTUP] Attempting to bind on 0.0.0.0:{port} ---")
        if getattr(sys, 'frozen', False):
            threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}/app")).start()
        app.run(host='0.0.0.0', port=port, threaded=True)
    except Exception as e:
        print(f"--- [CRASH] Fatal error during startup: {e} ---")
        with open("crash_log.txt", "w") as f:
            import traceback
            f.write(traceback.format_exc())
        raise e
