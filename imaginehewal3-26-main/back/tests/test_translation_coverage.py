"""Every text the server sends to the Explore screens must have a translation row in the app, or French and Arabic readers see English there.
Adding a challenge, group or article to the server without adding its row to front-sdk58/i18n/phrases/server.ts fails this test."""
import os
import re

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

HERE = os.path.dirname(__file__)
ROWS = os.path.join(HERE, "..", "..", "front-sdk58", "i18n", "phrases")


def _table_text() -> str:
    parts = []
    for f in os.listdir(ROWS):
        if f.endswith(".ts") and f not in ("index.ts", "tw.ts"):
            parts.append(open(os.path.join(ROWS, f), encoding="utf-8").read())
    return "\n".join(parts)


def _has(text: str, s: str) -> bool:
    return any(v in text for v in (f"'{s}'", "'" + s.replace("'", "\'") + "'", f'"{s}"'))


def test_every_server_text_has_a_translation_row():
    from app.services import library_content as lib
    from app.services import wellbeing_hub as wh
    text = _table_text()
    needed = []
    for c in wh.CHALLENGES.values():
        needed += [c["title"], c["tagline"], c["about"], c["domain"]]
    for g in wh.GROUPS.values():
        needed += [g["title"], g["about"]]
    needed += list(wh.LABELS.values()) + list(wh.HOW.values()) + list(lib.CATEGORIES.values()) + [lib.NOTICE]
    for a in lib.ARTICLES:
        needed += [a["title"], a["summary"]] + list(a["body"])
    src = open(os.path.join(HERE, "..", "app", "services", "wellbeing_hub.py"), encoding="utf-8").read()
    needed += re.findall(r'"(?:note|method|message)":\s*"([^"]+)"', src)
    missing = [s for s in dict.fromkeys(needed) if s and not _has(text, s)]
    assert missing == [], f"{len(missing)} server texts have no translation row, first: {missing[:3]}"


def _texts_in_guidance() -> list:
    """Every title, message and action written in build_personalized_guidance (f-string holes become {0}, {1}...)."""
    import ast
    tree = ast.parse(open(os.path.join(HERE, "..", "app", "routers", "health.py"), encoding="utf-8").read())
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "build_personalized_guidance")
    out = []

    def template(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.JoinedStr):
            n, parts = 0, []
            for v in node.values:
                if isinstance(v, ast.Constant):
                    parts.append(v.value)
                else:
                    parts.append("{%d}" % n); n += 1
            return "".join(parts)
        return None

    for call in (c for c in ast.walk(fn) if isinstance(c, ast.Call)):
        for kw in call.keywords:
            if kw.arg in ("title", "message", "action"):
                def visit(node):
                    t = template(node)
                    if t is not None:                          # a string, or a whole f-string: one phrase, never its fragments
                        if len(t) > 3 and " " in t:
                            out.append(t)
                        return
                    for child in ast.iter_child_nodes(node):
                        visit(child)
                visit(kw.value)
    return out


def test_every_alert_and_recommendation_and_tip_has_a_translation_row():
    from app.routers.food_analysis import TIP_FALLBACKS
    text = _table_text()
    needed = _texts_in_guidance() + list(TIP_FALLBACKS)
    assert len(needed) > 20                                       # the extraction really found the texts
    missing = [s for s in dict.fromkeys(needed) if not _has(text, s)]
    assert missing == [], f"{len(missing)} texts have no translation row, first: {missing[:3]}"


def test_the_account_messages_the_server_sends_have_translation_rows():
    from app.routers import auth
    from app.services import auth_mail
    text = _table_text()
    needed = [auth.GENERIC_RESET, auth.GENERIC_VERIFY, auth.GENERIC_OTP, auth_mail.TOO_MANY, "That code is wrong or has expired", "Too many wrong codes. Please ask for a new code.",
              "Your current password is not correct", "Choose a password that is different from your current one", "Invalid or expired code",
              "Invalid or expired reset token", "Invalid or expired verification token", "Password reset successfully", "Password changed successfully", "Email verified successfully"]
    missing = [s for s in needed if not _has(text, s)]
    assert missing == [], missing
