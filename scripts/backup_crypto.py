"""Authenticated streaming encryption for private PocketBase recovery snapshots.

Uses PyCA's standard Cobblestone-128 format (C2SP chunked encryption), with a
random recovery key and application context. No plaintext is published until
decryption has authenticated the complete stream, including its final chunk.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import os
from pathlib import Path
import shutil
import tempfile

from cryptography.cobblestone import Cobblestone128Decryptor, Cobblestone128Encryptor

CONTEXT = b'Al-Salam Accounting PocketBase backup v1'


def recovery_key() -> bytes:
    try:
        key = base64.b64decode(os.environ.get('PB_BACKUP_ENCRYPTION_KEY', ''), validate=True)
    except binascii.Error:
        raise ValueError('PB_BACKUP_ENCRYPTION_KEY must contain a valid base64 recovery key.') from None
    if len(key) != 16:
        raise ValueError('PB_BACKUP_ENCRYPTION_KEY must encode a 16-byte random recovery key.')
    return key


def transform(source: Path, destination: Path, key: bytes, *, decrypt: bool = False) -> None:
    if destination.exists():
        raise FileExistsError('Choose a new destination; existing recovery files are preserved.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    operation = (Cobblestone128Decryptor if decrypt else Cobblestone128Encryptor)(key, context=CONTEXT)
    with tempfile.TemporaryDirectory(prefix='.private-backup-', dir=destination.parent) as directory:
        staged = Path(directory) / 'verified-output'
        with source.open('rb') as input_file, staged.open('xb') as output:
            staged.chmod(0o600)
            while block := input_file.read(1024 * 1024):
                output.write(operation.update(block))
            # Mandatory: rejects truncation or tampering before the output becomes
            # available at the requested path or can be uploaded/restored.
            output.write(operation.finalize())
        with staged.open('rb') as input_file, destination.open('xb') as output:
            destination.chmod(0o600)
            shutil.copyfileobj(input_file, output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['encrypt', 'decrypt'])
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    transform(args.source, args.destination, recovery_key(), decrypt=args.operation == 'decrypt')
    print('Authenticated backup ' + args.operation + 'ion completed.')


if __name__ == '__main__':
    main()
