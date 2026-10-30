"""Text clean-up shared by every source."""

import re

SMALL_WORDS = {"of", "and", "the", "for", "in", "on", "to", "a"}
HEADER = re.compile(
    r"^(\d+\.\s*)?(project\s+)?(summary|abstract|narrative|description|public health relevance)\b[^.]{0,40}$",
    re.IGNORECASE,
)


def title_case(text: str, small_words: bool = True) -> str:
    words = text.lower().split()
    out = []
    for i, word in enumerate(words):
        if small_words and i > 0 and word in SMALL_WORDS:
            out.append(word)
            continue
        word = word.title()
        if word.startswith("Mc") and len(word) > 2:
            word = "Mc" + word[2:].capitalize()
        out.append(word)
    return " ".join(out)


def paragraphs(text: str | None) -> list[str]:
    """Undo hard line wrapping and drop a leading 'PROJECT SUMMARY'-style header."""
    if not text:
        return []
    lines = [line.strip() for line in text.replace("\r", "").split("\n")]
    while lines and (not lines[0] or HEADER.match(lines[0])):
        lines.pop(0)
    if not lines:
        return []

    wrap_width = max(len(line) for line in lines)
    paras: list[list[str]] = [[]]
    for line in lines:
        if not line:
            paras.append([])
            continue
        paras[-1].append(line)
        # A short line ending a sentence marks the end of a paragraph.
        if line[-1] in ".!?:" and len(line) < 0.7 * wrap_width:
            paras.append([])
    return [re.sub(r"\s+", " ", " ".join(p)) for p in paras if p]


def first_sentences(text: str, max_len: int = 320) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    out = ""
    for sentence in sentences:
        if out and len(out) + len(sentence) > max_len:
            break
        out = f"{out} {sentence}".strip()
    return out if len(out) <= max_len else out[: max_len - 1].rsplit(" ", 1)[0] + "…"


def name_key(name: str) -> str:
    """Identity key for matching one person across sources: first and last name, letters only."""
    parts = [re.sub(r"[^a-z]", "", p) for p in name.lower().split()]
    parts = [p for p in parts if p]
    return f"{parts[0]} {parts[-1]}" if parts else ""
