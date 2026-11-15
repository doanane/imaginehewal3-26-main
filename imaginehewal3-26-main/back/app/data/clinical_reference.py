"""Quick-pick reference for the doctor's consultation screen: common diagnosis codes, common medicines, and safety prompts when prescribing.

This is a convenience list for the conditions a primary-care and chronic-disease clinic in Ghana meets every day, NOT a full formulary or the full ICD-10.
A doctor can always type a diagnosis or a medicine that is not listed; those are simply not checked. The prompts are reminders, never blocks:
the prescriber decides. Codes are ICD-10-CM; use the clinic's own coding rules where they differ.
"""
from typing import Dict, List, Optional, Tuple

# (code, label, group)
DIAGNOSES: List[Tuple[str, str, str]] = [
    ("I10", "Essential (primary) hypertension", "Heart and circulation"),
    ("I11.9", "Hypertensive heart disease without heart failure", "Heart and circulation"),
    ("I12.9", "Hypertensive chronic kidney disease, stage 1 to 4", "Heart and circulation"),
    ("I20.9", "Angina pectoris, unspecified", "Heart and circulation"),
    ("I21.9", "Acute myocardial infarction, unspecified", "Heart and circulation"),
    ("I25.10", "Coronary artery disease without angina", "Heart and circulation"),
    ("I48.91", "Atrial fibrillation, unspecified", "Heart and circulation"),
    ("I50.9", "Heart failure, unspecified", "Heart and circulation"),
    ("I63.9", "Cerebral infarction (stroke), unspecified", "Heart and circulation"),
    ("I73.9", "Peripheral vascular disease, unspecified", "Heart and circulation"),
    ("E11.9", "Type 2 diabetes mellitus without complications", "Diabetes and metabolism"),
    ("E11.65", "Type 2 diabetes mellitus with hyperglycaemia", "Diabetes and metabolism"),
    ("E11.21", "Type 2 diabetes mellitus with diabetic nephropathy", "Diabetes and metabolism"),
    ("E11.40", "Type 2 diabetes mellitus with diabetic neuropathy", "Diabetes and metabolism"),
    ("E11.319", "Type 2 diabetes mellitus with retinopathy", "Diabetes and metabolism"),
    ("E11.621", "Type 2 diabetes mellitus with foot ulcer", "Diabetes and metabolism"),
    ("E10.9", "Type 1 diabetes mellitus without complications", "Diabetes and metabolism"),
    ("R73.03", "Prediabetes", "Diabetes and metabolism"),
    ("E66.9", "Obesity, unspecified", "Diabetes and metabolism"),
    ("E78.5", "Hyperlipidaemia, unspecified", "Diabetes and metabolism"),
    ("E78.00", "Pure hypercholesterolaemia", "Diabetes and metabolism"),
    ("E03.9", "Hypothyroidism, unspecified", "Diabetes and metabolism"),
    ("E55.9", "Vitamin D deficiency, unspecified", "Diabetes and metabolism"),
    ("N18.9", "Chronic kidney disease, unspecified", "Kidney and urinary"),
    ("N39.0", "Urinary tract infection, site not specified", "Kidney and urinary"),
    ("J45.909", "Asthma, unspecified, uncomplicated", "Chest"),
    ("J44.9", "Chronic obstructive pulmonary disease, unspecified", "Chest"),
    ("J06.9", "Acute upper respiratory infection, unspecified", "Chest"),
    ("J18.9", "Pneumonia, unspecified organism", "Chest"),
    ("A15.0", "Tuberculosis of lung", "Chest"),
    ("B50.9", "Plasmodium falciparum malaria, unspecified", "Infections"),
    ("B54", "Malaria, unspecified", "Infections"),
    ("A01.00", "Typhoid fever, unspecified", "Infections"),
    ("A09", "Infectious gastroenteritis and colitis, unspecified", "Infections"),
    ("B20", "HIV disease", "Infections"),
    ("B18.1", "Chronic viral hepatitis B without delta agent", "Infections"),
    ("D57.1", "Sickle-cell disease without crisis", "Blood"),
    ("D57.00", "Hb-SS disease with crisis, unspecified", "Blood"),
    ("D50.9", "Iron deficiency anaemia, unspecified", "Blood"),
    ("D64.9", "Anaemia, unspecified", "Blood"),
    ("G40.909", "Epilepsy, unspecified, not intractable", "Brain and mind"),
    ("G43.909", "Migraine, unspecified", "Brain and mind"),
    ("R51.9", "Headache, unspecified", "Brain and mind"),
    ("F32.A", "Depression, unspecified", "Brain and mind"),
    ("F41.9", "Anxiety disorder, unspecified", "Brain and mind"),
    ("F41.1", "Generalised anxiety disorder", "Brain and mind"),
    ("G47.00", "Insomnia, unspecified", "Brain and mind"),
    ("K21.9", "Gastro-oesophageal reflux disease without oesophagitis", "Stomach and liver"),
    ("K29.70", "Gastritis, unspecified, without bleeding", "Stomach and liver"),
    ("K27.9", "Peptic ulcer, unspecified", "Stomach and liver"),
    ("K59.00", "Constipation, unspecified", "Stomach and liver"),
    ("K76.0", "Fatty liver, not elsewhere classified", "Stomach and liver"),
    ("M54.50", "Low back pain, unspecified", "Bones and joints"),
    ("M17.9", "Osteoarthritis of knee, unspecified", "Bones and joints"),
    ("M19.90", "Osteoarthritis, unspecified site", "Bones and joints"),
    ("M10.9", "Gout, unspecified", "Bones and joints"),
    ("L30.9", "Dermatitis, unspecified", "Skin"),
    ("R50.9", "Fever, unspecified", "Symptoms"),
    ("R10.9", "Abdominal pain, unspecified", "Symptoms"),
    ("R07.9", "Chest pain, unspecified", "Symptoms"),
    ("R42", "Dizziness and giddiness", "Symptoms"),
    ("R53.83", "Other fatigue", "Symptoms"),
    ("R06.02", "Shortness of breath", "Symptoms"),
    ("R05.9", "Cough, unspecified", "Symptoms"),
    ("Z00.00", "General adult medical examination, no abnormal findings", "Check-ups"),
    ("Z09", "Follow-up examination after completed treatment", "Check-ups"),
    ("Z71.3", "Dietary counselling and surveillance", "Check-ups"),
]

# name -> (drug class, usual strengths, usual dose times, how it is usually taken)
MEDICINES: Dict[str, Dict] = {
    "Amlodipine": {"cls": "calcium channel blocker", "doses": ["5 mg", "10 mg"], "times": ["08:00"], "how": "Once a day."},
    "Nifedipine (retard)": {"cls": "calcium channel blocker", "doses": ["20 mg"], "times": ["08:00", "20:00"], "how": "Twice a day, swallowed whole."},
    "Lisinopril": {"cls": "ACE inhibitor", "doses": ["5 mg", "10 mg", "20 mg"], "times": ["08:00"], "how": "Once a day."},
    "Enalapril": {"cls": "ACE inhibitor", "doses": ["5 mg", "10 mg", "20 mg"], "times": ["08:00"], "how": "Once or twice a day."},
    "Losartan": {"cls": "ARB", "doses": ["50 mg", "100 mg"], "times": ["08:00"], "how": "Once a day."},
    "Valsartan": {"cls": "ARB", "doses": ["80 mg", "160 mg"], "times": ["08:00"], "how": "Once a day."},
    "Hydrochlorothiazide": {"cls": "thiazide diuretic", "doses": ["12.5 mg", "25 mg"], "times": ["08:00"], "how": "Once in the morning."},
    "Indapamide SR": {"cls": "thiazide diuretic", "doses": ["1.5 mg"], "times": ["08:00"], "how": "Once in the morning."},
    "Atenolol": {"cls": "beta blocker", "doses": ["25 mg", "50 mg", "100 mg"], "times": ["08:00"], "how": "Once a day."},
    "Bisoprolol": {"cls": "beta blocker", "doses": ["2.5 mg", "5 mg", "10 mg"], "times": ["08:00"], "how": "Once a day."},
    "Carvedilol": {"cls": "beta blocker", "doses": ["6.25 mg", "12.5 mg", "25 mg"], "times": ["08:00", "20:00"], "how": "Twice a day with food."},
    "Furosemide": {"cls": "loop diuretic", "doses": ["20 mg", "40 mg"], "times": ["08:00"], "how": "Once in the morning."},
    "Spironolactone": {"cls": "potassium-sparing diuretic", "doses": ["25 mg", "50 mg"], "times": ["08:00"], "how": "Once a day."},
    "Atorvastatin": {"cls": "statin", "doses": ["10 mg", "20 mg", "40 mg"], "times": ["21:00"], "how": "Once a day, usually at night."},
    "Simvastatin": {"cls": "statin", "doses": ["10 mg", "20 mg", "40 mg"], "times": ["21:00"], "how": "Once a day at night."},
    "Aspirin": {"cls": "antiplatelet", "doses": ["75 mg", "150 mg"], "times": ["08:00"], "how": "Once a day with food."},
    "Clopidogrel": {"cls": "antiplatelet", "doses": ["75 mg"], "times": ["08:00"], "how": "Once a day."},
    "Metformin": {"cls": "biguanide", "doses": ["500 mg", "850 mg", "1000 mg"], "times": ["08:00", "20:00"], "how": "With meals, twice a day."},
    "Glibenclamide": {"cls": "sulfonylurea", "doses": ["2.5 mg", "5 mg"], "times": ["08:00"], "how": "Before breakfast."},
    "Gliclazide": {"cls": "sulfonylurea", "doses": ["40 mg", "80 mg"], "times": ["08:00"], "how": "With breakfast."},
    "Insulin glargine": {"cls": "insulin", "doses": ["units set by the doctor"], "times": ["21:00"], "how": "Once a day at the same time."},
    "Insulin isophane (NPH)": {"cls": "insulin", "doses": ["units set by the doctor"], "times": ["08:00", "20:00"], "how": "Twice a day."},
    "Paracetamol": {"cls": "analgesic", "doses": ["500 mg", "1 g"], "times": ["08:00", "14:00", "20:00"], "how": "Up to four times a day. Not more than 4 g in 24 hours."},
    "Ibuprofen": {"cls": "NSAID", "doses": ["200 mg", "400 mg"], "times": ["08:00", "14:00", "20:00"], "how": "Three times a day after food, shortest course."},
    "Diclofenac": {"cls": "NSAID", "doses": ["50 mg"], "times": ["08:00", "20:00"], "how": "Twice a day after food, shortest course."},
    "Amoxicillin": {"cls": "penicillin antibiotic", "doses": ["250 mg", "500 mg"], "times": ["08:00", "14:00", "20:00"], "how": "Three times a day, finish the course."},
    "Artemether-lumefantrine": {"cls": "antimalarial", "doses": ["by weight, 6 doses over 3 days"], "times": ["08:00", "20:00"], "how": "With fatty food or milk, as per the weight-based pack."},
    "Omeprazole": {"cls": "proton pump inhibitor", "doses": ["20 mg", "40 mg"], "times": ["07:30"], "how": "Once a day before breakfast."},
    "Salbutamol inhaler": {"cls": "short-acting bronchodilator", "doses": ["100 micrograms per puff"], "times": ["08:00"], "how": "As needed for wheeze or breathlessness."},
    "Prednisolone": {"cls": "corticosteroid", "doses": ["5 mg", "20 mg", "40 mg"], "times": ["08:00"], "how": "In the morning with food, for the stated days."},
    "Levothyroxine": {"cls": "thyroid hormone", "doses": ["25 micrograms", "50 micrograms", "100 micrograms"], "times": ["06:30"], "how": "On an empty stomach, 30 minutes before food."},
    "Folic acid": {"cls": "vitamin", "doses": ["5 mg"], "times": ["08:00"], "how": "Once a day."},
    "Ferrous sulfate": {"cls": "iron", "doses": ["200 mg"], "times": ["08:00"], "how": "Once or twice a day."},
    "Sertraline": {"cls": "SSRI", "doses": ["50 mg", "100 mg"], "times": ["08:00"], "how": "Once a day."},
    "Carbamazepine": {"cls": "antiepileptic", "doses": ["200 mg", "400 mg"], "times": ["08:00", "20:00"], "how": "Twice a day."},
}

_BY_LOWER = {k.lower(): k for k in MEDICINES}


def find_medicine(name: str) -> Optional[str]:
    n = (name or "").strip().lower()
    if n in _BY_LOWER:
        return _BY_LOWER[n]
    for low, real in _BY_LOWER.items():                                   # "amlodipine 5mg" or "Metformin XR" still finds the base name
        if n and (n.startswith(low.split(" (")[0]) or low.split(" (")[0] in n):
            return real
    return None


def search_diagnoses(q: str, limit: int = 12) -> List[Dict]:
    q = (q or "").strip().lower()
    rows = DIAGNOSES if not q else [d for d in DIAGNOSES if q in d[0].lower() or q in d[1].lower() or q in d[2].lower()]
    return [{"code": c, "label": l, "group": g} for c, l, g in rows[:limit]]


def search_medicines(q: str, limit: int = 12) -> List[Dict]:
    q = (q or "").strip().lower()
    rows = [(n, m) for n, m in MEDICINES.items() if not q or q in n.lower() or q in m["cls"]]
    return [{"name": n, **m} for n, m in rows[:limit]]


def _has(conditions: List[str], *words: str) -> bool:
    return any(w in c for c in conditions for w in words)


def check_prescription(name: str, active_names: List[str], conditions: List[str]) -> Dict:
    """Reminders for the prescriber. `level` is 'caution' (think about it) or 'avoid' (usually should not be combined)."""
    real = find_medicine(name)
    if not real:
        return {"known": False, "warnings": [], "note": "This medicine is not in the quick list, so interactions were not checked."}
    cls = MEDICINES[real]["cls"]
    on = [(a, find_medicine(a)) for a in active_names]
    on_classes = {find_medicine(a) and MEDICINES[find_medicine(a)]["cls"]: a for a in active_names if find_medicine(a)}
    conds = [c.lower() for c in conditions]
    w: List[Dict] = []
    add = lambda level, text: w.append({"level": level, "text": text})  # noqa: E731

    for a, r in on:
        if r and r == real:
            add("avoid", f"The patient is already prescribed {a}.")
        elif r and MEDICINES[r]["cls"] == cls:
            add("caution", f"The patient is already on {a}, which is the same class ({cls}). Check this is intended.")
    if cls == "ACE inhibitor" and "ARB" in on_classes or cls == "ARB" and "ACE inhibitor" in on_classes:
        add("avoid", "An ACE inhibitor and an ARB together is generally avoided: risk of high potassium and kidney injury.")
    if cls in ("ACE inhibitor", "ARB") and "potassium-sparing diuretic" in on_classes or cls == "potassium-sparing diuretic" and ("ACE inhibitor" in on_classes or "ARB" in on_classes):
        add("caution", "With spironolactone, an ACE inhibitor or ARB can raise potassium. Check potassium and kidney function.")
    if cls == "NSAID":
        if _has(conds, "hypertens", "high blood"):
            add("caution", "NSAIDs can raise blood pressure and weaken its treatment.")
        if _has(conds, "kidney", "ckd", "renal", "nephro"):
            add("avoid", "NSAIDs can harm the kidneys, and this patient has kidney disease.")
        if _has(conds, "heart failure"):
            add("avoid", "NSAIDs can worsen heart failure.")
        if any(c in on_classes for c in ("ACE inhibitor", "ARB", "loop diuretic", "thiazide diuretic")):
            add("caution", "An NSAID with an ACE inhibitor, ARB or diuretic raises the risk of kidney injury.")
        if "antiplatelet" in on_classes:
            add("caution", "An NSAID with aspirin or clopidogrel raises the risk of bleeding.")
    if cls == "antiplatelet" and "NSAID" in on_classes:
        add("caution", "Aspirin or clopidogrel with an NSAID raises the risk of bleeding.")
    if cls in ("ACE inhibitor", "ARB", "loop diuretic", "thiazide diuretic") and "NSAID" in on_classes:
        add("caution", f"The patient takes {on_classes['NSAID']} (an NSAID), which can cause kidney injury with this medicine.")
    if cls == "biguanide" and _has(conds, "kidney", "ckd", "renal", "nephro"):
        add("caution", "Metformin needs the kidney function (eGFR) checked, and is avoided below 30.")
    if (cls == "sulfonylurea" and "insulin" in on_classes) or (cls == "insulin" and "sulfonylurea" in on_classes):
        add("caution", "A sulfonylurea with insulin raises the risk of low blood sugar.")
    if cls == "beta blocker" and _has(conds, "asthma", "copd"):
        add("caution", "Beta blockers can trigger bronchospasm in asthma or COPD.")
    if cls == "corticosteroid" and _has(conds, "diabet"):
        add("caution", "Steroids raise blood sugar. Review the diabetes plan.")
    if cls == "statin" and "statin" in on_classes:
        add("avoid", "Two statins together should not be used.")
    seen, out = set(), []
    for x in w:                                                              # the same sentence never twice
        if x["text"] not in seen:
            seen.add(x["text"]); out.append(x)
    return {"known": True, "medicine": real, "class": cls, "usual_doses": MEDICINES[real]["doses"], "usual_times": MEDICINES[real]["times"], "how": MEDICINES[real]["how"], "warnings": out}
