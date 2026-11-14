"""One place that talks to Google Gemini. The assistant, meal analysis, weekly insights and the clinician brief all use it.

Why it is built this way:
  * FAST: a "lite" model (about 1.5 s to the first word; the full flash models spend 15+ s thinking first), a pooled keep-alive
    connection, short outputs, and streaming so words appear while the rest is still being written.
  * SAFE: the key is read from the environment only and never logged or sent to the app. Every call has a timeout. Failures raise
    GeminiError so callers can fall back; nothing here ever hangs a request.
  * Either key name works: GEMINI_API or GEMINI_API_KEY. The model is GEMINI_MODEL (default gemini-flash-lite-latest).
"""
import base64
import json
import logging
import os
import re
import threading
import time
from typing import Any, Dict, Iterator, List, Optional

import requests
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}"
DEFAULT_MODEL = "gemini-flash-lite-latest"


class GeminiError(Exception):
    """The model could not be reached or refused. Callers fall back to something simpler."""


def api_key() -> str:
    return os.getenv("GEMINI_API") or os.getenv("GEMINI_API_KEY") or ""


def available() -> bool:
    return bool(api_key()) and os.getenv("AI_PROVIDER", "auto").lower() != "off"


def model_name() -> str:
    return os.getenv("GEMINI_MODEL") or DEFAULT_MODEL


_session = requests.Session()
_session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=16))
_gate = threading.BoundedSemaphore(int(os.getenv("GEMINI_MAX_CONCURRENT", "12")))      # a burst cannot exhaust the free quota in a second


def text_content(role: str, text: str) -> Dict[str, Any]:
    return {"role": "model" if role in ("assistant", "model") else "user", "parts": [{"text": text}]}


def image_part(data: bytes, mime: str) -> Dict[str, Any]:
    return {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}


def _body(system: Optional[str], contents: List[dict], temperature: float, max_tokens: int, json_mode: bool) -> dict:
    cfg: Dict[str, Any] = {"temperature": temperature, "maxOutputTokens": max_tokens}
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    body: Dict[str, Any] = {"contents": contents, "generationConfig": cfg}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    return body


def _fail(resp: requests.Response) -> GeminiError:
    reason = " ".join(resp.text[:200].split())
    logger.warning("Gemini HTTP %s: %s", resp.status_code, reason)             # says why (retired model, bad key, quota); never the key
    return GeminiError(f"HTTP {resp.status_code}")


def generate(system: Optional[str], contents: List[dict], *, temperature: float = 0.4, max_tokens: int = 700,
             json_mode: bool = False, timeout: float = 25.0) -> str:
    """One complete answer. One retry on a rate limit or a server error."""
    if not available():
        raise GeminiError("not configured")
    url = URL.format(model=model_name(), method="generateContent")
    last: Optional[Exception] = None
    for attempt in (1, 2):
        try:
            with _gate:
                r = _session.post(url, json=_body(system, contents, temperature, max_tokens, json_mode),
                                  headers={"x-goog-api-key": api_key()}, timeout=timeout)
            if r.status_code in (429, 500, 502, 503) and attempt == 1:
                time.sleep(0.8)
                continue
            if r.status_code >= 400:
                raise _fail(r)
            data = r.json()
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts).strip()
        except GeminiError:
            raise
        except (requests.RequestException, KeyError, IndexError, ValueError) as e:
            last = e
            if attempt == 1 and isinstance(e, requests.ConnectionError):
                time.sleep(0.4)
                continue
            break
    raise GeminiError(type(last).__name__ if last else "failed")


def stream(system: Optional[str], contents: List[dict], *, temperature: float = 0.5, max_tokens: int = 900,
           timeout: float = 30.0) -> Iterator[str]:
    """Yields text as it is written. Raises GeminiError if it cannot start; once words have flowed, an interruption just ends it."""
    if not available():
        raise GeminiError("not configured")
    url = URL.format(model=model_name(), method="streamGenerateContent") + "?alt=sse"
    started = False
    with _gate:
        try:
            r = _session.post(url, json=_body(system, contents, temperature, max_tokens, False),
                              headers={"x-goog-api-key": api_key()}, timeout=(8, timeout), stream=True)
        except requests.RequestException as e:
            raise GeminiError(type(e).__name__)
        try:
            if r.status_code >= 400:
                raise _fail(r)
            for raw in r.iter_lines(decode_unicode=True):
                if not raw or not raw.startswith("data:"):
                    continue
                try:
                    chunk = json.loads(raw[5:].strip())
                    delta = "".join(p.get("text", "") for p in chunk["candidates"][0]["content"]["parts"])
                except (ValueError, KeyError, IndexError):
                    continue
                if delta:
                    started = True
                    yield delta
        except requests.RequestException as e:
            if not started:
                raise GeminiError(type(e).__name__)
            logger.info("Gemini stream ended early: %s", type(e).__name__)
        finally:
            r.close()


def parse_json(text: str) -> Any:
    """The model's JSON, tolerant of code fences and stray words around it."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except ValueError:
        m = re.search(r"(\{.*\}|\[.*\])", t, re.S)
        if m:
            return json.loads(m.group(1))
        raise
