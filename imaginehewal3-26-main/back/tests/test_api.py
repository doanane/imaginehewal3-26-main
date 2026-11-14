#!/usr/bin/env python3
"""
Comprehensive API Test Suite for HEWAL3 Backend.
Tests all core modules: Auth, Users, Caregivers, Health, Notifications, and Messages.
"""

import requests
import json
import time
from datetime import datetime, timedelta, timezone
import random
import sys

BASE_URL = "http://localhost:8000"

# Global state to share data between tests
state = {
    "patient": {
        "email": f"patient_{int(time.time())}@test.com",
        "password": "TestPassword123!",
        "username": f"patient_{int(time.time())}",
        "token": None,
        "id": None,
        "patient_id": None
    },
    "caregiver": {
        "email": f"caregiver_{int(time.time())}@test.com",
        "password": "CaregiverPass123!",
        "username": f"caregiver_{int(time.time())}",
        "token": None,
        "id": None,
        "caregiver_id": None
    },
    "connection_request_id": None
}

# Track failures for CI/CD exit code
failures = []

def print_header(title):
    print("\n" + "="*80)
    print(f" {title} ".center(80, "="))
    print("="*80)

def print_result(name, success, detail=None):
    status = "PASS" if success else "FAIL"
    print(f"{status} - {name}")
    if detail:
        print(f"       Detail: {detail}")
    
    if not success:
        failures.append(name)

def log_debug(msg):
    with open("debug_log.txt", "a") as f:
        f.write(f"{datetime.now()}: {msg}\n")

def api_request(method, endpoint, token=None, json_data=None, params=None):
    log_debug(f"Entering api_request for {endpoint}")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=json_data,
            params=params,
            timeout=15
        )
        log_debug(f"Response from {url}: {response.status_code}")
        return response
    except requests.exceptions.Timeout:
        log_debug(f"Timeout Error to {url}")
        return None
    except requests.exceptions.ConnectionError as e:
        log_debug(f"Connection Error to {url}: {e}")
        return None
    except Exception as e:
        log_debug(f"Unexpected Error to {url}: {e}")
        import traceback
        traceback.print_exc()
        return None

# --- AUTH TESTS ---

def test_signup():
    print_header("TESTING SIGNUP")
    
    # Patient Signup
    p_data = {
        "email": state["patient"]["email"],
        "password": state["patient"]["password"],
        "username": state["patient"]["username"]
    }
    resp = api_request("POST", "/auth/signup", json_data=p_data)
    if resp and resp.status_code == 200:
        data = resp.json()
        state["patient"]["id"] = data.get("user_id")
        state["patient"]["token"] = data.get("access_token")
        print_result("Patient Signup", True, f"ID: {state['patient']['id']}")
    else:
        print_result("Patient Signup", False, resp.text if resp else "Connection Error")

    # Caregiver Signup
    c_data = {
        "email": state["caregiver"]["email"],
        "password": state["caregiver"]["password"],
        "first_name": "Test",
        "last_name": "Caregiver",
        "caregiver_type": "professional",
        "agree_to_terms": True
    }
    resp = api_request("POST", "/auth/signup/caregiver", json_data=c_data)
    if resp and resp.status_code == 200:
        data = resp.json()
        # Caregiver signup might not return user_id directly
        state["caregiver"]["id"] = data.get("user_id")
        state["caregiver"]["token"] = data.get("access_token")
        state["caregiver"]["caregiver_id"] = data.get("caregiver_id")
        print_result("Caregiver Signup", True, f"CG_ID: {state['caregiver']['caregiver_id']}")
    else:
        print_result("Caregiver Signup", False, resp.text if resp else "Connection Error")

def test_login():
    print_header("TESTING LOGIN")
    
    # Patient Login
    l_data = {"email": state["patient"]["email"], "password": state["patient"]["password"]}
    resp = api_request("POST", "/auth/login", json_data=l_data)
    if resp and resp.status_code == 200:
        data = resp.json()
        state["patient"]["token"] = data.get("access_token")
        state["patient"]["patient_id"] = data.get("patient_id")
        print_result("Patient Login", True, f"Patient ID: {state['patient']['patient_id']}")
    else:
        print_result("Patient Login", False, resp.text if resp else "Connection Error")

    # Caregiver Login
    l_data = {"email": state["caregiver"]["email"], "password": state["caregiver"]["password"]}
    resp = api_request("POST", "/auth/login", json_data=l_data)
    if resp and resp.status_code == 200:
        data = resp.json()
        state["caregiver"]["token"] = data.get("access_token")
        # Capture user_id here if we didn't get it during signup
        if not state["caregiver"]["id"]:
            state["caregiver"]["id"] = data.get("user_id")
        print_result("Caregiver Login", True, f"ID: {state['caregiver']['id']}")
    else:
        print_result("Caregiver Login", False, resp.text if resp else "Connection Error")

# --- USER TESTS ---

def test_user_profile():
    print_header("TESTING USER PROFILE")
    
    # Get Profile
    resp = api_request("GET", "/users/profile", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        print_result("Get Patient Profile", True)
    else:
        print_result("Get Patient Profile", False, resp.text if resp else "Connection Error")

    # Update Profile
    u_data = {
        "full_name": "Updated Patient Name",
        "age": 25,
        "gender": "Male",
        "weight": 70,
        "height": 175
    }
    resp = api_request("PUT", "/users/profile", token=state["patient"]["token"], json_data=u_data)
    if resp and resp.status_code == 200:
        print_result("Update Patient Profile", True)
    else:
        print_result("Update Patient Profile", False, resp.text if resp else "Connection Error")

    # Search Users
    resp = api_request("GET", "/users/search", token=state["caregiver"]["token"], params={"query": state["patient"]["email"]})
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(u["email"] == state["patient"]["email"] for u in data)
        print_result("Search Patient by Email", found)
    else:
        print_result("Search Patient by Email", False, resp.text if resp else "Connection Error")

# --- CAREGIVER TESTS ---

def test_caregiver_connection():
    print_header("TESTING CAREGIVER-PATIENT CONNECTION")
    
    # Caregiver connects to patient using numeric ID
    c_data = {"patient_caregiver_id": str(state["patient"]["id"])}
    resp = api_request("POST", "/caregivers/connect-patient", token=state["caregiver"]["token"], json_data=c_data)
    if resp and resp.status_code == 200:
        data = resp.json()
        state["connection_request_id"] = data.get("request_id")
        print_result("Caregiver Connect Request (by numeric ID)", True, f"Request ID: {state['connection_request_id']}")
    else:
        print_result("Caregiver Connect Request", False, resp.text if resp else "Connection Error")

    # Patient lists incoming requests
    resp = api_request("GET", "/caregivers/requests/incoming", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(r["request_id"] == state["connection_request_id"] for r in data)
        print_result("Patient List Incoming Requests", found)
    else:
        print_result("Patient List Incoming Requests", False, resp.text if resp else "Connection Error")

    # Patient responds (approves)
    if state["connection_request_id"]:
        r_data = {"action": "approve"}
        resp = api_request("POST", f"/caregivers/requests/{state['connection_request_id']}/respond", token=state["patient"]["token"], json_data=r_data)
        if resp and resp.status_code == 200:
            print_result("Patient Approve Request", True)
        else:
            print_result("Patient Approve Request", False, resp.text if resp else "Connection Error")

    # Caregiver lists patients
    resp = api_request("GET", "/caregivers/patients", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(p["patient_id"] == state["patient"]["id"] for p in data)
        print_result("Caregiver List Approved Patients", found)
    else:
        print_result("Caregiver List Approved Patients", False, resp.text if resp else "Connection Error")

# --- HEALTH TESTS ---

def test_health_data():
    print_header("TESTING HEALTH DATA")
    
    # Add Health Data
    h_data = {
        "steps": 8500,
        "sleep_time": 450,
        "water_intake": 1500,
        "heart_rate": 75,
        "blood_pressure": "115/75"
    }
    resp = api_request("POST", "/health/health-data", token=state["patient"]["token"], json_data=h_data)
    if resp and resp.status_code == 200:
        print_result("Add Health Data", True)
    else:
        print_result("Add Health Data", False, resp.text if resp else "Connection Error")

    # Get Dashboard
    resp = api_request("GET", "/health/dashboard", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        print_result("Get Health Dashboard", True)
    else:
        print_result("Get Health Dashboard", False, resp.text if resp else "Connection Error")

    # Log Food
    f_data = {
        "meal_type": "Lunch",
        "diet_score": 85
    }
    resp = api_request("POST", "/health/food-log", token=state["patient"]["token"], json_data=f_data)
    if resp and resp.status_code == 200:
        print_result("Log Food", True)
    else:
        print_result("Log Food", False, resp.text if resp else "Connection Error")

# --- NOTIFICATION TESTS ---

def test_notifications():
    print_header("TESTING NOTIFICATIONS")
    
    # List Notifications
    resp = api_request("GET", "/notifications/", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        print_result("List Notifications", True, f"Count: {len(data.get('caregiver', [])) + len(data.get('system', []))}")
        
        # Mark first notification as read if exists
        all_notifs = data.get('caregiver', []) + data.get('system', [])
        if all_notifs:
            notif_id = all_notifs[0]["id"]
            resp = api_request("POST", f"/notifications/mark-read/{notif_id}", token=state["patient"]["token"])
            if resp and resp.status_code == 200:
                print_result("Mark Notification Read", True)
            else:
                print_result("Mark Notification Read", False, resp.text if resp else "Connection Error")
    else:
        print_result("List Notifications", False, resp.text if resp else "Connection Error")

# --- MESSAGE TESTS ---

def test_messages():
    print_header("TESTING MESSAGES")
    
    # Caregiver sends message to patient
    m_data = {
        "receiver_id": state["patient"]["id"],
        "content": "Hello from your caregiver!"
    }
    resp = api_request("POST", "/messages/send", token=state["caregiver"]["token"], json_data=m_data)
    if resp and resp.status_code == 200:
        print_result("Send Message (Caregiver -> Patient)", True)
    else:
        print_result("Send Message", False, resp.text if resp else "Connection Error")

    # Patient lists conversations
    resp = api_request("GET", "/messages/conversations", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(c["user_id"] == state["caregiver"]["id"] for c in data)
        print_result("Patient List Conversations", found)
    else:
        print_result("Patient List Conversations", False, resp.text if resp else "Connection Error")

    # Patient gets conversation history
    resp = api_request("GET", f"/messages/conversation/{state['caregiver']['id']}", token=state["patient"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        print_result("Get Conversation History", True, f"Messages: {len(data)}")
    else:
        print_result("Get Conversation History", False, resp.text if resp else "Connection Error")

# --- EXTENDED CAREGIVER TESTS ---

def test_caregiver_dashboard():
    print_header("TESTING CAREGIVER DASHBOARD")
    
    resp = api_request("GET", "/caregivers/dashboard", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        print_result("Get Caregiver Dashboard", True, f"Patients: {data.get('stats', {}).get('total_patients')}")
    else:
        print_result("Get Caregiver Dashboard", False, resp.text if resp else "Connection Error")

def test_caregiver_tasks():
    print_header("TESTING CAREGIVER TASKS")
    
    # Create Task
    t_data = {
        "patient_id": state["patient"]["id"],
        "title": "Test Task",
        "description": "This is a test task",
        "task_type": "medication",
        "priority": "high",
        "due_date": datetime.now(timezone.utc).isoformat()
    }
    resp = api_request("POST", "/caregiver/tasks", token=state["caregiver"]["token"], json_data=t_data)
    task_id = None
    if resp and resp.status_code == 200:
        data = resp.json()
        task_id = data.get("id")
        print_result("Create Task", True, f"Task ID: {task_id}")
    else:
        detail = resp.text if resp else "Connection Error"
        if resp:
            detail += f" (Status: {resp.status_code})"
        print_result("Create Task", False, detail)
        
    # Get Tasks
    resp = api_request("GET", "/caregiver/tasks", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(t["id"] == task_id for t in data) if task_id else False
        print_result("Get Tasks", found)
    else:
        print_result("Get Tasks", False, resp.text if resp else "Connection Error")

    # Update Task
    if task_id:
        u_data = {"status": "in_progress"}
        resp = api_request("PUT", f"/caregiver/tasks/{task_id}", token=state["caregiver"]["token"], json_data=u_data)
        if resp and resp.status_code == 200:
            print_result("Update Task", True)
        else:
            print_result("Update Task", False, resp.text if resp else "Connection Error")
            
    # Delete Task
    if task_id:
        resp = api_request("DELETE", f"/caregiver/tasks/{task_id}", token=state["caregiver"]["token"])
        if resp and resp.status_code == 200:
            print_result("Delete Task", True)
        else:
            print_result("Delete Task", False, resp.text if resp else "Connection Error")

def test_caregiver_schedule():
    print_header("TESTING CAREGIVER SCHEDULE")
    
    # Create Appointment
    a_data = {
        "patient_id": state["patient"]["id"],
        "title": "Test Appointment",
        "appointment_type": "checkup",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    }
    resp = api_request("POST", "/caregiver/schedule/", token=state["caregiver"]["token"], json_data=a_data)
    appt_id = None
    if resp and resp.status_code == 200:
        data = resp.json()
        appt_id = data.get("id")
        print_result("Create Appointment", True, f"Appt ID: {appt_id}")
    else:
        print_result("Create Appointment", False, resp.text if resp else "Connection Error")
        
    # Get Appointments
    resp = api_request("GET", "/caregiver/schedule/", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(a["id"] == appt_id for a in data) if appt_id else False
        print_result("Get Appointments", found)
    else:
        print_result("Get Appointments", False, resp.text if resp else "Connection Error")

def test_caregiver_analytics():
    print_header("TESTING CAREGIVER ANALYTICS")
    
    if state["patient"]["id"]:
        resp = api_request("GET", f"/caregiver/analytics/patient/{state['patient']['id']}", token=state["caregiver"]["token"])
        if resp and resp.status_code == 200:
            print_result("Get Patient Analytics", True)
        else:
            print_result("Get Patient Analytics", False, resp.text if resp else "Connection Error")

def test_caregiver_removal():
    print_header("TESTING CAREGIVER REMOVAL")
    
    # Caregiver removes patient
    resp = api_request("DELETE", f"/caregivers/patients/{state['patient']['id']}", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        print_result("Caregiver Remove Patient", True)
    else:
        print_result("Caregiver Remove Patient", False, resp.text if resp else "Connection Error")

    # Verify removal (Caregiver lists patients again)
    resp = api_request("GET", "/caregivers/patients", token=state["caregiver"]["token"])
    if resp and resp.status_code == 200:
        data = resp.json()
        found = any(p["patient_id"] == state["patient"]["id"] for p in data)
        print_result("Verify Patient Removed", not found)
    else:
        print_result("Verify Patient Removed", False, resp.text if resp else "Connection Error")

def main():
    print("\n" + "STARTING COMPREHENSIVE API TEST SUITE".center(80))
    print(f"Target URL: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        test_signup()
        test_login()
        test_user_profile()
        test_caregiver_connection()
        test_health_data()
        test_notifications()
        test_messages()
        
        # Extended Caregiver Tests
        test_caregiver_dashboard()
        # test_caregiver_tasks()
        # test_caregiver_schedule()
        # test_caregiver_analytics()
        
        # Removal Test (Must be last)
        test_caregiver_removal()
        
        print("\n" + "="*80)
        print(" ALL TESTS COMPLETED ".center(80, "="))
        print("="*80 + "\n")
        
        if failures:
            print(f"FAILED: {len(failures)} tests failed!")
            for f in failures:
                print(f"  - {f}")
            sys.exit(1)
        else:
            print("All tests passed successfully!")
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\nTests interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error during tests: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
