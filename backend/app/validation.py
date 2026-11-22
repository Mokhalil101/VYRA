import ipaddress
import re
import socket
from urllib.parse import urlparse

BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "169.254.169.254"}


def validate_public_url(url: str) -> str:
    """Reject non-http(s), localhost, private/reserved IPs and metadata hosts (SSRF)."""
    url = url.strip()
    if len(url) > 2048:
        raise ValueError("URL is too long.")
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ValueError("Enter a valid http(s) URL.")
    host = p.hostname.lower()
    if host in BLOCKED_HOSTS or host.endswith(".local") or host.endswith(".internal"):
        raise ValueError("This address is not allowed.")
    try:
        infos = socket.getaddrinfo(host, p.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ValueError("Could not resolve this address.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ValueError("This address is not allowed.")
    return url


_TIME = re.compile(r"^\d+(\.\d+)?$|^\d{1,3}:[0-5]?\d(:[0-5]?\d)?$")


def parse_time(value: str) -> float:
    """Accepts seconds, MM:SS or HH:MM:SS. Rejects negatives and bad formats."""
    v = value.strip()
    if not _TIME.match(v):
        raise ValueError(f"Invalid time '{value}'. Use seconds, MM:SS or HH:MM:SS.")
    if ":" not in v:
        return float(v)
    parts = [int(x) for x in v.split(":")]
    secs = 0
    for x in parts:
        secs = secs * 60 + x
    return float(secs)
