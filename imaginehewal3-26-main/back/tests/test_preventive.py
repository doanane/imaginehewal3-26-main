"""Diabetes risk, screening schedule, workplace heat check and consent-based record sharing. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402
from app.services import preventive  # noqa: E402


def test_findrisc_scoring_is_the_published_table():
    low = preventive.diabetes_risk(age=30, bmi=22, waist_cm=70, sex="female", active_30min_daily=True, veg_fruit_daily=True,
                                   bp_medicine=False, high_glucose_before=False, family="none")
    assert low["score"] == 0 and low["band"] == "low" and low["complete"]
    high = preventive.diabetes_risk(age=66, bmi=32, waist_cm=105, sex="male", active_30min_daily=False, veg_fruit_daily=False,
                                    bp_medicine=True, high_glucose_before=True, family="first_degree")
    assert high["score"] == 4 + 3 + 4 + 2 + 1 + 2 + 5 + 5 == 26 and high["band"] == "very_high"
    # waist thresholds differ by sex
    w = lambda sex: preventive.diabetes_risk(age=30, bmi=22, waist_cm=90, sex=sex, active_30min_daily=True, veg_fruit_daily=True, bp_medicine=False, high_glucose_before=False, family="none")["score"]
    assert w("female") == 4 and w("male") == 0


def test_screenings_depend_on_age_and_sex():
    names = lambda age, sex: [s["name"] for s in preventive.screenings(age, sex)]
    assert "Cervical screening" in names(35, "female") and "Cervical screening" not in names(35, "male")
    assert "Breast screening (mammogram)" in names(45, "female")
    assert "Flu and pneumonia vaccines" in names(70, "male") and "Flu and pneumonia vaccines" not in names(30, "male")


def test_heat_check_levels_and_adjustments():
    mild = preventive.heat_check(temp_c=22, humidity_pct=40)
    assert mild["level"] == "low" and mild["heat_index_c"] == 22
    hot = preventive.heat_check(temp_c=42, humidity_pct=50)                      # heat index is well above 41 C
    assert hot["level"] in ("danger", "extreme_danger") and hot["heat_index_c"] > 45
    base = preventive.heat_check(temp_c=33, humidity_pct=60)
    raised = preventive.heat_check(temp_c=33, humidity_pct=60, effort="heavy", direct_sun=True, conditions=["Hypertension"], region="ae")
    assert preventive.LEVELS.index(raised["level"]) > preventive.LEVELS.index(base["level"])
    assert raised["emergency_number"] == "998" and raised["raised_because"]


def test_preventive_endpoints_need_profile_and_validate(env):
    c, hp = env["client"], env["hp"]
    ok = c.post("/preventive/diabetes-risk", headers=hp, json={"active_30min_daily": False, "veg_fruit_daily": True, "bp_medicine": True, "high_glucose_before": False, "family": "none"})
    assert ok.status_code == 200 and ok.json()["score"] >= 3                    # age 61 adds 3, blood pressure medicine adds 2
    assert c.post("/preventive/diabetes-risk", headers=hp, json={"active_30min_daily": True, "veg_fruit_daily": True, "bp_medicine": False, "high_glucose_before": False, "family": "cousin"}).status_code == 422
    assert c.get("/preventive/screenings", headers=hp).json()["screenings"]
    h = c.post("/preventive/heat-check", headers=hp, json={"temp_c": 38, "humidity_pct": 55, "effort": "heavy"})
    assert h.status_code == 200 and h.json()["level"] in ("danger", "extreme_danger", "extreme_caution")
    assert c.post("/preventive/heat-check", headers=hp, json={"temp_c": 38, "humidity_pct": 55, "effort": "extreme"}).status_code == 422
    assert c.post("/preventive/heat-check", json={"temp_c": 30, "humidity_pct": 50}).status_code in (401, 403)


def test_sharing_the_record_with_another_clinic(env):
    c, hp = env["client"], env["hp"]
    _, hd = login(c)                              # the patient's own doctor
    _, hd2 = login(c, "DPT0001B")                 # a doctor at another clinic
    pid = env["pat"]
    c.post(f"/doctor-portal/patients/{pid}/labs", headers=hd, json={"test": "Creatinine", "value": "80", "unit": "umol/L", "flag": "normal"})
    c.post("/records/allergies", headers=hp, json={"substance": "Latex", "severity": "moderate"})
    sh = c.post("/records/share", headers=hp, json={"label": "City Hospital", "hours": 2}).json()
    code = sh["code"]
    assert len(code) == 10 and sh["active"]
    # a wrong code is refused; the right one returns a FHIR bundle that holds the record and nothing else
    assert c.post("/doctor-portal/exchange/redeem", headers=hd2, json={"code": "0000000000"}).status_code == 404
    b = c.post("/doctor-portal/exchange/redeem", headers=hd2, json={"code": code.lower()})
    assert b.status_code == 200 and b.json()["resourceType"] == "Bundle"
    kinds = {e["resource"]["resourceType"] for e in b.json()["entry"]}
    assert {"Patient", "AllergyIntolerance", "Observation"} <= kinds
    # the patient sees who used it, then cancels it and it stops working
    lst = c.get("/records/share", headers=hp).json()["shares"][0]
    assert lst["uses"] == 1 and lst["accessed_by"][0]["doctor"]
    assert c.delete(f"/records/share/{lst['id']}", headers=hp).status_code == 200
    assert c.post("/doctor-portal/exchange/redeem", headers=hd2, json={"code": code}).status_code == 404
    # nobody can cancel someone else's share
    assert c.delete(f"/records/share/{lst['id']}", headers=env["hc"]).status_code == 404
