"""Ghanaian meal database and condition-aware assessment. Local, free, works offline.

Values are APPROXIMATE estimates for one typical serving, based on common West African food composition figures.
They are meant for coaching, not clinical dietary prescription, and the app labels them "estimates".
Add or correct dishes here as the team and clinicians review them; the rest of the app picks changes up automatically.
"""
from typing import Dict, List, Optional

# id, name, also known as, serving, kcal, carbs g, protein g, fat g, fibre g, sodium mg, glycaemic index, tags, healthier swap
_ROWS = [
    ("jollof_rice", "Jollof rice", ["jollof"], "1 plate (about 250 g)", 420, 70, 8, 12, 2, 700, "high", ["rice", "starch"], "Half the rice, add salad or grilled fish."),
    ("waakye", "Waakye", ["waakye with stew"], "1 plate with stew (about 300 g)", 520, 82, 16, 14, 8, 650, "medium", ["rice", "legume", "starch"], "Ask for less rice and more beans, and go easy on shito and stew oil."),
    ("rice_stew", "Rice and tomato stew", ["plain rice and stew"], "1 plate (about 250 g)", 400, 72, 8, 9, 2, 450, "high", ["rice", "starch"], "Smaller rice portion, add vegetables or egg."),
    ("banku_okro", "Banku with okro soup", ["banku and okro", "okro stew"], "1 ball banku with soup (about 400 g)", 430, 80, 12, 6, 6, 500, "high", ["starch", "soup", "veg"], "One smaller ball of banku and extra okro and fish."),
    ("banku_tilapia", "Banku with grilled tilapia", ["banku and tilapia"], "1 ball with fish and pepper (about 450 g)", 650, 90, 38, 14, 5, 650, "medium", ["starch", "protein"], "Smaller banku, add raw salad."),
    ("fufu_light_soup", "Fufu with light soup", ["fufu and light soup"], "1 serving (about 450 g)", 580, 105, 22, 8, 6, 800, "high", ["starch", "soup"], "Smaller fufu portion, more soup with vegetables and fish."),
    ("fufu_groundnut_soup", "Fufu with groundnut soup", ["fufu and nkatenkwan"], "1 serving (about 450 g)", 720, 98, 24, 26, 7, 900, "high", ["starch", "soup", "fatty"], "Choose light soup more often, or halve the fufu."),
    ("kenkey_fish", "Kenkey with fried fish and shito", ["kenkey", "komi"], "1 ball with fish (about 350 g)", 600, 100, 24, 12, 4, 900, "high", ["starch", "protein", "salty"], "Less shito, grilled fish, add tomato and onion salad."),
    ("red_red", "Red red (beans stew with fried plantain)", ["red red", "gob3 stew"], "1 plate (about 300 g)", 560, 78, 17, 20, 15, 480, "medium", ["legume", "fried"], "Bake or air-fry the plantain, use less palm oil."),
    ("kelewele", "Kelewele (spiced fried plantain)", ["fried plantain"], "1 portion (about 100 g)", 250, 40, 2, 10, 3, 120, "medium", ["fried", "sugary"], "Share a portion, or choose boiled plantain."),
    ("yam_kontomire", "Boiled yam with kontomire stew and egg", ["ampesi and kontomire", "yam and palava sauce"], "1 plate (about 400 g)", 480, 85, 12, 12, 7, 450, "medium", ["starch", "veg"], "Smaller yam portion, more kontomire."),
    ("kontomire_stew", "Kontomire stew", ["cocoyam leaf stew", "palava sauce"], "1 serving (about 150 g)", 220, 8, 10, 16, 5, 450, "low", ["veg", "soup"], "Great choice. Use less oil if you can."),
    ("yam_garden_egg", "Boiled yam with garden egg stew", ["yam and garden egg stew"], "1 plate (about 400 g)", 520, 80, 14, 16, 8, 520, "medium", ["starch", "veg"], "Keep the yam portion small and add an egg or fish."),
    ("gob3", "Gob3 (gari and beans)", ["gari and beans", "gari fortor"], "1 plate with plantain (about 350 g)", 650, 105, 18, 16, 14, 450, "high", ["starch", "legume", "fried"], "Less gari, more beans, skip the extra oil."),
    ("gari_soakings", "Gari soakings", ["gari and sugar", "gari and milk"], "1 bowl (about 250 g)", 380, 70, 8, 8, 4, 40, "high", ["starch", "sugary"], "Skip the sugar, add groundnuts for protein."),
    ("hausa_koko_koose", "Hausa koko with koose", ["koko and koose"], "1 bowl and 2 koose (about 350 g)", 420, 60, 12, 14, 5, 300, "medium", ["starch", "fried"], "Less sugar in the koko, one koose instead of two."),
    ("oats", "Oats porridge (no sugar)", ["oatmeal"], "1 bowl (about 300 g)", 220, 36, 8, 4, 5, 80, "low", ["starch", "fibre"], "Top with groundnuts or fruit instead of sugar."),
    ("tom_brown", "Tom brown porridge", ["tom brown"], "1 bowl (about 300 g)", 300, 50, 9, 6, 6, 30, "medium", ["starch"], "Use little or no sugar."),
    ("bread_egg_tea", "Bread, eggs and sweet tea", ["bread and egg", "tea and bread"], "2 slices, 2 eggs, 1 cup tea", 450, 45, 20, 20, 3, 650, "high", ["starch", "protein", "sugary"], "Brown bread, no sugar in the tea."),
    ("grilled_tilapia", "Grilled tilapia", ["tilapia"], "1 fish (about 250 g)", 290, 0, 45, 12, 0, 150, "low", ["protein"], "Great choice. Serve with salad or kontomire."),
    ("fried_chicken", "Fried chicken", ["chicken"], "1 leg and thigh (about 200 g)", 340, 10, 28, 22, 0, 520, "low", ["protein", "fried"], "Grilled or boiled chicken is lighter."),
    ("khebab", "Khebab (grilled meat sticks)", ["kebab", "chichinga"], "4 sticks (about 150 g)", 330, 6, 28, 22, 1, 600, "low", ["protein", "salty"], "Choose leaner cuts and go easy on the spice salt."),
    ("groundnuts", "Roasted groundnuts", ["peanuts"], "1 handful (about 40 g)", 230, 7, 10, 19, 3, 5, "low", ["protein", "fatty"], "A good snack in small amounts."),
    ("fruit_plate", "Fruit plate (pawpaw, pineapple, orange)", ["fruits"], "1 bowl (about 200 g)", 100, 25, 2, 0, 4, 5, "medium", ["veg", "fibre", "sugary"], "Great choice. Eat whole fruit, not juice."),
    ("soft_drink", "Soft drink", ["fanta", "coke", "malta guinness"], "1 bottle (500 ml)", 210, 53, 0, 0, 0, 30, "high", ["sugary"], "Water, or unsweetened sobolo, is a better choice."),
    ("sobolo", "Sobolo (sweetened)", ["zobo", "bissap"], "1 glass (500 ml)", 180, 45, 1, 0, 0, 10, "high", ["sugary"], "Make it with little or no sugar."),
    ("akple_okro", "Akple with okro soup and fish", ["akple", "ewe akple"], "1 serving (about 450 g)", 520, 95, 20, 7, 6, 600, "high", ["starch", "soup", "veg"], "Smaller akple portion, more okro and fish."),
    ("omo_tuo", "Omo tuo with groundnut soup", ["rice balls", "omotuo"], "2 balls with soup (about 450 g)", 720, 100, 22, 26, 6, 850, "high", ["rice", "soup", "fatty"], "One ball, and a lighter soup."),
    ("ampesi_fish", "Boiled plantain or yam with fish stew", ["ampesi", "ampesi and kontomire"], "1 plate (about 400 g)", 550, 90, 22, 10, 8, 520, "medium", ["starch", "protein"], "Balance the plate with vegetables."),
    ("salad_egg", "Ghana salad with egg", ["salad", "vegetable salad"], "1 plate (about 200 g)", 220, 14, 8, 14, 4, 380, "low", ["veg"], "Use less salad cream or mayonnaise."),
    ("tz_ayoyo", "Tuo zaafi with ayoyo soup", ["tz", "tuo zaafi"], "1 serving (about 450 g)", 480, 90, 14, 6, 7, 500, "high", ["starch", "soup", "veg"], "Keep the portion of tz moderate."),
]

FOODS: Dict[str, dict] = {}
for r in _ROWS:
    FOODS[r[0]] = {"id": r[0], "name": r[1], "aka": r[2], "serving": r[3], "kcal": r[4], "carbs": r[5], "protein": r[6], "fat": r[7],
                   "fibre": r[8], "sodium_mg": r[9], "gi": r[10], "tags": r[11], "swap": r[12]}

PORTIONS = {"small": 0.7, "regular": 1.0, "large": 1.4, "extra": 1.8}
MEAL_TYPES = ("breakfast", "lunch", "dinner", "snack")


def public(f: dict) -> dict:
    return {k: f[k] for k in ("id", "name", "aka", "serving", "kcal", "gi", "tags")}


def search(q: str = "", limit: int = 12) -> List[dict]:
    q = (q or "").strip().lower()
    if not q:
        return [public(f) for f in list(FOODS.values())[:limit]]
    scored = []
    for f in FOODS.values():
        names = [f["name"].lower()] + [a.lower() for a in f["aka"]]
        if any(n.startswith(q) for n in names): s = 0
        elif any(q in n for n in names): s = 1
        elif any(q in t for t in f["tags"]) or q in f["id"]: s = 2
        else: continue
        scored.append((s, f["name"], f))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [public(f) for _, _, f in scored[:limit]]


def scale(f: dict, mult: float) -> dict:
    n = {k: round(f[k] * mult, 1) for k in ("kcal", "carbs", "protein", "fat", "fibre", "sodium_mg")}
    n["calories"] = int(round(n["kcal"]))      # the key the rest of the app already uses
    return n


def assess(f: dict, mult: float, conditions: Optional[List[str]] = None) -> dict:
    conds = [c.lower() for c in (conditions or [])]
    diabetes = any("diabet" in c for c in conds)
    hyper = any("hypertens" in c or "high blood" in c for c in conds)
    heart = any("cardio" in c or "heart" in c for c in conds)
    n = scale(f, mult)
    points, notes, score = [], [], 100
    if n["kcal"] > 700: score -= 15; points.append("Large meal for one sitting")
    if n["carbs"] > 90 or (diabetes and n["carbs"] > 70) or f["gi"] == "high" and diabetes:
        score -= 25 if diabetes else 12
        points.append("High in starch, which raises blood sugar" if diabetes else "High in starch")
    if n["sodium_mg"] > 800 or (hyper and n["sodium_mg"] > 600):
        score -= 25 if hyper else 12
        points.append("High in salt, which raises blood pressure" if hyper else "High in salt")
    if n["fat"] > 25 or (heart and n["fat"] > 18): score -= 12; points.append("High in fat")
    if "sugary" in f["tags"]:
        score -= 10
        points.append("Contains added sugar")
    if n["fibre"] < 4 and "starch" in f["tags"]: score -= 5
    if "veg" in f["tags"] or "legume" in f["tags"]: score += 8; notes.append("Has vegetables or beans, which is good.")
    if "fibre" in f["tags"]: score += 4
    score = max(5, min(100, score))
    level = "low" if score >= 70 else "medium" if score >= 45 else "high"
    return {"diet_score": score, "warning_level": level, "concerns": points, "positives": notes,
            "advice": f["swap"], "portion_note": "Estimates for a typical serving. Your plate may differ."}
