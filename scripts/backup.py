"""Create, download and validate a consistent private PocketBase backup.

Credentials are accepted only from the process environment. Downloaded business
data belongs in private temporary storage. Only authenticated encrypted snapshots
may be retained as CI artifacts in an explicitly private repository. Optional
restore verification runs only on an isolated local copy.
"""
from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
import zipfile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', type=Path, help='Keep the verified ZIP at this private path.')
    parser.add_argument('--encrypted-output', type=Path,
                        help='Keep only an authenticated, roundtrip-verified encrypted snapshot here.')
    parser.add_argument('--restore-test-binary', type=Path,
                        help='Run the accounting restore contract against this PocketBase executable.')
    args = parser.parse_args()
    base = os.environ.get('POCKETBASE_URL', 'https://al-salam-sys.fly.dev').rstrip('/')
    email = os.environ.get('PB_BACKUP_EMAIL', '')
    password = os.environ.get('PB_BACKUP_PASSWORD', '')
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.query or parsed.fragment or not email or not password:
        raise SystemExit('HTTPS POCKETBASE_URL and PB_BACKUP_EMAIL/PB_BACKUP_PASSWORD secrets are required.')
    if args.download and args.download.exists():
        raise SystemExit('Download target already exists; choose a new private path.')
    if args.encrypted_output:
        from backup_crypto import recovery_key, transform
        encryption_key = recovery_key()
        settings_key = os.environ.get('PB_SETTINGS_ENCRYPTION_KEY', '')
        if len(settings_key) != 32:
            raise SystemExit('PB_SETTINGS_ENCRYPTION_KEY must contain the original 32-character settings key.')
        if args.encrypted_output.exists():
            raise SystemExit('Encrypted destination already exists; choose a new path.')
    root = Path(__file__).resolve().parents[1]
    verifier = root / 'tool/backend/verify_backend.py'
    if args.restore_test_binary and (not args.restore_test_binary.is_file() or not verifier.is_file()):
        raise SystemExit('A PocketBase binary and tool/backend/verify_backend.py are required for restore testing.')

    def request(path: str, method: str = 'GET', data=None, token: str = ''):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = token
        body = None if data is None else json.dumps(data).encode()
        try:
            with urlopen(Request(base + path, body, headers, method=method), timeout=120) as response:
                payload = response.read()
                return json.loads(payload) if payload else None
        except HTTPError as error:
            # Do not include response bodies, request URLs with file tokens, or secrets.
            raise RuntimeError(f'PocketBase backup request failed (HTTP {error.code}).') from None

    auth = request('/api/collections/_superusers/auth-with-password', 'POST', {'identity': email, 'password': password})
    token = auth['token']
    recovery_settings = request('/api/settings', token=token) if args.encrypted_output else None
    recovery_collections = request('/api/collections?perPage=500', token=token)['items'] if args.encrypted_output else None
    name = 'scheduled_' + datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S') + '.zip'
    request('/api/backups', 'POST', {'name': name}, token)
    for _ in range(60):
        backups = request('/api/backups', token=token)
        backup = next((item for item in backups if item['key'] == name and item['size'] > 0), None)
        if backup:
            break
        time.sleep(5)
    else:
        raise SystemExit('Backup was requested but did not finish within five minutes.')

    file_token = request('/api/files/token', 'POST', {}, token)['token']
    download_url = base + '/api/backups/' + quote(name, safe='') + '?token=' + quote(file_token, safe='')
    digest = hashlib.sha256()
    downloaded = 0
    with tempfile.TemporaryDirectory(prefix='pocketbase-private-backup-') as directory:
        private = Path(directory)
        archive = private / name
        try:
            with urlopen(download_url, timeout=120) as response, archive.open('xb') as destination:
                archive.chmod(0o600)
                while chunk := response.read(1024 * 1024):
                    destination.write(chunk)
                    digest.update(chunk)
                    downloaded += len(chunk)
        except HTTPError as error:
            raise RuntimeError(f'PocketBase backup download failed (HTTP {error.code}).') from None
        if downloaded != backup['size']:
            raise RuntimeError('Downloaded backup size does not match the server metadata.')
        with zipfile.ZipFile(archive) as zipped:
            if zipped.testzip() is not None or 'data.db' not in zipped.namelist():
                raise RuntimeError('The downloaded backup failed ZIP/database validation.')
            # Read only this known member; no archive paths are extracted.
            database = private / 'data.db'
            with zipped.open('data.db') as source, database.open('xb') as destination:
                database.chmod(0o600)
                shutil.copyfileobj(source, destination)
        with closing(sqlite3.connect(database)) as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('The downloaded database failed its SQLite integrity check.')
            if db.execute('PRAGMA foreign_key_check').fetchall():
                raise RuntimeError('The downloaded database has broken foreign keys.')
            names = [row[0] for row in db.execute("SELECT name FROM _collections WHERE type IN ('base','auth') AND system=0")]
            counts = {name: db.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]
                      for name in names}
        restore_archive = archive
        if args.encrypted_output:
            recovery_bundle = private / 'recovery-bundle.zip'
            manifest = {'format': 1, 'backend': base, 'backup_name': name, 'counts': counts,
                        'backup_sha256': digest.hexdigest(), 'settings': recovery_settings,
                        'collections': recovery_collections}
            with zipfile.ZipFile(recovery_bundle, 'x', compression=zipfile.ZIP_STORED) as bundle:
                bundle.write(archive, 'pocketbase.zip')
                bundle.writestr('settings-encryption.key', settings_key)
                bundle.writestr('manifest.json', json.dumps(manifest))
            encrypted = private / 'production-backup.cob'
            decrypted = private / 'recovered-bundle.zip'
            transform(recovery_bundle, encrypted, encryption_key)
            transform(encrypted, decrypted, encryption_key, decrypt=True)
            with decrypted.open('rb') as recovered, recovery_bundle.open('rb') as original:
                if hashlib.file_digest(recovered, 'sha256').digest() != hashlib.file_digest(original, 'sha256').digest():
                    raise RuntimeError('Encrypted backup recovery checksum does not match the original.')
            restore_archive = private / 'recovered-pocketbase.zip'
            with zipfile.ZipFile(decrypted) as bundle, bundle.open('pocketbase.zip') as source, restore_archive.open('xb') as destination:
                shutil.copyfileobj(source, destination)
            if args.restore_test_binary:
                import sys
                subprocess.run([sys.executable, str(root / 'tool/backend/verify_recovery.py'),
                                '--binary', str(args.restore_test_binary.resolve()), '--bundle', str(decrypted)], check=True)
        if args.restore_test_binary:
            # The verifier creates a separate disposable database, never writes to
            # production, and removes its generated users/transactions with that copy.
            import sys
            subprocess.run([sys.executable, str(verifier), '--binary', str(args.restore_test_binary.resolve()),
                            '--backup', str(restore_archive)], check=True)
        if args.encrypted_output:
            args.encrypted_output.parent.mkdir(parents=True, exist_ok=True)
            with encrypted.open('rb') as source, args.encrypted_output.open('xb') as destination:
                args.encrypted_output.chmod(0o600)
                shutil.copyfileobj(source, destination)
            print('Encrypted snapshot authenticated, decrypted and checksum-verified before retention.')
        if args.download:
            args.download.parent.mkdir(parents=True, exist_ok=True)
            with archive.open('rb') as source, args.download.open('xb') as destination:
                args.download.chmod(0o600)
                shutil.copyfileobj(source, destination)
    print(f'Consistent backup downloaded and verified: {name} ({downloaded} bytes).')
    print('SHA256: ' + digest.hexdigest())
    # Rotate only successful workflow snapshots, after verification. Manual and
    # pre-upgrade backups are always preserved, as are all backups after a failure.
    scheduled = sorted((item for item in backups if item['key'].startswith('scheduled_')),
                       key=lambda item: item['key'], reverse=True)
    for old in scheduled[30:]:
        request('/api/backups/' + quote(old['key'], safe=''), 'DELETE', token=token)


if __name__ == '__main__':
    main()
