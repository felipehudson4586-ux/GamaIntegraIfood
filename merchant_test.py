#!/usr/bin/env python3
"""
iFood Partner Dashboard - Merchant Module Testing
Tests specifically the Merchant endpoints as requested in the review
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class MerchantModuleTester:
    def __init__(self, base_url: str = "https://menu-sync-platform.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.merchant_id = "fb3625ab-1907-4e8a-af83-2e0c52733e89"  # From review request

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, json=data, params=params, timeout=30)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, params=params, timeout=30)
            elif method == 'DELETE':
                response = self.session.delete(url, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                    # Validate APIResponse format
                    if isinstance(response_data, dict):
                        if 'success' in response_data:
                            print(f"   Success: {response_data.get('success')}")
                        if 'message' in response_data:
                            print(f"   Message: {response_data.get('message')}")
                        if 'data' in response_data and response_data['data']:
                            data_type = type(response_data['data']).__name__
                            if isinstance(response_data['data'], list):
                                print(f"   Data: {len(response_data['data'])} items")
                            elif isinstance(response_data['data'], dict):
                                print(f"   Data: {len(response_data['data'])} fields")
                            else:
                                print(f"   Data: {data_type}")
                except:
                    response_data = {"raw_response": response.text}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "name": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                response_data = {"error": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            print(f"❌ FAILED - Network Error: {str(e)}")
            self.failed_tests.append({
                "name": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test health endpoint"""
        print("\n" + "="*60)
        print("🏥 TESTING HEALTH CHECK")
        print("="*60)
        
        success, data = self.run_test("Health Check", "GET", "/api/health")
        if success:
            print(f"   Status: {data.get('status', 'unknown')}")
            print(f"   Database: {data.get('database', 'unknown')}")
            print(f"   Has Credentials: {data.get('has_credentials', False)}")
            print(f"   Polling Active: {data.get('polling_active', False)}")
        
        return success

    def test_auth_status(self):
        """Test authentication status"""
        print("\n" + "="*60)
        print("🔐 TESTING AUTHENTICATION STATUS")
        print("="*60)
        
        success, data = self.run_test("Auth Status", "GET", "/api/auth/status")
        if success:
            print(f"   Has Credentials: {data.get('has_credentials', False)}")
            print(f"   App Type: {data.get('app_type', 'unknown')}")
            print(f"   Token Valid: {data.get('token_valid', False)}")
            
            # Validate expected format from review
            expected_has_credentials = True
            expected_app_type = "centralized"
            
            if data.get('has_credentials') == expected_has_credentials:
                print(f"   ✅ has_credentials matches expected: {expected_has_credentials}")
            else:
                print(f"   ❌ has_credentials mismatch - Expected: {expected_has_credentials}, Got: {data.get('has_credentials')}")
            
            if data.get('app_type') == expected_app_type:
                print(f"   ✅ app_type matches expected: {expected_app_type}")
            else:
                print(f"   ❌ app_type mismatch - Expected: {expected_app_type}, Got: {data.get('app_type')}")
        
        return success

    def test_merchant_list(self):
        """Test GET /api/merchant/list"""
        print("\n" + "="*60)
        print("🏪 TESTING MERCHANT LIST")
        print("="*60)
        
        success, data = self.run_test("List All Merchants", "GET", "/api/merchant/list")
        if success:
            # Validate APIResponse format
            if data.get('success') == True:
                merchants = data.get('data', [])
                print(f"   ✅ Success: {data.get('success')}")
                print(f"   Found {len(merchants)} linked merchants")
                
                # Validate each merchant has required fields
                for i, merchant in enumerate(merchants):
                    print(f"   Merchant {i+1}:")
                    print(f"     - ID: {merchant.get('id', 'MISSING')}")
                    print(f"     - Name: {merchant.get('name', 'MISSING')}")
                    print(f"     - Corporate Name: {merchant.get('corporateName', 'MISSING')}")
                    
                    # Validate required fields
                    required_fields = ['id', 'name', 'corporateName']
                    for field in required_fields:
                        if field not in merchant:
                            print(f"     ❌ Missing required field: {field}")
                        else:
                            print(f"     ✅ Has required field: {field}")
            else:
                print(f"   ❌ API Response success=false: {data.get('error', 'Unknown error')}")
        
        return success

    def test_merchant_details(self):
        """Test GET /api/merchant/details/{merchant_id}"""
        print("\n" + "="*60)
        print("🏪 TESTING MERCHANT DETAILS")
        print("="*60)
        
        success, data = self.run_test("Merchant Details", "GET", f"/api/merchant/details/{self.merchant_id}")
        if success:
            if data.get('success') == True:
                details = data.get('data', {})
                print(f"   ✅ Success: {data.get('success')}")
                print(f"   Merchant Name: {details.get('name', 'MISSING')}")
                
                # Check address
                address = details.get('address', {})
                if address:
                    print(f"   Address: {address.get('formattedAddress', 'Not formatted')}")
                    print(f"     Street: {address.get('streetName', 'N/A')} {address.get('streetNumber', '')}")
                    print(f"     City: {address.get('city', 'N/A')}")
                else:
                    print(f"   ❌ Missing address information")
                
                # Check operations
                operations = details.get('operations', [])
                if operations:
                    if isinstance(operations[0], dict):
                        # Operations are objects, extract names
                        op_names = [op.get('name', str(op)) for op in operations]
                        print(f"   Operations: {', '.join(op_names)}")
                    else:
                        # Operations are strings
                        print(f"   Operations: {', '.join(operations)}")
                else:
                    print(f"   Operations: None")
                
                # Validate required fields from review
                required_fields = ['name', 'address', 'operations']
                for field in required_fields:
                    if field in details:
                        print(f"   ✅ Has required field: {field}")
                    else:
                        print(f"   ❌ Missing required field: {field}")
            else:
                print(f"   ❌ API Response success=false: {data.get('error', 'Unknown error')}")
        
        return success

    def test_merchant_status(self):
        """Test GET /api/merchant/status/{merchant_id}"""
        print("\n" + "="*60)
        print("🏪 TESTING MERCHANT STATUS")
        print("="*60)
        
        success, data = self.run_test("Merchant Status", "GET", f"/api/merchant/status/{self.merchant_id}")
        if success:
            if data.get('success') == True:
                status = data.get('data', {})
                print(f"   ✅ Success: {data.get('success')}")
                
                # Check state
                state = status.get('state', 'MISSING')
                print(f"   Store State: {state}")
                
                # Validate state is one of expected values
                valid_states = ['OK', 'WARNING', 'CLOSED', 'ERROR']
                if state in valid_states:
                    print(f"   ✅ State is valid: {state}")
                else:
                    print(f"   ❌ Invalid state: {state} (expected one of: {', '.join(valid_states)})")
                
                # Check validations
                validations = status.get('validations', [])
                print(f"   Validations: {len(validations)} checks")
                for validation in validations[:5]:  # Show first 5
                    print(f"     - {validation.get('name', 'N/A')}: {validation.get('status', 'N/A')}")
                
                # Validate required fields from review
                required_fields = ['state', 'validations']
                for field in required_fields:
                    if field in status:
                        print(f"   ✅ Has required field: {field}")
                    else:
                        print(f"   ❌ Missing required field: {field}")
            else:
                print(f"   ❌ API Response success=false: {data.get('error', 'Unknown error')}")
        
        return success

    def test_merchant_interruptions(self):
        """Test GET /api/merchant/interruptions/{merchant_id}"""
        print("\n" + "="*60)
        print("🏪 TESTING MERCHANT INTERRUPTIONS")
        print("="*60)
        
        success, data = self.run_test("Merchant Interruptions", "GET", f"/api/merchant/interruptions/{self.merchant_id}")
        if success:
            if data.get('success') == True:
                interruptions = data.get('data', [])
                print(f"   ✅ Success: {data.get('success')}")
                print(f"   Active Interruptions: {len(interruptions)}")
                
                if interruptions:
                    for i, interruption in enumerate(interruptions):
                        print(f"   Interruption {i+1}:")
                        print(f"     - Start: {interruption.get('start', 'N/A')}")
                        print(f"     - End: {interruption.get('end', 'N/A')}")
                        print(f"     - Description: {interruption.get('description', 'N/A')}")
                else:
                    print(f"   ✅ No active interruptions (empty array as expected)")
            else:
                print(f"   ❌ API Response success=false: {data.get('error', 'Unknown error')}")
        
        return success

    def test_merchant_opening_hours(self):
        """Test GET /api/merchant/opening-hours/{merchant_id}"""
        print("\n" + "="*60)
        print("🏪 TESTING MERCHANT OPENING HOURS")
        print("="*60)
        
        success, data = self.run_test("Merchant Opening Hours", "GET", f"/api/merchant/opening-hours/{self.merchant_id}")
        if success:
            if data.get('success') == True:
                hours = data.get('data', {})
                print(f"   ✅ Success: {data.get('success')}")
                
                shifts = hours.get('shifts', [])
                print(f"   Configured Shifts: {len(shifts)}")
                
                for shift in shifts:
                    day = shift.get('dayOfWeek', 'N/A')
                    start = shift.get('start', 'N/A')
                    duration = shift.get('duration', 0)
                    print(f"     - {day}: {start} ({duration} minutes)")
                    
                    # Validate required fields from review
                    required_fields = ['dayOfWeek', 'start', 'duration']
                    for field in required_fields:
                        if field in shift:
                            print(f"       ✅ Has required field: {field}")
                        else:
                            print(f"       ❌ Missing required field: {field}")
                
                if not shifts:
                    print(f"   ⚠️ No shifts configured")
            else:
                print(f"   ❌ API Response success=false: {data.get('error', 'Unknown error')}")
        
        return success

    def run_merchant_tests(self):
        """Run all merchant module tests"""
        print("🚀 Starting iFood Partner Dashboard - Merchant Module Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"🏪 Merchant ID: {self.merchant_id}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run tests in order specified in review
        test_results = []
        
        test_results.append(self.test_health_check())
        test_results.append(self.test_auth_status())
        test_results.append(self.test_merchant_list())
        test_results.append(self.test_merchant_details())
        test_results.append(self.test_merchant_status())
        test_results.append(self.test_merchant_interruptions())
        test_results.append(self.test_merchant_opening_hours())
        
        # Print final results
        self.print_results()
        
        return all(test_results)

    def print_results(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("📊 MERCHANT MODULE TEST RESULTS")
        print("="*60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"🔢 Total Tests: {self.tests_run}")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test['name']}")
                if 'expected' in test:
                    print(f"      Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                print()
        else:
            print(f"\n🎉 ALL MERCHANT MODULE TESTS PASSED!")
        
        print("="*60)

def main():
    """Main test execution"""
    tester = MerchantModuleTester()
    
    try:
        success = tester.run_merchant_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())