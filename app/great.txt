"""Main application entry point"""
import threading
import time
import os
import sys
import json
from functools import wraps
from datetime import datetime

from flask import Flask, jsonify, request, render_template_string, make_response
from flask_cors import CORS
import webview
import qbittorrentapi

import config
from config import *
from utils import *

# ============ DARK MODE (Windows) ============
import ctypes
import ctypes.wintypes


DWMWA_USE_IMMERSIVE_DARK_MODE = 20

def apply_dark_mode(window):
    if not sys.platform.startswith('win'):
        return
    try:
        hwnd = window.native.Handle.ToInt64()
        dwm_api = ctypes.windll.dwmapi.DwmSetWindowAttribute
        dwm_api.argtypes = [
            ctypes.wintypes.HWND,
            ctypes.wintypes.DWORD,
            ctypes.c_void_p,
            ctypes.wintypes.DWORD
        ]
        dark_mode = ctypes.c_int(1)
        result = dwm_api(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE,
                         ctypes.byref(dark_mode), ctypes.sizeof(dark_mode))
        if result == 0:
            print("Dark mode applied to window frame")
        else:
            print(f"Dark mode failed (error {result})")
    except Exception as e:
        print(f"Could not apply dark mode: {e}")

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize template manager
template_manager = TemplateManager(config)

# Global qBittorrent client
qbt_client = None
qbt_connection_error = None

# Persistent library file
LIBRARY_FILE = os.path.join(os.path.expanduser("~"), ".gv_webview_data", "library.json")

# ============ HELPER FUNCTIONS FOR LIBRARY ============

def detect_genre(name):
    """Simple genre detection from game name."""
    name_lower = name.lower()
    if 'rpg' in name_lower or 'cyber' in name_lower or 'arcane' in name_lower or 'legend' in name_lower:
        return 'RPG'
    if 'rac' in name_lower or 'drift' in name_lower or 'velocity' in name_lower or 'need' in name_lower:
        return 'Racing'
    if 'fps' in name_lower or 'war' in name_lower or 'strike' in name_lower or 'combat' in name_lower:
        return 'FPS'
    if 'strat' in name_lower or 'dungeon' in name_lower or 'frost' in name_lower or 'anno' in name_lower:
        return 'Strategy'
    if 'stealth' in name_lower or 'phantom' in name_lower:
        return 'Stealth'
    if 'mmo' in name_lower or 'online' in name_lower:
        return 'MMO'
    if 'pixel' in name_lower or 'indie' in name_lower:
        return 'Indie'
    return 'Action'

def get_game_image(name):
    """Return a placeholder image URL for a game."""
    return f"https://picsum.photos/seed/{name.replace(' ', '-').lower()}/800/450.jpg"

def load_library():
    """Load library from JSON file."""
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_library(library):
    """Save library to JSON file."""
    os.makedirs(os.path.dirname(LIBRARY_FILE), exist_ok=True)
    with open(LIBRARY_FILE, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

def update_library_from_torrents():
    """Check qBittorrent for completed torrents and add them to library."""
    global qbt_client
    if not qbt_client:
        return

    try:
        torrents = qbt_client.torrents_info()
        library = load_library()
        existing_hashes = {item['hash'] for item in library}
        updated = False

        for t in torrents:
            if t.state in ['completed', 'seeding', 'uploading', 'stalledUP']:
                if t.hash not in existing_hashes:
                    library.append({
                        'hash': t.hash,
                        'name': t.name,
                        'size': round(t.size / (1024 ** 3), 2),
                        'save_path': t.save_path,
                        'added_on': datetime.fromtimestamp(t.added_on).strftime('%Y-%m-%d %H:%M'),
                        'completed_on': datetime.now().strftime('%Y-%m-%d %H:%M'),
                        'genre': detect_genre(t.name),
                        'img': get_game_image(t.name)
                    })
                    updated = True
                    print(f"Added {t.name} to library")

        if updated:
            save_library(library)

    except Exception as e:
        print(f"Library update error: {e}")

def library_poller():
    """Background thread to periodically update library."""
    while True:
        if qbt_client:
            update_library_from_torrents()
        time.sleep(60)  # check every 60 seconds

# ============ QBITTORRENT CONNECTION ============

def connect_qbittorrent():
    """Connect to qBittorrent using either API key or username/password"""
    global qbt_client, qbt_connection_error

    try:
        if config.get('qbt_api_key'):
            print(f"Connecting to qBittorrent using API Key")
            qbt = qbittorrentapi.Client(
                host=config['qbt_host'],
                port=config['qbt_port'],
                VERIFY_WEBUI_CERTIFICATE=False,
                REQUESTS_ARGS={'timeout': 30}
            )
            qbt._session.headers.update({'X-API-Key': config['qbt_api_key']})

            try:
                version = qbt.app.version
                print(f"Connected to qBittorrent v{version} (API Key auth)")
                qbt_client = qbt
                qbt_connection_error = None
                return True
            except qbittorrentapi.APIConnectionError:
                print("API key failed, falling back to username/password")

        print(f"Connecting to qBittorrent using Username/Password")
        qbt = qbittorrentapi.Client(
            host=config['qbt_host'],
            port=config['qbt_port'],
            username=config['qbt_user'],
            password=config['qbt_pass'],
            VERIFY_WEBUI_CERTIFICATE=False,
            REQUESTS_ARGS={'timeout': 30}
        )

        qbt.auth_log_in()

        if hasattr(qbt.auth, 'get_api_key'):
            try:
                api_key = qbt.auth.get_api_key()
                if api_key:
                    print(f"Retrieved API Key: {api_key[:8]}...")
                    config.set('qbt_api_key', api_key)
            except:
                pass

        print(f"Connected to qBittorrent v{qbt.app.version}")
        qbt_client = qbt
        qbt_connection_error = None
        return True

    except qbittorrentapi.LoginFailed as e:
        error_msg = f"Login failed: {e}"
        print(f"[ERROR] {error_msg}")
        qbt_connection_error = error_msg
        return False
    except Exception as e:
        error_msg = f"Connection failed: {e}"
        print(f"[ERROR] {error_msg}")
        qbt_connection_error = error_msg
        return False


# ============ API AUTHENTICATION ============

def require_auth(f):
    if not config.get('require_auth'):
        return f

    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != config.get('api_secret_key'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)

    return decorated_function


# ============ ANTI-EMBEDDING MIDDLEWARE ============

@app.after_request
def add_anti_embedding_script(response):
    if response.content_type and 'text/html' in response.content_type:
        try:
            html_content = response.get_data(as_text=True)

            anti_embedding_script = '''
            <script>
            (function() {
                function isRunningInGameVaultWebView() {
                    if (window.pywebview || window.webview) return true;
                    const ua = navigator.userAgent.toLowerCase();
                    if (ua.includes('pywebview') || ua.includes('webview')) return true;
                    if (window.self !== window.top) return false;
                    if (typeof window.chrome !== 'undefined' && window.chrome.webview) return true;
                    if (window.external && window.external.pywebview) return true;
                    return false;
                }

                if (!isRunningInGameVaultWebView()) {
                    document.documentElement.innerHTML = '';
                    document.body.innerHTML = '';
                    const blocker = document.createElement('div');
                    blocker.style.cssText = `
                        position: fixed; top:0; left:0; width:100%; height:100%;
                        background: #050508; display:flex; flex-direction:column;
                        align-items:center; justify-content:center;
                        font-family: 'Inter', -apple-system, sans-serif; z-index:999999;
                    `;
                    blocker.innerHTML = `
                        <div style="text-align:center; max-width:500px; padding:40px;">
                            <div style="font-size:64px; margin-bottom:20px;"></div>
                            <h1 style="color:#ff3355; margin-bottom:16px; font-size:24px; font-weight:700;">Access Denied</h1>
                            <p style="color:#8888a0; margin-bottom:24px; line-height:1.6;">
                                GameVault can only be accessed through its dedicated application.<br>
                                Please launch GameVault from the installed application.
                            </p>
                            <div style="background:rgba(255,51,85,0.1); padding:12px; border-radius:8px; border-left:3px solid #ff3355;">
                                <code style="font-size:12px; color:#8888a0;">Error: WEBVIEW_REQUIRED</code>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(blocker);
                    console.clear();
                    console.log = console.warn = console.error = console.info = function() {};
                    throw new Error('GameVault WebView required');
                }
                console.log('GameVault WebView authenticated');
            })();
            </script>
            '''

            if '</body>' in html_content:
                html_content = html_content.replace('</body>', anti_embedding_script + '</body>')
            elif '</html>' in html_content:
                html_content = html_content.replace('</html>', anti_embedding_script + '</html>')
            else:
                html_content = html_content + anti_embedding_script

            response.set_data(html_content)

        except Exception as e:
            print(f" Could not inject anti-embedding script: {e}")

    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    return response


# ============ API ROUTES ============

@app.route('/')
def index():
    template = template_manager.get_template()
    connection_status = {
        'connected': qbt_client is not None,
        'error': qbt_connection_error
    }
    return render_template_string(template, connection_status=connection_status)


@app.route('/api/torrents', methods=['GET'])
def get_torrents():
    if not qbt_client:
        return jsonify({
            'error': 'qBittorrent not connected',
            'connection_error': qbt_connection_error,
            'status': 'disconnected'
        }), 503

    try:
        torrents = []
        filter_type = request.args.get('filter', 'all')
        filter_map = {
            'downloading': 'downloading',
            'completed': 'completed',
            'active': 'active',
            'paused': 'paused',
            'all': 'all'
        }
        qbt_torrents = qbt_client.torrents_info(
            status_filter=filter_map.get(filter_type, 'all')
        )

        for t in qbt_torrents[:config['max_torrents_display']]:
            torrents.append({
                'hash': t.hash,
                'name': t.name,
                'progress': round(t.progress * 100, 2),
                'size': round(t.size / (1024 ** 3), 2),
                'downloaded': round(t.downloaded / (1024 ** 3), 2),
                'uploaded': round(t.uploaded / (1024 ** 3), 2),
                'download_speed': round(t.dlspeed / 1024, 1),
                'upload_speed': round(t.upspeed / 1024, 1),
                'state': t.state,
                'num_seeds': t.num_seeds,
                'num_leechs': t.num_leechs,
                'ratio': round(t.ratio, 2),
                'added_on': datetime.fromtimestamp(t.added_on).strftime('%Y-%m-%d %H:%M'),
                'save_path': t.save_path,
            })
        return jsonify({
            'torrents': torrents,
            'connected': True,
            'status': 'connected'
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'connected': False,
            'status': 'error'
        }), 500


@app.route('/api/transfer', methods=['GET'])
def get_transfer():
    if not qbt_client:
        return jsonify({
            'error': 'qBittorrent not connected',
            'connection_error': qbt_connection_error,
            'connected': False
        }), 503

    try:
        info = qbt_client.transfer.info()
        return jsonify({
            'dl_speed': round(info.dl_info_speed / 1024, 1),
            'up_speed': round(info.up_info_speed / 1024, 1),
            'dl_data': round(info.dl_info_data / (1024 ** 3), 2),
            'up_data': round(info.up_info_data / (1024 ** 3), 2),
            'connected': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'connected': False
        }), 500


@app.route('/api/add', methods=['POST'])
def add_torrent():
    if not qbt_client:
        return jsonify({
            'error': 'qBittorrent not connected',
            'connection_error': qbt_connection_error
        }), 503

    data = request.json
    magnet = data.get('magnet')

    if not magnet:
        return jsonify({'error': 'No magnet link provided'}), 400

    try:
        qbt_client.torrents_add(urls=magnet)
        return jsonify({'status': 'added', 'connected': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/pause/<string:hash_id>', methods=['POST'])
def pause_torrent(hash_id):
    if not qbt_client:
        return jsonify({'error': 'qBittorrent not connected'}), 503
    try:
        qbt_client.torrents_pause(torrent_hashes=hash_id)
        return jsonify({'status': 'paused'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/resume/<string:hash_id>', methods=['POST'])
def resume_torrent(hash_id):
    if not qbt_client:
        return jsonify({'error': 'qBittorrent not connected'}), 503
    try:
        qbt_client.torrents_resume(torrent_hashes=hash_id)
        return jsonify({'status': 'resumed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/remove/<string:hash_id>', methods=['DELETE'])
def remove_torrent(hash_id):
    if not qbt_client:
        return jsonify({'error': 'qBittorrent not connected'}), 503
    try:
        delete_files = request.json.get('delete_files', False) if request.json else False
        qbt_client.torrents_delete(torrent_hashes=hash_id, delete_files=delete_files)
        return jsonify({'status': 'removed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/pause/all', methods=['POST'])
def pause_all():
    if not qbt_client:
        return jsonify({'error': 'qBittorrent not connected'}), 503
    try:
        qbt_client.torrents_pause.all()
        return jsonify({'status': 'all_paused'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/resume/all', methods=['POST'])
def resume_all():
    if not qbt_client:
        return jsonify({'error': 'qBittorrent not connected'}), 503
    try:
        qbt_client.torrents_resume.all()
        return jsonify({'status': 'all_resumed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'connected': qbt_client is not None,
        'has_api_key': bool(config.get('qbt_api_key')),
        'download_path': config['download_path'],
        'connection_error': qbt_connection_error
    })


@app.route('/api/reconnect', methods=['POST'])
def reconnect():
    global qbt_client, qbt_connection_error
    print(" Attempting to reconnect to JumboStationQB...")
    success = connect_qbittorrent()
    if success and qbt_client:
        try:
            qbt_client.app.set_preferences({'save_path': config['download_path']})
            # Immediately update library after reconnect
            update_library_from_torrents()
        except:
            pass
    return jsonify({
        'connected': qbt_client is not None,
        'error': qbt_connection_error if not success else None
    })

# ============ NEW: LIBRARY API ============
@app.route('/api/library', methods=['GET'])
def get_library():
    """Get the persistent library of completed games."""
    return jsonify({
        'library': load_library(),
        'connected': qbt_client is not None
    })


# ============ EXTERNAL PAGE ENHANCEMENT ============

def get_external_page_enhancement_js(flask_origin):
    js_template = """
    (function() {
        if (window.__gvEnhanced) return;
        window.__gvEnhanced = true;

        document.addEventListener('keydown', function(e) {
            const tag = document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                window.history.back();
            } else if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                window.history.forward();
            }
        });

        if (!document.getElementById('gv-guide')) {
            const guide = document.createElement('div');
            guide.id = 'gv-guide';
            guide.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                background: rgba(20,20,30,0.9); color: #eee;
                padding: 12px 18px; border-radius: 10px;
                font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px;
                line-height: 1.6; box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                z-index: 999999; backdrop-filter: blur(4px);
                border-left: 4px solid #ff3355; max-width: 280px;
                transition: opacity 0.5s ease, transform 0.5s ease;
                opacity: 0; transform: translateY(20px); pointer-events: none;
            `;
            guide.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:10px;">
                    <span style="font-size:18px;"></span>
                    <div>
                        <strong style="color:#fff;">WebView Shortcuts</strong><br>
                        <span style="color:#aaa;font-size:13px;">
                            <kbd style="background:#333;padding:2px 6px;border-radius:4px;color:#fff;">Ctrl+Z</kbd> ← Back &nbsp;|&nbsp;
                            <kbd style="background:#333;padding:2px 6px;border-radius:4px;color:#fff;">Ctrl+U</kbd> → Forward
                        </span>
                    </div>
                    <button id="gv-close-guide" style="
                        background:transparent; border:none; color:#888; font-size:18px;
                        cursor:pointer; padding:0 4px; line-height:1; margin-left:auto;
                        transition:color 0.2s;
                    " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">✕</button>
                </div>
            `;
            document.body.appendChild(guide);

            document.getElementById('gv-close-guide').addEventListener('click', function() {
                guide.style.opacity = '0';
                guide.style.transform = 'translateY(20px)';
                setTimeout(() => guide.remove(), 500);
            });

            setTimeout(() => {
                if (document.getElementById('gv-guide')) {
                    guide.style.opacity = '0';
                    guide.style.transform = 'translateY(20px)';
                    setTimeout(() => { if (guide.parentNode) guide.remove(); }, 500);
                }
            }, 10000);

            requestAnimationFrame(() => {
                guide.style.opacity = '1';
                guide.style.transform = 'translateY(0)';
                guide.style.pointerEvents = 'auto';
            });
        }

        if (document.getElementById('gv-toolbar')) return;

        const bodyStyle = document.createElement('style');
        bodyStyle.id = 'gv-toolbar-style';
        bodyStyle.textContent = `body { padding-top: 56px !important; }`;
        document.head.appendChild(bodyStyle);

        const toolbar = document.createElement('div');
        toolbar.id = 'gv-toolbar';
        toolbar.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%;
            height: 48px;
            background: rgba(15, 15, 25, 0.85);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            display: flex; align-items: center;
            padding: 0 16px;
            box-shadow: 0 4px 30px rgba(0,0,0,0.5);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            z-index: 999998;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            opacity: 0;
            transform: translateY(-20px);
            transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        const backIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        const forwardIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
        const homeIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>`;
        const closeIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        toolbar.innerHTML = `
            <button id="gv-back" class="gv-btn" style="
                background: rgba(255,255,255,0.05);
                border: none; color: #e0e0e0;
                cursor: pointer; padding: 6px 12px;
                border-radius: 30px;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.2s, transform 0.2s, color 0.2s;
                margin-right: 4px;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'"
               onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${backIcon}</button>
            <button id="gv-forward" class="gv-btn" style="
                background: rgba(255,255,255,0.05);
                border: none; color: #e0e0e0;
                cursor: pointer; padding: 6px 12px;
                border-radius: 30px;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.2s, transform 0.2s, color 0.2s;
                margin-right: 8px;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'"
               onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${forwardIcon}</button>
            <div style="width:1px; height:28px; background:rgba(255,255,255,0.15); margin-right:8px;"></div>
            <button id="gv-home" class="gv-btn" style="
                background: rgba(255,255,255,0.05);
                border: none; color: #e0e0e0;
                cursor: pointer; padding: 6px 12px;
                border-radius: 30px;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.2s, transform 0.2s, color 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'"
               onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${homeIcon}</button>
            <div style="flex:1;"></div>
            <button id="gv-close-toolbar" style="
                background: transparent; border: none;
                color: #888; font-size: 14px;
                cursor: pointer; padding: 4px 12px;
                border-radius: 30px;
                display: flex; align-items: center; gap: 6px;
                transition: background 0.2s, color 0.2s;
                font-family: inherit;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'"
               onmouseout="this.style.background='transparent';this.style.color='#888'">
                ${closeIcon} Close
            </button>
        `;
        document.body.prepend(toolbar);

        document.getElementById('gv-back').addEventListener('click', () => window.history.back());
        document.getElementById('gv-forward').addEventListener('click', () => window.history.forward());
        document.getElementById('gv-home').addEventListener('click', () => {
            window.location.href = flaskOrigin;
        });

        document.getElementById('gv-close-toolbar').addEventListener('click', function() {
            localStorage.setItem('gv_toolbar_hidden', 'true');
            toolbar.remove();
            const styleEl = document.getElementById('gv-toolbar-style');
            if (styleEl) styleEl.remove();
        });

        requestAnimationFrame(() => {
            toolbar.style.opacity = '1';
            toolbar.style.transform = 'translateY(0)';
        });
    })();
    """
    return js_template.replace('$FLASK_ORIGIN$', flask_origin)


# ============ MAIN ============

def run_flask():
    app.run(
        host=config['flask_host'],
        port=config['flask_port'],
        debug=config['flask_debug'],
        use_reloader=False
    )


def main():
    print("Starting qBittorrent WebView Client")
    print("=" * 50)

    storage_dir = os.path.join(os.path.expanduser("~"), ".gv_webview_data")
    os.makedirs(storage_dir, exist_ok=True)

    os.makedirs(config['download_path'], exist_ok=True)

    print("🔌 Attempting to connect to JumboStationQB...")
    connected = connect_qbittorrent()

    if not connected:
        print("\n Could not connect to JumboStationQB!")
        print(" The WebView interface will still open, but torrent functions will be disabled.")
        print(" You can reconnect later using the 'Reconnect' button in the UI.\n")
        print("Setup instructions for qBittorrent:")
        print("1. Install JumboStationQB from https://www.jumbostation.com/qb")
        print("2. Enable Web UI: Tools → Preferences → Web UI")
        print("3. Set username/password (default: admin/adminadmin)")
        print("4. Port: ****")
        print("\n" + "=" * 50)
    else:
        try:
            qbt_client.app.set_preferences({'save_path': config['download_path']})
            print(f"[FOLDER] Download path set to: {config['download_path']}")
        except Exception as e:
            print(f"[WARN] Could not set download path: {e}")
        # Start library poller thread
        poller_thread = threading.Thread(target=library_poller, daemon=True)
        poller_thread.start()
        print(" Library poller started")

    print("\n Loading HTML template...")
    template_manager.get_template()

    flask_url = f"http://{config['flask_host']}:{config['flask_port']}"
    print(f"\n Starting Flask server on {flask_url}")
    if qbt_client:
        print(f" qBittorrent API: http://{config['qbt_host']}:{config['qbt_port']}")
    else:
        print(f" qBittorrent: Disconnected (reconnect from UI)")

    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    time.sleep(2)

    print("\n🪟 Opening WebView window...")
    window = webview.create_window(
        'JumboStation',
        flask_url,
        width=1200,
        height=900,
        resizable=True,
        background_color='#000000',
        frameless=False
    )

    window.events.before_show += apply_dark_mode

    def on_loaded():
        window.evaluate_js(get_external_page_enhancement_js(flask_url))

    window.events.loaded += on_loaded

    webview.start(
        private_mode=False,
        storage_path=storage_dir
    )


if __name__ == '__main__':
    main()
