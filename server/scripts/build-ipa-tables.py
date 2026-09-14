#!/usr/bin/env python3
"""Build gzipped IPA lookup tables from open-dict-data/ipa-dict dumps in /tmp/harmonix-ipa."""
from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "constants" / "ipa"
SRC = Path("/tmp/harmonix-ipa")
WORD_RE = re.compile(r"^[a-z']{2,18}$")


def load_ipa(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if "\t" not in line:
                continue
            word, rest = line.split("\t", 1)
            word = word.strip().lower().replace("’", "'")
            first = rest.split(",")[0].strip()
            if not first:
                continue
            if not first.startswith("/"):
                first = "/" + first.strip("/") + "/"
            out.setdefault(word, first)
    return out


def dump_gz(obj: dict[str, str], dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    dest.write_bytes(gzip.compress(raw, 9))
    print(f"{dest.name}: {len(obj)} entries, {dest.stat().st_size} bytes gzip")


def tokens_from_values(values) -> set[str]:
    found: set[str] = set()
    for value in values:
        found.update(re.findall(r"[a-záéíóúüñ]+", str(value).lower()))
    return found


def main() -> None:
    en = {
        word: ipa
        for word, ipa in load_ipa(SRC / "en_US.txt").items()
        if WORD_RE.match(word)
    }
    dump_gz(en, OUT / "en.json.gz")
    if "younger" not in en:
        raise SystemExit("english IPA table missing 'younger'")

    gloss = json.loads((ROOT / "constants" / "enEsGloss.json").read_text())
    edict = json.loads((ROOT / "constants" / "enEsDict.json").read_text())
    need_es = tokens_from_values(list(gloss.values()) + list(edict.values()))
    need_es.update(
        """
        luz amor noche dia día vida tiempo fuego corazón corazon esperanza
        quiero llama llamas pendiente iman imán entero vaiven vaivén llora
        dame despues después solté solte quedamos casa agua cielo tierra
        lluvia beso dolor alma cuerpo mujer hombre niña nina niño nino
        canción cancion joven jóvenes
        """.split()
    )
    es = load_ipa(SRC / "es_ES.txt")
    dump_gz({w: es[w] for w in need_es if w in es}, OUT / "es.json.gz")

    extras = {
        "fr": (SRC / "fr_FR.txt", "amour nuit jour vie temps lumiere lumière feu coeur cœur espoir"),
        "de": (SRC / "de.txt", "liebe nacht tag leben zeit licht feuer herz hoffnung"),
        "pt": (SRC / "pt_BR.txt", "amor noite dia vida tempo luz fogo coração coracao esperança esperanca"),
    }
    for lang, (path, extra) in extras.items():
        table = load_ipa(path)
        need = set(extra.split())
        dump_gz({w: table[w] for w in need if w in table}, OUT / f"{lang}.json.gz")


if __name__ == "__main__":
    main()
