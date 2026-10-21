"""UUIDv7 (RFC 9562) generation — time-ordered IDs for offline field records.

UUIDv7 layout: 48-bit unix-ms timestamp | ver 7 | 12-bit rand_a | var | 62-bit rand_b.
Sortable by creation time, which makes offline sync ordering deterministic.
"""
import secrets
import time
import uuid


def uuid7() -> uuid.UUID:
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)
    value = (ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    return uuid.UUID(int=value)


def uuid7_hex() -> str:
    return str(uuid7())
