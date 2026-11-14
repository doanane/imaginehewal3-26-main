#!/usr/bin/env python3
"""
Test script to verify auth endpoints work correctly.
Run this after deploying to verify signup/login flow.
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_patient_signup():
    """Test patient signup flow"""
    print("\n" + "="*60)
    print("TESTING PATIENT SIGNUP")
    print("="*60)
    
    signup_data = {
        "email": f"testuser{datetime.now().timestamp()}@example.com",
        "password": "TestPassword123!",
        "username": f"testuser_{datetime.now().timestamp():.0f}",
        "phone_number": "+1234567890"
    }
    
    print(f"\nRequest Data: {json.dumps(signup_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/auth/signup",
        json=signup_data,
        timeout=10
    )
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Data: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        data = response.json()
        return {
            "email": signup_data["email"],
            "password": signup_data["password"],
            "user_id": data.get("user_id"),
            "access_token": data.get("access_token")
        }
    else:
        print(f"❌ Signup failed: {response.json()}")
        return None


def test_patient_login(email, password):
    """Test patient login flow"""
    print("\n" + "="*60)
    print("TESTING PATIENT LOGIN")
    print("="*60)
    
    login_data = {
        "email": email,
        "password": password
    }
    
    print(f"\nRequest Data: {json.dumps(login_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=login_data,
        timeout=10
    )
    
    print(f"\nResponse Status: {response.status_code}")
    response_json = response.json()
    print(f"Response Data: {json.dumps(response_json, indent=2)}")
    
    if response.status_code == 200:
        print("✅ Login successful!")
        return response_json
    else:
        print(f"❌ Login failed: {response_json}")
        return None


def test_case_insensitive_login(email, password):
    """Test that login works with different email case"""
    print("\n" + "="*60)
    print("TESTING CASE-INSENSITIVE LOGIN")
    print("="*60)
    
    # Try login with UPPERCASE email
    uppercase_email = email.upper()
    login_data = {
        "email": uppercase_email,
        "password": password
    }
    
    print(f"\nRequest Data (uppercase email): {json.dumps(login_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=login_data,
        timeout=10
    )
    
    print(f"\nResponse Status: {response.status_code}")
    response_json = response.json()
    print(f"Response Data: {json.dumps(response_json, indent=2)}")
    
    if response.status_code == 200:
        print("✅ Case-insensitive login successful!")
        return response_json
    else:
        print(f"❌ Case-insensitive login failed: {response_json}")
        return None


def test_caregiver_signup():
    """Test caregiver signup flow"""
    print("\n" + "="*60)
    print("TESTING CAREGIVER SIGNUP")
    print("="*60)
    
    signup_data = {
        "email": f"caregiver{datetime.now().timestamp()}@example.com",
        "password": "CaregiverPass123!",
        "first_name": "John",
        "last_name": "Caregiver",
        "phone_number": "+1234567890",
        "caregiver_type": "nurse",
        "agree_to_terms": True
    }
    
    print(f"\nRequest Data: {json.dumps(signup_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/auth/signup/caregiver",
        json=signup_data,
        timeout=10
    )
    
    print(f"\nResponse Status: {response.status_code}")
    response_json = response.json()
    print(f"Response Data: {json.dumps(response_json, indent=2)}")
    
    if response.status_code == 200:
        data = response_json
        print(f"\n✅ Caregiver Signup successful!")
        print(f"   - Caregiver ID: {data.get('caregiver_id')}")
        print(f"   - User Type: {data.get('user_type')}")
        return {
            "email": signup_data["email"],
            "password": signup_data["password"],
            "user_id": data.get("user_id"),
            "caregiver_id": data.get("caregiver_id"),
            "access_token": data.get("access_token")
        }
    else:
        print(f"❌ Caregiver signup failed: {response_json}")
        return None


def test_caregiver_login(email, password):
    """Test caregiver login flow"""
    print("\n" + "="*60)
    print("TESTING CAREGIVER LOGIN")
    print("="*60)
    
    login_data = {
        "email": email,
        "password": password
    }
    
    print(f"\nRequest Data: {json.dumps(login_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=login_data,
        timeout=10
    )
    
    print(f"\nResponse Status: {response.status_code}")
    response_json = response.json()
    print(f"Response Data: {json.dumps(response_json, indent=2)}")
    
    if response.status_code == 200:
        data = response_json
        print("✅ Caregiver login successful!")
        if data.get("is_caregiver"):
            print(f"   ✅ is_caregiver flag is TRUE")
        else:
            print(f"   ⚠️  WARNING: is_caregiver flag is NOT set")
        if data.get("caregiver_id"):
            print(f"   ✅ caregiver_id present: {data.get('caregiver_id')}")
        else:
            print(f"   ⚠️  WARNING: caregiver_id is missing")
        return response_json
    else:
        print(f"❌ Caregiver login failed: {response_json}")
        return None


def main():
    """Run all tests"""
    print("\n" + "🧪 AUTH ENDPOINT TEST SUITE".center(60, "="))
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test patient flow
    print("\n\n📋 PATIENT SIGNUP & LOGIN TEST")
    patient = test_patient_signup()
    
    if patient:
        print(f"\n✅ Patient created: {patient['email']}")
        test_patient_login(patient['email'], patient['password'])
        test_case_insensitive_login(patient['email'], patient['password'])
    
    # Test caregiver flow
    print("\n\n👥 CAREGIVER SIGNUP & LOGIN TEST")
    caregiver = test_caregiver_signup()
    
    if caregiver:
        print(f"\n✅ Caregiver created: {caregiver['email']}")
        test_caregiver_login(caregiver['email'], caregiver['password'])
    
    print("\n" + "="*60)
    print("TEST SUITE COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print(f"❌ ERROR: Cannot connect to {BASE_URL}")
        print("Make sure the backend is running!")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
