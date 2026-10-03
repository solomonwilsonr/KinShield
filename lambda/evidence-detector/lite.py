"""KinShield-Lite: the experimental kinshield-tiny classifier, scored in pure Python.

Loads the int8 export (lite_model.json, built by kinshield-tiny/scripts) and re-implements the
two sklearn TfidfVectorizer analyzers it was trained with (word 1-2 grams, char_wb 3-5 grams),
so the Lambda needs no numpy or scikit-learn. Parity with kinshield_tiny.model.Int8Model is
checked by kinshield-tiny/tests/test_lite_parity.py.

This is a keyword-style second opinion only. The LLM detector's verdict always takes precedence.
"""

import json
import math
import os
import re

_PATH = os.path.join(os.path.dirname(__file__), "lite_model.json")
_model = None

_TOKEN = re.compile(r"(?u)\b\w\w+\b")  # sklearn's default token_pattern
_WHITE = re.compile(r"\s\s+")


def _load():
    global _model
    if _model is None:
        with open(_PATH, "r", encoding="utf-8") as f:
            _model = json.load(f)
    return _model


def _word_ngrams(text, lo, hi):
    tokens = _TOKEN.findall(text.lower())
    if hi == 1:
        return tokens
    out = list(tokens) if lo == 1 else []
    n_tok = len(tokens)
    for n in range(max(lo, 2), min(hi, n_tok) + 1):
        for i in range(n_tok - n + 1):
            out.append(" ".join(tokens[i : i + n]))
    return out


def _char_wb_ngrams(text, lo, hi):
    text = _WHITE.sub(" ", text.lower())
    out = []
    for w in text.split():
        w = " " + w + " "
        w_len = len(w)
        for n in range(lo, hi + 1):
            offset = 0
            out.append(w[offset : offset + n])
            while offset + n < w_len:
                offset += 1
                out.append(w[offset : offset + n])
            if offset == 0:  # word shorter than n
                break
    return out


def _block(grams, vocab, idf, offset):
    counts = {}
    for g in grams:
        i = vocab.get(g)
        if i is not None:
            counts[i] = counts.get(i, 0) + 1
    vals = {i: (1 + math.log(c)) * idf[i] for i, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in vals.values()))
    if norm > 0:
        vals = {i: v / norm for i, v in vals.items()}
    return {i + offset: v for i, v in vals.items()}


def score(text):
    """Return the calibrated scam-likeness probability (0..1) for a piece of text."""
    m = _load()
    feats = _block(_word_ngrams(text, *m["word_ngram"]), m["word_vocab"], m["word_idf"], 0)
    feats.update(
        _block(_char_wb_ngrams(text, *m["char_ngram"]), m["char_vocab"], m["char_idf"], m["char_offset"])
    )
    w = m["w_int8"]
    raw = sum(v * w[i] for i, v in feats.items()) * m["w_scale"] + m["bias"]
    z = m["calib_a"] * raw + m["calib_b"]
    return 1 / (1 + math.exp(-z))
