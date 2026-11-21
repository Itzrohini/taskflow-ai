import os
import re
import ssl
import sys
from importlib.metadata import PackageNotFoundError, version
from urllib.parse import parse_qsl, urlsplit

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.config import get_settings

_SENSITIVE_OPTION_PARTS = ("password", "passwd", "token", "secret", "credential")
_MONGODB_URI_PATTERN = re.compile(r"mongodb(?:\+srv)?://[^\s\"'<>]+", re.IGNORECASE)


def _redact_uri(value: str) -> str:
    return _MONGODB_URI_PATTERN.sub("[REDACTED_MONGODB_URI]", value)


def _parse_uri(value: str) -> tuple[str, str, dict[str, str], bool, bool]:
    trimmed = value.strip()
    has_whitespace = value != trimmed
    has_quotes = len(trimmed) >= 2 and trimmed[0] == trimmed[-1] and trimmed[0] in "\"'"
    normalized = trimmed[1:-1] if has_quotes else trimmed
    parsed = urlsplit(normalized)
    netloc = parsed.netloc.rsplit("@", 1)[-1]
    options = dict(parse_qsl(parsed.query, keep_blank_values=True))
    return (
        parsed.scheme or "(unparseable)",
        netloc or "(unknown)",
        options,
        has_whitespace,
        has_quotes,
    )


def _display_options(options: dict[str, str]) -> dict[str, str]:
    return {
        key: (
            "[REDACTED]"
            if any(part in key.lower() for part in _SENSITIVE_OPTION_PARTS)
            else value
        )
        for key, value in sorted(options.items())
    }


def _windows_registry_uri_sources() -> tuple[bool, bool] | None:
    if sys.platform != "win32":
        return None

    import winreg

    sources = (
        (winreg.HKEY_CURRENT_USER, "Environment"),
        (
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
        ),
    )
    configured = []
    for root, path in sources:
        try:
            with winreg.OpenKey(root, path) as key:
                winreg.QueryValueEx(key, "MONGODB_URI")
            configured.append(True)
        except FileNotFoundError:
            configured.append(False)
    return configured[0], configured[1]


def _ping(label: str, uri: str, appname: str) -> None:
    if not uri:
        print(f"{label} ping: FAIL (URI is not configured)")
        return

    client = None
    try:
        client = MongoClient(
            uri,
            tz_aware=True,
            serverSelectionTimeoutMS=10_000,
            appname=appname,
        )
        client.admin.command("ping")
        print(f"{label} ping: PASS")
    except PyMongoError as exc:
        print(f"{label} ping: FAIL ({type(exc).__name__})")
        print(f"  {_redact_uri(str(exc))[:500]}")
    finally:
        if client is not None:
            client.close()


def main() -> None:
    had_process_uri = "MONGODB_URI" in os.environ
    load_dotenv(override=False)
    raw_env_uri = os.getenv("MONGODB_URI", "")
    settings_uri = get_settings().MONGODB_URI

    print(f"Python: {sys.version.split()[0]}")
    print(f"PyMongo: {version('pymongo')}")
    try:
        certifi_version = version("certifi")
    except PackageNotFoundError:
        certifi_version = "not installed"
    print(f"certifi: {certifi_version} ({certifi.where()})")
    print(f"OpenSSL: {ssl.OPENSSL_VERSION}")
    print("Pydantic settings precedence: process environment overrides backend/.env")
    print(
        f"MONGODB_URI existed in process environment before dotenv: {had_process_uri}"
    )

    registry_sources = _windows_registry_uri_sources()
    if registry_sources is not None:
        print(f"Windows user MONGODB_URI configured: {registry_sources[0]}")
        print(f"Windows system MONGODB_URI configured: {registry_sources[1]}")

    if not raw_env_uri:
        print("Raw environment URI: not configured")
    if not settings_uri:
        print("Settings URI: not configured")

    raw_scheme, raw_host, raw_options, raw_whitespace, raw_quotes = _parse_uri(
        raw_env_uri
    )
    (
        settings_scheme,
        settings_host,
        settings_options,
        settings_whitespace,
        settings_quotes,
    ) = _parse_uri(settings_uri)
    print(
        "Raw environment URI: "
        f"scheme={raw_scheme}, host={raw_host}, "
        f"query_options={_display_options(raw_options)}, "
        f"surrounding_whitespace={raw_whitespace}, quoted={raw_quotes}"
    )
    print(
        "Settings URI: "
        f"scheme={settings_scheme}, host={settings_host}, "
        f"query_options={_display_options(settings_options)}, "
        f"surrounding_whitespace={settings_whitespace}, quoted={settings_quotes}"
    )
    print(f"URI values match exactly: {raw_env_uri == settings_uri}")
    print(f"URI hosts match: {raw_host == settings_host}")
    print(f"URI query options match: {raw_options == settings_options}")

    _ping("Raw environment", raw_env_uri, "taskflow-ai-mongo-diag-env")
    _ping("Settings", settings_uri, "taskflow-ai-mongo-diag-settings")


if __name__ == "__main__":
    main()
