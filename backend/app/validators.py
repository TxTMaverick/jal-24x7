"""Input sanitisation shared by the Pydantic schemas.

The threat this closes: a customer types a name, address or message that
contains HTML or a script tag, it gets stored, and it later renders in the
admin dashboard or the vendor panel. React escapes text nodes so it would not
execute, but storing hostile input at all is bad practice, and the data also
flows into places React does not control (server logs, a future CSV export,
an email template).

So we normalise on the way in: strip tags and control characters, collapse
whitespace, and cap length. Text comes out clean and consistently cased.
"""

from __future__ import annotations

import re
import unicodedata

# Remove script/style blocks *including their contents*. Stripping only the
# tags would leave the payload behind as visible text.
_SCRIPT_BLOCK = re.compile(
    r"<\s*(script|style|iframe|object|embed)\b[^>]*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)
_ORPHAN_BLOCK = re.compile(
    r"<\s*(script|style|iframe|object|embed)\b[^>]*>.*", re.IGNORECASE | re.DOTALL
)
_TAG = re.compile(r"<[^>]*>")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE = re.compile(r"\s+")

# Things that only ever appear in an injection attempt, never in an address.
_DANGEROUS = re.compile(
    r"(javascript:|data:text/html|vbscript:|on\w+\s*=|<\s*script|&#x?[0-9a-f]+;?\s*script)",
    re.IGNORECASE,
)

# Words that should keep their capitalisation in a title-cased name.
_KEEP_UPPER = {
    "rwa", "pg", "ro", "uv", "isi", "fssai", "bis", "upi", "gst", "kyc",
    "ii", "iii", "iv", "hig", "lig", "mig", "gpo", "id",
}
_KEEP_LOWER = {"and", "of", "the", "near", "opp", "at", "in", "on", "to"}


def clean_text(value: str, *, max_length: int = 500) -> str:
    """Strip markup and control characters, collapse whitespace, trim."""
    if not value:
        return ""

    # Normalise unicode so look-alike characters cannot smuggle anything past us.
    text = unicodedata.normalize("NFKC", str(value))
    text = _CONTROL.sub("", text)
    text = _SCRIPT_BLOCK.sub(" ", text)
    text = _ORPHAN_BLOCK.sub(" ", text)
    text = _TAG.sub(" ", text)
    text = _DANGEROUS.sub("", text)
    text = _WHITESPACE.sub(" ", text).strip()
    return text[:max_length]


def _title_case(text: str) -> str:
    """Capitalise words sensibly, respecting acronyms and small words."""
    if not text:
        return ""
    words: list[str] = []
    for index, raw in enumerate(text.split(" ")):
        lower = raw.lower().strip(".,")
        if lower in _KEEP_UPPER:
            words.append(raw.upper())
        elif lower in _KEEP_LOWER and index > 0:
            words.append(lower)
        elif raw.isupper() and len(raw) > 3:
            # Shouty input: "TEJAS" becomes "Tejas".
            words.append(raw.capitalize())
        elif raw and raw[0].islower():
            words.append(raw[0].upper() + raw[1:])
        else:
            words.append(raw)
    return " ".join(words)


def clean_name(value: str, *, max_length: int = 120) -> str:
    """Sanitise then title-case a person, society or business name.

    "  tejas   TRIPATHI " becomes "Tejas Tripathi".
    "silver springs rwa" becomes "Silver Springs RWA".
    An already well-formed name such as "McKinsey" is left alone.
    """
    return _title_case(clean_text(value, max_length=max_length))


def clean_address(value: str, *, max_length: int = 255) -> str:
    """Sanitise an address, tidy its punctuation, and title-case it.

    "  12 ,, scheme  no. 54 , vijay nagar " becomes
    "12, Scheme No. 54, Vijay Nagar".
    """
    text = clean_text(value, max_length=max_length)
    # Drop empty comma-separated segments, then rebuild with clean spacing.
    segments = [seg.strip(" -") for seg in text.split(",")]
    segments = [seg for seg in segments if seg]
    text = ", ".join(segments)
    text = re.sub(r"\s*-\s*", "-", text)
    text = _WHITESPACE.sub(" ", text).strip(" ,-")
    return _title_case(text)


def clean_multiline(value: str, *, max_length: int = 2000) -> str:
    """Same as `clean_text` but keeps paragraph breaks (for messages)."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = _CONTROL.sub("", text)
    text = _SCRIPT_BLOCK.sub(" ", text)
    text = _ORPHAN_BLOCK.sub(" ", text)
    text = _TAG.sub(" ", text)
    text = _DANGEROUS.sub("", text)
    # Collapse runs of blank lines to one, and spaces within a line.
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines()]
    out: list[str] = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip()[:max_length]


def clean_pincode(value: str) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[:6]
