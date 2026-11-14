#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import http.server
import socketserver
import urllib.parse
import shutil
import hashlib
import base64
import json
import sys
import os
import re

PORT = 8000
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

FAVICON_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f0f0f" stroke="#3d3d3d" stroke-width="2"/>
  <path d="M18 22L28 32L18 42" stroke="#f0f0f0" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <line x1="32" y1="42" x2="46" y2="42" stroke="#f0f0f0" stroke-width="4.5" stroke-linecap="round"/>
</svg>"""

DisconnectExceptions = (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)


def save_uploaded_bytes(folder: str, raw_filename: str, raw_bytes: bytes) -> str:
    """Сохраняет файл в assets/<folder>/ с проверкой дубликатов по MD5-хэшу."""
    if folder not in ('videos', 'photos', 'avatars'):
        folder = 'videos'
    clean_name = re.sub(r'[^a-zA-Z0-9._-]', '_', os.path.basename(raw_filename or 'file.bin'))
    if not clean_name or clean_name.startswith('.'):
        clean_name = 'file.bin'

    rel_dir = os.path.join('assets', folder)
    os.makedirs(rel_dir, exist_ok=True)

    # Проверяем, нет ли уже точно такого же файла (по размеру и MD5), чтобы не плодить копии _1, _2
    new_md5 = hashlib.md5(raw_bytes).hexdigest()
    new_size = len(raw_bytes)
    for existing in os.listdir(rel_dir):
        ex_path = os.path.join(rel_dir, existing)
        if os.path.isfile(ex_path) and os.path.getsize(ex_path) == new_size:
            try:
                with open(ex_path, 'rb') as ef:
                    if hashlib.md5(ef.read()).hexdigest() == new_md5:
                        return f"assets/{folder}/{existing}"
            except OSError:
                pass

    base, ext = os.path.splitext(clean_name)
    final_name = clean_name
    counter = 1
    while os.path.exists(os.path.join(rel_dir, final_name)):
        final_name = f"{base}_{counter}{ext}"
        counter += 1

    full_path = os.path.join(rel_dir, final_name)
    with open(full_path, 'wb') as f:
        f.write(raw_bytes)

    return f"assets/{folder}/{final_name}"


class QuietThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        exc_type, _, _ = sys.exc_info()
        if exc_type is not None and issubclass(exc_type, DisconnectExceptions):
            return
        super().handle_error(request, client_address)


class PortfolioHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        if len(args) >= 1 and isinstance(args[0], str):
            if '/api/ping' in args[0] or '/favicon.' in args[0]:
                return
        super().log_message(format, *args)

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except DisconnectExceptions:
            self.close_connection = True

    def copyfile(self, source, outputfile):
        try:
            shutil.copyfileobj(source, outputfile, length=64 * 1024)
        except DisconnectExceptions:
            pass

    def send_error(self, code, message=None, explain=None):
        try:
            super().send_error(code, message, explain)
        except DisconnectExceptions:
            pass

    def send_json(self, data: dict, status: int = 200):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)
        except DisconnectExceptions:
            pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = urllib.parse.unquote(parsed.path)

        # 1. Фавиконка без ошибки 404 и WinError 10053
        if req_path in ('/favicon.ico', '/favicon.svg'):
            svg_file = os.path.join(ROOT_DIR, 'favicon.svg')
            content = FAVICON_SVG
            if os.path.isfile(svg_file):
                try:
                    with open(svg_file, 'rb') as f:
                        content = f.read()
                except OSError:
                    pass
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'image/svg+xml')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                self.wfile.write(content)
            except DisconnectExceptions:
                pass
            return

        # 2. Удобный вход в админку по /admin и /admin/
        if req_path in ('/admin', '/admin/'):
            self.send_response(302)
            self.send_header('Location', '/admin.html')
            self.end_headers()
            return

        # 3. API проверки связи
        if req_path == '/api/ping':
            self.send_json({"ok": True})
            return

        # 4. API списка файлов в assets/
        if req_path == '/api/assets':
            assets_info = {"avatars": [], "photos": [], "videos": []}
            for folder in ('avatars', 'photos', 'videos'):
                fdir = os.path.join(ROOT_DIR, 'assets', folder)
                if os.path.isdir(fdir):
                    for fname in sorted(os.listdir(fdir)):
                        if fname.lower() == 'readme.txt' or fname.startswith('.'):
                            continue
                        fpath = os.path.join(fdir, fname)
                        if os.path.isfile(fpath):
                            assets_info[folder].append({
                                "name": fname,
                                "path": f"assets/{folder}/{fname}",
                                "size": os.path.getsize(fpath)
                            })
            self.send_json({"ok": True, "assets": assets_info})
            return

        # 5. Поддержка HTTP Range (206 Partial Content) для плавной перемотки видео без обрыва сокета
        range_header = self.headers.get('Range')
        if range_header and req_path.startswith('/assets/'):
            local_path = self.translate_path(self.path)
            if os.path.isfile(local_path):
                self.serve_range_file(local_path, range_header)
                return

        try:
            return super().do_GET()
        except DisconnectExceptions:
            pass

    def serve_range_file(self, local_path: str, range_header: str):
        try:
            file_size = os.path.getsize(local_path)
            m = re.match(r'bytes=(\d*)-(\d*)', range_header)
            if not m:
                return super().do_GET()

            start_str, end_str = m.groups()
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            if start >= file_size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{file_size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return

            end = min(end, file_size - 1)
            chunk_len = end - start + 1
            ctype = self.guess_type(local_path)

            with open(local_path, 'rb') as f:
                f.seek(start)
                self.send_response(206)
                self.send_header('Content-Type', ctype)
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                self.send_header('Content-Length', str(chunk_len))
                self.end_headers()

                remaining = chunk_len
                buf_size = 64 * 1024
                while remaining > 0:
                    data = f.read(min(buf_size, remaining))
                    if not data:
                        break
                    self.wfile.write(data)
                    remaining -= len(data)
        except DisconnectExceptions:
            pass
        except OSError:
            pass

    def end_headers(self):
        if self.path.startswith('/assets/videos/'):
            self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = parsed.path

        # Быстрая бинарная загрузка файлов без потерь на Base64
        if req_path == '/api/upload-raw':
            length = int(self.headers.get('Content-Length', 0))
            folder = urllib.parse.unquote(self.headers.get('X-Folder', 'videos'))
            filename = urllib.parse.unquote(self.headers.get('X-Filename', 'file.bin'))
            raw_bytes = self.rfile.read(length) if length > 0 else b''
            rel_url = save_uploaded_bytes(folder, filename, raw_bytes)
            self.send_json({"ok": True, "path": rel_url})
            return

        # Загрузка в формате JSON (Base64)
        if req_path == '/api/upload':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            folder = body.get('folder', 'videos')
            filename = body.get('filename', 'file.bin')
            data_url = body.get('dataUrl', '')
            b64_part = data_url.split(',', 1)[1] if ',' in data_url else data_url
            raw_bytes = base64.b64decode(b64_part) if b64_part else b''
            rel_url = save_uploaded_bytes(folder, filename, raw_bytes)
            self.send_json({"ok": True, "path": rel_url})
            return

        # Сохранение js/data.js
        if req_path == '/api/save-data':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            js_code = body.get('jsCode', '')
            if js_code:
                with open(os.path.join(ROOT_DIR, 'js', 'data.js'), 'w', encoding='utf-8') as f:
                    f.write(js_code)
            self.send_json({"ok": True})
            return

        # Удаление файла из assets/
        if req_path == '/api/delete-asset':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            rel_path = body.get('path', '').lstrip('/\\')
            abs_target = os.path.abspath(os.path.join(ROOT_DIR, rel_path))
            assets_root = os.path.abspath(os.path.join(ROOT_DIR, 'assets'))
            if abs_target.startswith(assets_root) and os.path.isfile(abs_target):
                try:
                    os.remove(abs_target)
                    self.send_json({"ok": True})
                    return
                except OSError as e:
                    self.send_json({"ok": False, "error": str(e)}, status=500)
                    return
            self.send_json({"ok": False, "error": "Файл не найден"}, status=404)
            return

        self.send_json({"ok": False, "error": "Not found"}, status=404)


if __name__ == '__main__':
    with QuietThreadingTCPServer(("", PORT), PortfolioHandler) as httpd:
        print("=" * 54)
        print(f" Сайт:   http://localhost:{PORT}")
        print(f" Админ:  http://localhost:{PORT}/admin.html (пароль: 3151020)")
        print("=" * 54)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен.")
