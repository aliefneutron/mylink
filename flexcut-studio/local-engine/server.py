"""FlexCut local bridge for the supplied Maliki klip, motion and voice engines.
Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id
Source reuse follows ../vendor/studio-maliki/LICENSE.
"""
from __future__ import annotations

import hmac
import importlib.util
import io
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
import webbrowser
import urllib.request
from http.server import ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs
sys.dont_write_bytecode = True

APP = Path(__file__).resolve().parent.parent
VENDOR = APP / "vendor" / "studio-maliki"
DATA = Path(os.environ.get("FLEXCUT_DATA", Path.home() / "FlexCut Studio"))
PORT = int(os.environ.get("FLEXCUT_PORT", "8791"))
# Mode server (tanpa instalasi lokal): FLEXCUT_HOST=0.0.0.0 + FLEXCUT_TOKEN, di balik proxy HTTPS.
HOST = os.environ.get("FLEXCUT_HOST", "127.0.0.1")
TOKEN = os.environ.get("FLEXCUT_TOKEN", "")
REMOTE = HOST not in ("127.0.0.1", "localhost", "::1")
EXTRA_ORIGINS = {o.strip().rstrip("/") for o in os.environ.get("FLEXCUT_ORIGINS", "").split(",") if o.strip()}
MAX_UPLOAD = int(os.environ.get("FLEXCUT_MAX_UPLOAD_MB", "2048")) * 1024 * 1024
if REMOTE and len(TOKEN) < 24:
    raise SystemExit("FLEXCUT_TOKEN (minimal 24 karakter) wajib diisi saat FLEXCUT_HOST bukan alamat lokal.")
DATA.mkdir(parents=True, exist_ok=True)
os.environ["STUDIO_DATA"] = str(DATA)
os.environ["STUDIO_PORT"] = str(PORT)
spec = importlib.util.spec_from_file_location("maliki_studio", VENDOR / "studio" / "studio.py")
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
engine.MOTION = DATA / ".engine" / "motion"
shutil.copytree(VENDOR / "motion", engine.MOTION, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns("node_modules", "hasil", "public", "__pycache__"))
engine.SUARA = DATA / ".engine" / "suara"
shutil.copytree(VENDOR / "suara", engine.SUARA, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns("__pycache__"))
CATALOG = json.loads((APP / "maliki-templates.json").read_text(encoding="utf-8"))
CREDIT = "Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id"
original_project = engine.muat_proyek

def load_project(kind, name):
    result = original_project(kind, name)
    if (DATA / kind / name / "voice.wav").is_file():
        result["audio"] = f"/berkas/{kind}/{name}/voice.wav"
    return result

engine.muat_proyek = load_project

def new_project(kind):
    if engine.KERJA.status == "jalan":
        raise ValueError("Masih ada proses berjalan. Tunggu atau batalkan.")
    folder = DATA / kind / ("flexcut-" + uuid.uuid4().hex[:16])
    folder.mkdir(parents=True)
    return folder

engine.proyek_baru = new_project

def prepare_motion():
    node = engine.cari_node()
    npm = Path(node).resolve().parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
    command = [node, str(npm), "ci", "--no-audit", "--no-fund"] if npm.exists() else [
        shutil.which("npm") or "npm", "ci", "--no-audit", "--no-fund"]
    engine.KERJA.jalankan("pasang", [(command, engine.MOTION)], engine.MOTION)
    return {"ok": True}

def clone_voice(data):
    """Kloning suara lokal dengan VoxCPM2 (tanpa API). Hanya mode lokal."""
    if REMOTE:
        raise ValueError("Kloning VoxCPM hanya tersedia pada mesin lokal.")
    if not data.get("izin"):
        raise ValueError("Centang pernyataan izin pemakaian suara.")
    uploads = (DATA / "unggahan").resolve()
    ref = Path(str(data.get("referensi", ""))).resolve()
    if not ref.is_file() or not ref.is_relative_to(uploads):
        raise ValueError("Rekaman referensi harus diunggah lewat FlexCut.")
    text = str(data.get("teks", "")).strip()
    if not text or len(text) > 1000:
        raise ValueError("Teks narasi wajib diisi, maksimal 1000 karakter.")
    if not engine.voxcpm_terpasang():
        raise ValueError("VoxCPM2 belum dipasang. Klik Pasang VoxCPM2 terlebih dahulu.")
    folder = new_project("motion")
    out = folder / "voice.wav"
    cmd = [engine.cari_uv(), "run", "-q", str(engine.SUARA / "suara.py"),
           "--teks", text, "--keluar", str(out), "--referensi", str(ref)]
    engine.KERJA.jalankan(
        "suara", [(cmd, engine.SUARA)], folder,
        setelah=lambda k: setattr(k, "hasil", {
            "jenis": "motion", "nama": folder.name,
            "audio": f"/berkas/motion/{folder.name}/voice.wav"}))
    return {"ok": True}

class Handler(engine.H):
    def _file(self, path):
        if not path.is_file():
            return self._json({"galat": "Berkas tidak ditemukan."}, 404)
        size = path.stat().st_size
        start, end = 0, size - 1
        byte_range = self.headers.get("Range")
        if byte_range:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", byte_range)
            if match and match.group(1):
                start = int(match.group(1))
                end = min(size - 1, int(match.group(2))) if match.group(2) else size - 1
            elif match and match.group(2):
                start, end = max(0, size - int(match.group(2))), size - 1
            else:
                start = size
            if start >= size or start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        self.send_response(206 if byte_range else 200)
        if byte_range:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        content_type = "application/octet-stream" if getattr(self, "binary_download", False) else engine.mimetypes.guess_type(path.name)[0]
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store" if path.is_relative_to(DATA) else "no-cache")
        self.send_header("Content-Length", str(max(0, end - start + 1)))
        self.end_headers()
        try:
            with path.open("rb") as stream:
                stream.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = stream.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, obj, kode=200):
        starts = {"/api/motion", "/api/klip", "/api/klip-render", "/api/siapkan", "/api/flexcut/klon-suara"}
        if self.command == "POST" and self.path in starts and kode == 200:
            obj = {**obj, "jobid": engine.KERJA.id}
        if kode == 403:
            self._denied = True
        return super()._json(obj, kode)

    def _asal_aman(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urlparse(origin)
        return ((parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"))
                or origin in ("https://aliefneutron.my.id", "https://www.aliefneutron.my.id",
                              "https://aliefneutron.github.io")
                or origin in EXTRA_ORIGINS)

    def _izin(self):
        if not TOKEN:
            return True
        supplied = self.headers.get("Authorization", "")
        return hmac.compare_digest(supplied.encode(), ("Bearer " + TOKEN).encode())

    def _cek_sumber(self, data):
        # Mode server: sumber klip hanya URL http(s) atau berkas yang diunggah lewat /api/unggah.
        uploads = (DATA / "unggahan").resolve()
        for key in ("sumber", "subtitle_file"):
            value = str(data.get(key) or "").strip()
            if not value:
                continue
            if re.match(r"^https?://", value, re.I):
                continue
            try:
                inside = Path(value).resolve().is_relative_to(uploads)
            except (OSError, ValueError):
                inside = False
            if not inside:
                raise ValueError("Sumber harus berupa tautan http(s) atau berkas yang diunggah.")

    def end_headers(self):
        origin = self.headers.get("Origin")
        # Origin ditolak tetap diberi header CORS agar browser dapat membaca pesan 403,
        # bukan melaporkannya sebagai "mesin belum terhubung".
        if origin and (self._asal_aman() or getattr(self, "_denied", False)):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()

    def do_OPTIONS(self):
        if not self._asal_aman():
            return self._json({"galat": "Asal tidak diizinkan: " + str(self.headers.get("Origin"))}, 403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Nama-File, X-Jenis, X-Izin, Range")
        self.end_headers()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if not self._asal_aman():
            return self._json({"galat": "Asal tidak diizinkan: " + str(self.headers.get("Origin"))}, 403)
        open_path = path in ("/", "/app") or path.startswith("/app/") or path == "/api/flexcut/health"
        if TOKEN and not open_path and not self._izin():
            return self._json({"galat": "Token akses mesin tidak valid atau belum diisi."}, 401)
        if path in ("/", "/app"):
            self.send_response(302)
            self.send_header("Location", "/app/")
            self.end_headers()
            return
        if path.startswith("/app/"):
            local = (APP / (path[5:] or "index.html")).resolve()
            if not local.is_relative_to(APP) or not local.is_file():
                return self._json({"galat": "Berkas tidak ditemukan."}, 404)
            return self._file(local)
        if path == "/studio":
            return self._file(engine.AKAR / "index.html")
        if path == "/api/flexcut/health":
            return self._json({"service": "flexcut-motion", "version": 1, "templates": len(CATALOG),
                               "voice": "Voicebox", "credit": CREDIT,
                               "system": engine.cek_sistem() if self._izin() else {}})
        if path == "/api/flexcut/asset":
            requested = parse_qs(urlparse(self.path).query).get("path", [""])[0]
            match = re.fullmatch(r"/berkas/(motion|klip)/([\w-]+)/([\w.-]+)", requested)
            if not match:
                return self._json({"galat": "Alamat hasil tidak dikenali."}, 400)
            self.binary_download = True
            return self._file(DATA / match.group(1) / match.group(2) / match.group(3))
        if path == "/api/proyek":
            projects = engine.daftar_proyek()
            for voice in (DATA / "motion").glob("*/voice.wav"):
                projects.append({"jenis": "motion", "nama": voice.parent.name,
                                 "judul": "Narasi " + voice.parent.name, "jumlah": 1})
            return self._json(sorted(projects, key=lambda item: item["nama"], reverse=True)[:100])
        return super().do_GET()

    def do_POST(self):
        if not self._asal_aman():
            return self._json({"galat": "Asal tidak diizinkan: " + str(self.headers.get("Origin"))}, 403)
        path = urlparse(self.path).path
        if TOKEN and not self._izin():
            return self._json({"galat": "Token akses mesin tidak valid atau belum diisi."}, 401)
        if REMOTE and path in {"/api/pasang-cli", "/api/login-cli", "/api/ollama-tarik"}:
            return self._json({"galat": "Operasi ini dinonaktifkan pada mode server."}, 404)
        try:
            if path == "/api/unggah" and int(self.headers.get("Content-Length") or 0) > MAX_UPLOAD:
                return self._json({"galat": "Berkas melebihi batas unggah server."}, 413)
            if REMOTE and path == "/api/klip":
                raw = self.rfile.read(int(self.headers.get("Content-Length") or 0))
                self._cek_sumber(json.loads(raw or b"{}"))
                self.rfile = io.BytesIO(raw)
            if path == "/api/batal":
                data = self._body()
                if data.get("jobid") in (None, engine.KERJA.id):
                    engine.KERJA.batal()
                return self._json({"ok": True})
            if path == "/api/siapkan":
                data = self._body()
                component = data.get("komponen")
                if component not in {"motion", "klip", "voxcpm"}:
                    raise ValueError("Pilih komponen Motion, Klip, atau VoxCPM.")
                return self._json(prepare_motion() if component == "motion" else engine.siapkan(component))
            if path == "/api/flexcut/klon-suara":
                return self._json(clone_voice(self._body()))
            if path == "/api/motion":
                data = self._body()
                if data.get("gaya") not in {row["id"] for row in CATALOG}:
                    raise ValueError("Pilih salah satu dari 24 template.")
                if not (engine.MOTION / "node_modules" / "remotion").exists():
                    raise ValueError("Klik Siapkan Motion terlebih dahulu pada panel Koneksi.")
                if engine.baca_pengaturan().get("VOXCPM_MODE") == "clone":
                    engine.simpan_pengaturan({"SUARA": "bawaan", "VOXCPM_MODE": "bawaan"})
                return self._json(engine.mulai_motion(data))
            if path == "/api/pengaturan":
                data = self._body()
                for key in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
                    if str(data.get(key, "")).startswith("••"):
                        data.pop(key)
                engine.simpan_pengaturan(data)
                return self._json({"ok": True, "pengaturan": engine.samarkan(engine.baca_pengaturan())})
            allowed = {"/api/klip", "/api/klip-render", "/api/unggah", "/api/uji-ai", "/api/batal", "/api/wizard-selesai",
                       "/api/pasang-cli", "/api/login-cli", "/api/ollama-tarik"}
            if path not in allowed:
                return self._json({"galat": "Operasi tidak tersedia pada jembatan FlexCut."}, 404)
            return super().do_POST()
        except Exception as error:
            return self._json({"galat": str(error)}, 400)

class LocalHTTPServer(ThreadingHTTPServer):
    request_queue_size = 64

def main():
    try:
        server = LocalHTTPServer((HOST, PORT), Handler)
    except OSError:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/flexcut/health", timeout=2) as response:
                active = json.load(response)
            if active.get("service") != "flexcut-motion":
                raise RuntimeError("Port mesin dipakai aplikasi lain.")
        except Exception as error:
            raise SystemExit(f"Port {PORT} belum tersedia. {error}") from error
        if "--no-browser" not in sys.argv:
            webbrowser.open(f"http://127.0.0.1:{PORT}/app/")
        print("Mesin FlexCut sudah berjalan.", flush=True)
        return
    print(f"FlexCut engine {'(mode server) ' if REMOTE else ''}http://{HOST}:{PORT}/app/", flush=True)
    print(CREDIT, flush=True)
    if "--no-browser" not in sys.argv and not REMOTE:
        webbrowser.open(f"http://127.0.0.1:{PORT}/app/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        engine.KERJA.batal()
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
