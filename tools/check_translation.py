"""Compare the module's Polish translation with the shadowrun6-eden English file.

Usage:
    python tools/check_translation.py <path to shadowrun6-eden/lang/en.json>

Lists keys that are missing (new in the system), keys that no longer exist in the system,
and translations whose {placeholders} or HTML tags differ from the English original.
"""
import collections
import json
import pathlib
import re
import sys

PL_FILE = pathlib.Path(__file__).resolve().parent.parent / "lang" / "pl" / "shadowrun6-eden.json"


def flatten(obj, prefix=""):
    out = {}
    for key, value in obj.items():
        if isinstance(value, dict):
            out.update(flatten(value, f"{prefix}{key}."))
        else:
            out[prefix + key] = value
    return out


def tokens(text):
    html = r"</?(?:a|b|br|div|em|i|li|ol|p|span|strong|ul)\b[^>]*>"
    return collections.Counter(re.findall(rf"\{{[^}}]*\}}|{html}|@\w+", text))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    en = flatten(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")))
    pl = flatten(json.loads(PL_FILE.read_text(encoding="utf-8")))

    missing = [k for k in en if k not in pl]
    obsolete = [k for k in pl if k not in en]
    mismatched = [k for k in en if k in pl and tokens(en[k]) != tokens(pl[k])]

    print(f"English keys: {len(en)}, Polish keys: {len(pl)}")
    for title, keys in (("Missing", missing), ("Obsolete", obsolete), ("Placeholder/HTML mismatch", mismatched)):
        print(f"\n{title}: {len(keys)}")
        for key in keys:
            print(f"  {key}: {en.get(key, pl.get(key))!r}")

    sys.exit(1 if missing or mismatched else 0)


if __name__ == "__main__":
    main()
