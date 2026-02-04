#!/usr/bin/env python3
"""
iFood Partner Dashboard - Backend API Testing
Tests all 6 modules: Authentication, Orders, Items, Promotions, Picking, Financial
"""

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

class IFoodDashboardTester:
    def __init__(self, base_url: str = "https://orderhive-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

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

    def test_health_endpoints(self):
        """Test health and basic endpoints"""
        print("\n" + "="*60)
        print("🏥 TESTING HEALTH & BASIC ENDPOINTS")
        print("="*60)
        
        # Test root health
        self.run_test("Root Health Check", "GET", "/api/")
        
        # Test detailed health
        self.run_test("Detailed Health Check", "GET", "/api/health")

    def test_authentication_module(self):
        """Test Module 1: Authentication"""
        print("\n" + "="*60)
        print("🔐 TESTING MODULE 1: AUTHENTICATION")
        print("="*60)
        
        # Test auth status
        success, data = self.run_test("Auth Status", "GET", "/api/auth/status")
        if success:
            print(f"   Has Credentials: {data.get('has_credentials', False)}")
            print(f"   Merchant ID: {data.get('merchant_id', 'N/A')}")
            print(f"   Token Valid: {data.get('token_valid', False)}")
        
        # Test token generation
        success, token_data = self.run_test("Get Auth Token", "GET", "/api/auth/token")
        if success and token_data and isinstance(token_data, dict):
            # Check if it's a success response
            if token_data.get('success'):
                access_token = token_data.get('data', {}).get('access_token')
                print(f"   Token obtained: {bool(access_token)}")
            else:
                print(f"   Token error: {token_data.get('error', 'Unknown error')}")
        
        return success, token_data

    def test_orders_module(self):
        """Test Module 2: Orders"""
        print("\n" + "="*60)
        print("📦 TESTING MODULE 2: ORDERS")
        print("="*60)
        
        # Test list orders
        success, orders_data = self.run_test("List Orders", "GET", "/api/orders")
        if success:
            orders = orders_data.get('orders', [])
            print(f"   Found {len(orders)} orders")
        
        # Test today's orders
        success, today_data = self.run_test("Today's Orders", "GET", "/api/orders/today")
        if success:
            today_orders = today_data.get('orders', [])
            print(f"   Found {len(today_orders)} orders today")
        
        # Test with filters
        self.run_test("Orders by Status", "GET", "/api/orders", params={"status": "PLACED"})
        self.run_test("Orders by Type", "GET", "/api/orders", params={"order_type": "DELIVERY"})
        
        # Test cancellation reasons
        self.run_test("Cancellation Reasons", "GET", "/api/orders/cancellation-reasons/list")
        
        return len(orders_data.get('orders', [])) > 0

    def test_items_module(self):
        """Test Module 3: Items/Catalog"""
        print("\n" + "="*60)
        print("🛍️ TESTING MODULE 3: ITEMS/CATALOG")
        print("="*60)
        
        # Test list items
        success, items_data = self.run_test("List Items", "GET", "/api/items")
        if success:
            items = items_data.get('items', [])
            print(f"   Found {len(items)} items")
        
        # Test create item
        test_item = {
            "external_code": f"TEST_{datetime.now().strftime('%H%M%S')}",
            "name": "Test Item for API Testing",
            "description": "Item created during API testing",
            "price": 15.99,
            "category": "Test Category",
            "available": True,
            "stock_quantity": 100
        }
        
        success, create_data = self.run_test("Create Item", "POST", "/api/items", 
                                           expected_status=200, data=test_item)
        
        created_item_id = None
        if success and create_data:
            created_item_id = create_data.get('id')
            print(f"   Created item ID: {created_item_id}")
            
            # Test get specific item
            if created_item_id:
                self.run_test("Get Item Details", "GET", f"/api/items/{created_item_id}")
                
                # Test update item
                update_data = {"price": 19.99, "available": False}
                self.run_test("Update Item", "PATCH", f"/api/items/{created_item_id}", 
                            expected_status=200, data=update_data)
                
                # Test toggle availability
                self.run_test("Toggle Item Availability", "PATCH", 
                            f"/api/items/{created_item_id}/availability", 
                            params={"available": "true"})
        
        return created_item_id

    def test_promotions_module(self):
        """Test Module 4: Promotions"""
        print("\n" + "="*60)
        print("🏷️ TESTING MODULE 4: PROMOTIONS")
        print("="*60)
        
        # Test list promotions
        success, promos_data = self.run_test("List Promotions", "GET", "/api/promotions")
        if success:
            promos = promos_data.get('promotions', [])
            print(f"   Found {len(promos)} promotions")
        
        # Test create promotion
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=7)
        
        test_promo = {
            "name": f"Test Promotion {datetime.now().strftime('%H%M%S')}",
            "description": "Promotion created during API testing",
            "promotion_type": "PERCENTAGE",
            "discount_percentage": 15.0,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "item_ids": []
        }
        
        success, create_data = self.run_test("Create Promotion", "POST", "/api/promotions", 
                                           expected_status=200, data=test_promo)
        
        created_promo_id = None
        if success and create_data:
            created_promo_id = create_data.get('id')
            print(f"   Created promotion ID: {created_promo_id}")
            
            if created_promo_id:
                # Test get specific promotion
                self.run_test("Get Promotion Details", "GET", f"/api/promotions/{created_promo_id}")
                
                # Test toggle promotion
                self.run_test("Toggle Promotion", "PATCH", 
                            f"/api/promotions/{created_promo_id}/toggle", 
                            params={"active": "false"})
        
        return created_promo_id

    def test_picking_module(self):
        """Test Module 5: Picking (requires existing order)"""
        print("\n" + "="*60)
        print("📋 TESTING MODULE 5: PICKING")
        print("="*60)
        
        # Note: Picking operations require existing orders
        # We'll test the endpoints but expect 404s if no orders exist
        
        fake_order_id = "test-order-123"
        
        # These will likely fail with 404, but we test the endpoints
        self.run_test("Start Picking", "POST", f"/api/picking/{fake_order_id}/start", 
                     expected_status=404)
        self.run_test("End Picking", "POST", f"/api/picking/{fake_order_id}/end", 
                     expected_status=404)
        
        # Test item operations during picking
        test_item_data = {"name": "Test Item", "quantity": 1}
        self.run_test("Add Picking Item", "POST", f"/api/picking/{fake_order_id}/items", 
                     expected_status=404, data=test_item_data)

    def test_metrics_financial_module(self):
        """Test Module 6: Metrics/Financial"""
        print("\n" + "="*60)
        print("📊 TESTING MODULE 6: METRICS/FINANCIAL")
        print("="*60)
        
        # Test dashboard metrics
        success, metrics_data = self.run_test("Dashboard Metrics", "GET", "/api/metrics/dashboard")
        if success:
            metrics = metrics_data
            print(f"   Total Orders Today: {metrics.get('total_orders_today', 0)}")
            print(f"   Total Revenue: R$ {metrics.get('total_revenue_today', 0):.2f}")
            print(f"   Pending Orders: {metrics.get('pending_orders', 0)}")
        
        # Test orders by hour
        self.run_test("Orders by Hour", "GET", "/api/metrics/orders-by-hour")
        
        # Test summary
        self.run_test("Summary (7 days)", "GET", "/api/metrics/summary", params={"days": 7})
        self.run_test("Summary (30 days)", "GET", "/api/metrics/summary", params={"days": 30})

    def test_polling_system(self):
        """Test Polling System"""
        print("\n" + "="*60)
        print("🔄 TESTING POLLING SYSTEM")
        print("="*60)
        
        # Test polling status
        success, status_data = self.run_test("Polling Status", "GET", "/api/polling/status")
        if success:
            print(f"   Polling Active: {status_data.get('polling_active', False)}")
            print(f"   Connection Status: {status_data.get('connection_status', 'unknown')}")
        
        # Test start polling
        self.run_test("Start Polling", "POST", "/api/polling/start")
        
        # Test force polling
        self.run_test("Force Polling", "POST", "/api/polling/force")
        
        # Test stop polling
        self.run_test("Stop Polling", "POST", "/api/polling/stop")

    def test_additional_endpoints(self):
        """Test additional endpoints"""
        print("\n" + "="*60)
        print("🔧 TESTING ADDITIONAL ENDPOINTS")
        print("="*60)
        
        # Test events
        self.run_test("List Events", "GET", "/api/events")
        
        # Test merchant info
        self.run_test("Merchant Info", "GET", "/api/merchant")
        self.run_test("Merchant Status", "GET", "/api/merchant/status")

    def cleanup_test_data(self, item_id: Optional[str], promo_id: Optional[str]):
        """Clean up test data"""
        print("\n" + "="*60)
        print("🧹 CLEANING UP TEST DATA")
        print("="*60)
        
        if item_id:
            self.run_test("Delete Test Item", "DELETE", f"/api/items/{item_id}")
        
        if promo_id:
            self.run_test("Delete Test Promotion", "DELETE", f"/api/promotions/{promo_id}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting iFood Partner Dashboard Backend API Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run all test modules
        self.test_health_endpoints()
        auth_success, token_data = self.test_authentication_module()
        self.test_orders_module()
        created_item_id = self.test_items_module()
        created_promo_id = self.test_promotions_module()
        self.test_picking_module()
        self.test_metrics_financial_module()
        self.test_polling_system()
        self.test_additional_endpoints()
        
        # Cleanup
        self.cleanup_test_data(created_item_id, created_promo_id)
        
        # Print final results
        self.print_results()
        
        return self.tests_passed == self.tests_run

    def print_results(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("📊 TEST RESULTS SUMMARY")
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
        
        print("="*60)

def main():
    """Main test execution"""
    tester = IFoodDashboardTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())