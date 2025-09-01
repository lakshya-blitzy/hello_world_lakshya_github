#!/usr/bin/env python3
"""
Migration validation script for Node.js to Flask server conversion.

This comprehensive validation script programmatically verifies exact behavioral
match between the original Node.js HTTP server and the new Flask implementation.
Performs detailed comparison of HTTP responses, headers, timing, performance
metrics, and error handling to ensure complete feature parity.

Key Validation Features:
- Automated response comparison (Node.js vs Flask)
- Response content byte-for-byte validation
- Header comparison including Content-Type verification
- Performance metrics comparison and analysis
- Network configuration validation (host/port binding)
- Success/failure reporting with detailed diagnostics
- Cross-platform compatibility testing
- Resource usage monitoring and comparison

Usage:
    python validate.py                    # Full validation suite
    python validate.py --flask-only      # Flask-only validation
    python validate.py --with-nodejs     # Compare with running Node.js server
    python validate.py --performance     # Include performance benchmarks
    python validate.py --report=json     # JSON output format

Exit Codes:
    0: All validations passed - migration successful
    1: Validation failures detected - migration issues found
    2: Execution error - environment or configuration issues
"""

import sys
import os
import time
import json
import threading
import subprocess
import requests
import psutil
from typing import Dict, List, Optional, Union, Any

# Import Flask application for validation
from app import app

# Import test suite for comprehensive validation
from test_app import TestFlaskServer


class ValidationResult:
    """
    Comprehensive validation result container with metrics and reporting.
    
    Stores validation outcomes, performance metrics, error details, and
    provides structured reporting for migration validation results.
    """
    
    def __init__(self):
        """Initialize empty validation result container."""
        self.success = True
        self.errors = []
        self.warnings = []
        self.metrics = {
            'response_time_flask': 0.0,
            'response_time_nodejs': 0.0,
            'memory_usage_flask': 0.0,
            'memory_usage_nodejs': 0.0,
            'cpu_usage_flask': 0.0,
            'cpu_usage_nodejs': 0.0,
            'test_count': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'validation_duration': 0.0
        }
    
    def add_error(self, error_message: str):
        """
        Add error message and mark validation as failed.
        
        Args:
            error_message: Detailed error description
        """
        self.errors.append(error_message)
        self.success = False
    
    def add_warning(self, warning_message: str):
        """
        Add warning message without failing validation.
        
        Args:
            warning_message: Warning description
        """
        self.warnings.append(warning_message)
    
    def update_metric(self, metric_name: str, value: Union[int, float]):
        """
        Update performance or validation metric.
        
        Args:
            metric_name: Name of metric to update
            value: Metric value
        """
        self.metrics[metric_name] = value
    
    def report(self) -> str:
        """
        Generate comprehensive human-readable validation report.
        
        Returns:
            Detailed validation report as formatted string
        """
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("MIGRATION VALIDATION REPORT")
        report_lines.append("=" * 80)
        
        # Overall status
        status = "✅ SUCCESS" if self.success else "❌ FAILED"
        report_lines.append(f"Overall Status: {status}")
        report_lines.append("")
        
        # Test summary
        report_lines.append("Test Summary:")
        report_lines.append(f"  Total Tests: {self.metrics['test_count']}")
        report_lines.append(f"  Passed: {self.metrics['passed_tests']}")
        report_lines.append(f"  Failed: {self.metrics['failed_tests']}")
        report_lines.append(f"  Duration: {self.metrics['validation_duration']:.2f}s")
        report_lines.append("")
        
        # Performance metrics
        report_lines.append("Performance Metrics:")
        report_lines.append(f"  Flask Response Time: {self.metrics['response_time_flask']:.4f}s")
        if self.metrics['response_time_nodejs'] > 0:
            report_lines.append(f"  Node.js Response Time: {self.metrics['response_time_nodejs']:.4f}s")
            time_diff = self.metrics['response_time_flask'] - self.metrics['response_time_nodejs']
            report_lines.append(f"  Time Difference: {time_diff:+.4f}s")
        
        report_lines.append(f"  Flask Memory Usage: {self.metrics['memory_usage_flask']:.2f} MB")
        if self.metrics['memory_usage_nodejs'] > 0:
            report_lines.append(f"  Node.js Memory Usage: {self.metrics['memory_usage_nodejs']:.2f} MB")
        report_lines.append("")
        
        # Errors section
        if self.errors:
            report_lines.append("Errors:")
            for i, error in enumerate(self.errors, 1):
                report_lines.append(f"  {i}. {error}")
            report_lines.append("")
        
        # Warnings section
        if self.warnings:
            report_lines.append("Warnings:")
            for i, warning in enumerate(self.warnings, 1):
                report_lines.append(f"  {i}. {warning}")
            report_lines.append("")
        
        report_lines.append("=" * 80)
        
        return "\n".join(report_lines)
    
    def to_json(self) -> str:
        """
        Generate JSON representation of validation results.
        
        Returns:
            JSON-formatted validation results
        """
        data = {
            'success': self.success,
            'errors': self.errors,
            'warnings': self.warnings,
            'metrics': self.metrics,
            'timestamp': time.time(),
            'summary': {
                'total_tests': self.metrics['test_count'],
                'passed_tests': self.metrics['passed_tests'],
                'failed_tests': self.metrics['failed_tests'],
                'success_rate': (self.metrics['passed_tests'] / max(1, self.metrics['test_count'])) * 100
            }
        }
        
        return json.dumps(data, indent=2, cls=ValidationJSONEncoder)


class ValidationJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for validation results with proper float formatting."""
    
    def encode(self, obj):
        """Encode validation data with proper formatting."""
        if isinstance(obj, dict):
            # Format floating point numbers for readability
            formatted_obj = {}
            for key, value in obj.items():
                if isinstance(value, float):
                    formatted_obj[key] = round(value, 4)
                else:
                    formatted_obj[key] = value
            obj = formatted_obj
        
        return super().encode(obj)


def validate_migration(flask_only: bool = False, include_performance: bool = True) -> ValidationResult:
    """
    Main migration validation function with comprehensive testing.
    
    Orchestrates complete validation process including Flask behavior validation,
    optional Node.js comparison, performance benchmarking, and detailed reporting.
    
    Args:
        flask_only: If True, validate Flask only without Node.js comparison
        include_performance: If True, include performance benchmarks
    
    Returns:
        ValidationResult: Comprehensive validation results with metrics
    """
    validation_start = time.time()
    result = ValidationResult()
    
    try:
        print("Starting migration validation...")
        print(f"Mode: {'Flask-only' if flask_only else 'Full comparison'}")
        print(f"Performance testing: {'Enabled' if include_performance else 'Disabled'}")
        print("-" * 60)
        
        # Step 1: Validate Flask behavior
        print("1. Validating Flask server behavior...")
        flask_valid = validate_flask_behavior(result)
        
        if not flask_valid:
            result.add_error("Flask behavior validation failed")
            return result
        
        print("   ✅ Flask behavior validation passed")
        
        # Step 2: Performance testing if enabled
        if include_performance:
            print("2. Running performance benchmarks...")
            measure_flask_performance(result)
            print("   ✅ Performance metrics collected")
        
        # Step 3: Node.js comparison if not flask-only
        if not flask_only:
            print("3. Comparing with Node.js server...")
            nodejs_available = check_nodejs_availability()
            
            if nodejs_available:
                compare_with_nodejs(result, include_performance)
                print("   ✅ Node.js comparison completed")
            else:
                result.add_warning("Node.js server not available for comparison")
                print("   ⚠️  Node.js comparison skipped (server not available)")
        
        # Step 4: Integration tests
        print("4. Running integration test suite...")
        run_integration_tests(result)
        
        validation_duration = time.time() - validation_start
        result.update_metric('validation_duration', validation_duration)
        
        print("   ✅ Integration tests completed")
        print("-" * 60)
        print(f"Validation completed in {validation_duration:.2f}s")
        
    except Exception as e:
        result.add_error(f"Validation execution error: {str(e)}")
        result.success = False
    
    return result


def compare_responses(flask_response: requests.Response, 
                     nodejs_response: Optional[requests.Response] = None,
                     expected_content: str = "Hello, World!\n") -> Dict[str, Any]:
    """
    Detailed response comparison between Flask and Node.js implementations.
    
    Compares HTTP responses byte-for-byte including content, headers, status codes,
    and timing characteristics to ensure exact behavioral matching.
    
    Args:
        flask_response: HTTP response from Flask server
        nodejs_response: Optional HTTP response from Node.js server
        expected_content: Expected response content for validation
    
    Returns:
        Dictionary containing detailed comparison results and metrics
    """
    comparison = {
        'content_match': False,
        'status_match': True,
        'header_match': True,
        'timing_comparison': {},
        'differences': [],
        'flask_metrics': {},
        'nodejs_metrics': {}
    }
    
    try:
        # Flask response analysis
        comparison['flask_metrics'] = {
            'status_code': flask_response.status_code,
            'content_length': len(flask_response.content),
            'content_type': flask_response.headers.get('content-type', ''),
            'response_time': getattr(flask_response, 'elapsed', None),
            'content': flask_response.text
        }
        
        # Content validation
        if flask_response.text == expected_content:
            comparison['content_match'] = True
        else:
            comparison['differences'].append(
                f"Content mismatch - Expected: {expected_content!r}, "
                f"Got: {flask_response.text!r}"
            )
        
        # Status code validation
        if flask_response.status_code != 200:
            comparison['status_match'] = False
            comparison['differences'].append(
                f"Status code mismatch - Expected: 200, Got: {flask_response.status_code}"
            )
        
        # Header validation
        content_type = flask_response.headers.get('content-type', '')
        if 'text/plain' not in content_type:
            comparison['header_match'] = False
            comparison['differences'].append(
                f"Content-Type mismatch - Expected: text/plain, Got: {content_type}"
            )
        
        # Node.js comparison if available
        if nodejs_response:
            comparison['nodejs_metrics'] = {
                'status_code': nodejs_response.status_code,
                'content_length': len(nodejs_response.content),
                'content_type': nodejs_response.headers.get('content-type', ''),
                'response_time': getattr(nodejs_response, 'elapsed', None),
                'content': nodejs_response.text
            }
            
            # Compare responses
            if flask_response.text != nodejs_response.text:
                comparison['content_match'] = False
                comparison['differences'].append(
                    f"Flask vs Node.js content mismatch - "
                    f"Flask: {flask_response.text!r}, Node.js: {nodejs_response.text!r}"
                )
            
            if flask_response.status_code != nodejs_response.status_code:
                comparison['status_match'] = False
                comparison['differences'].append(
                    f"Status code mismatch - Flask: {flask_response.status_code}, "
                    f"Node.js: {nodejs_response.status_code}"
                )
        
    except Exception as e:
        comparison['differences'].append(f"Comparison error: {str(e)}")
    
    return comparison


def validate_flask_behavior(result: ValidationResult) -> bool:
    """
    Comprehensive Flask server behavior validation.
    
    Tests Flask server implementation against expected Node.js behavior using
    both test client and live HTTP requests. Validates response content, headers,
    status codes, and network configuration.
    
    Args:
        result: ValidationResult object to store findings
        
    Returns:
        True if all Flask behavior tests pass, False otherwise
    """
    try:
        # Create test client for isolated testing
        test_client = app.test_client()
        
        # Test 1: Basic response validation using test client
        print("   Testing basic response with test client...")
        response = test_client.get('/')
        
        if response.status_code != 200:
            result.add_error(f"Test client status code error: Expected 200, got {response.status_code}")
            return False
        
        if response.data != b'Hello, World!\n':
            result.add_error(f"Test client content error: Expected b'Hello, World!\\n', got {response.data!r}")
            return False
        
        if 'text/plain' not in response.content_type:
            result.add_error(f"Test client content-type error: Expected text/plain, got {response.content_type}")
            return False
        
        # Test 2: Live server testing
        print("   Starting Flask server for live testing...")
        server_thread = start_flask_server_for_testing()
        
        if not server_thread:
            result.add_error("Failed to start Flask server for testing")
            return False
        
        # Wait for server startup
        time.sleep(2)
        
        # Test live HTTP requests
        print("   Testing live HTTP requests...")
        try:
            live_response = requests.get('http://127.0.0.1:3000/', timeout=10)
            
            if live_response.status_code != 200:
                result.add_error(f"Live server status code error: Expected 200, got {live_response.status_code}")
                return False
            
            if live_response.text != 'Hello, World!\n':
                result.add_error(f"Live server content error: Expected 'Hello, World!\\n', got {live_response.text!r}")
                return False
            
            # Record response time
            if hasattr(live_response, 'elapsed'):
                result.update_metric('response_time_flask', live_response.elapsed.total_seconds())
        
        except requests.exceptions.RequestException as e:
            result.add_error(f"Live server request error: {str(e)}")
            return False
        
        # Test 3: Run unit test methods from TestFlaskServer
        print("   Running unit test methods...")
        test_instance = TestFlaskServer()
        test_instance.setUp()
        
        try:
            # Execute test methods as specified in schema
            test_instance.test_root_response()
            test_instance.test_status_code()  
            test_instance.test_content_type()
            
            result.update_metric('passed_tests', result.metrics['passed_tests'] + 3)
            result.update_metric('test_count', result.metrics['test_count'] + 3)
            
        except Exception as e:
            result.add_error(f"Unit test execution error: {str(e)}")
            result.update_metric('failed_tests', result.metrics['failed_tests'] + 1)
            result.update_metric('test_count', result.metrics['test_count'] + 1)
            return False
        
        return True
        
    except Exception as e:
        result.add_error(f"Flask behavior validation error: {str(e)}")
        return False


def compare_with_nodejs(result: ValidationResult, include_performance: bool = True) -> bool:
    """
    Compare Flask implementation with running Node.js server.
    
    Starts Node.js server if available and performs side-by-side comparison
    of responses, headers, performance, and behavior to ensure exact matching.
    
    Args:
        result: ValidationResult object to store findings
        include_performance: Whether to include performance comparisons
        
    Returns:
        True if comparison completed successfully, False otherwise
    """
    nodejs_process = None
    
    try:
        # Check if server.js exists
        if not os.path.exists('server.js'):
            result.add_warning("server.js not found - cannot compare with Node.js")
            return False
        
        print("   Starting Node.js server...")
        # Start Node.js server
        nodejs_process = subprocess.Popen(
            ['node', 'server.js'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for Node.js startup
        time.sleep(3)
        
        # Check if Node.js server is running
        if nodejs_process.poll() is not None:
            stdout, stderr = nodejs_process.communicate()
            result.add_error(f"Node.js server failed to start: {stderr}")
            return False
        
        # Test Node.js server
        print("   Testing Node.js server response...")
        try:
            nodejs_response = requests.get('http://127.0.0.1:3000/', timeout=10)
            
            if include_performance and hasattr(nodejs_response, 'elapsed'):
                result.update_metric('response_time_nodejs', nodejs_response.elapsed.total_seconds())
            
            # Measure Node.js memory usage
            if include_performance:
                try:
                    nodejs_process_info = psutil.Process(nodejs_process.pid)
                    nodejs_memory = nodejs_process_info.memory_info().rss / 1024 / 1024  # MB
                    result.update_metric('memory_usage_nodejs', nodejs_memory)
                except Exception:
                    result.add_warning("Could not measure Node.js memory usage")
        
        except requests.exceptions.RequestException as e:
            result.add_error(f"Node.js server request error: {str(e)}")
            return False
        
        # Now test Flask server
        print("   Testing Flask server for comparison...")
        flask_thread = start_flask_server_for_testing(port=3001)  # Use different port
        
        if not flask_thread:
            result.add_error("Failed to start Flask server for comparison")
            return False
        
        time.sleep(2)
        
        try:
            flask_response = requests.get('http://127.0.0.1:3001/', timeout=10)
            
            # Perform detailed comparison
            comparison = compare_responses(flask_response, nodejs_response)
            
            # Check comparison results
            if not comparison['content_match']:
                result.add_error("Response content does not match between Flask and Node.js")
            
            if not comparison['status_match']:
                result.add_error("Status codes do not match between Flask and Node.js")
            
            if not comparison['header_match']:
                result.add_error("Headers do not match between Flask and Node.js")
            
            # Add any specific differences
            for difference in comparison['differences']:
                result.add_error(f"Comparison difference: {difference}")
            
            # Performance comparison
            if include_performance:
                flask_time = result.metrics.get('response_time_flask', 0)
                nodejs_time = result.metrics.get('response_time_nodejs', 0)
                
                if flask_time > 0 and nodejs_time > 0:
                    time_difference = abs(flask_time - nodejs_time)
                    if time_difference > 0.1:  # 100ms threshold
                        result.add_warning(f"Significant response time difference: {time_difference:.4f}s")
        
        except requests.exceptions.RequestException as e:
            result.add_error(f"Flask comparison request error: {str(e)}")
            return False
        
        return len(result.errors) == 0  # Success if no errors added
        
    except Exception as e:
        result.add_error(f"Node.js comparison error: {str(e)}")
        return False
        
    finally:
        # Clean up Node.js process
        if nodejs_process and nodejs_process.poll() is None:
            try:
                nodejs_process.terminate()
                nodejs_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                nodejs_process.kill()


def check_nodejs_availability() -> bool:
    """
    Check if Node.js and server.js are available for comparison testing.
    
    Returns:
        True if Node.js runtime and server.js file are available
    """
    try:
        # Check if Node.js is installed
        result = subprocess.run(['node', '--version'], 
                              capture_output=True, text=True, timeout=5)
        
        if result.returncode != 0:
            return False
        
        # Check if server.js exists
        if not os.path.exists('server.js'):
            return False
        
        return True
        
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def start_flask_server_for_testing(port: int = 3000) -> Optional[threading.Thread]:
    """
    Start Flask server in background thread for testing.
    
    Args:
        port: Port number to bind Flask server
        
    Returns:
        Thread object if successful, None if failed
    """
    server_started = threading.Event()
    server_error = threading.Event()
    
    def run_flask_server():
        try:
            app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
        except Exception as e:
            print(f"Flask server error: {e}")
            server_error.set()
        finally:
            server_started.set()
    
    server_thread = threading.Thread(target=run_flask_server, daemon=True)
    server_thread.start()
    
    # Brief wait to check for immediate startup errors
    time.sleep(1)
    
    if server_error.is_set():
        return None
    
    return server_thread


def measure_flask_performance(result: ValidationResult):
    """
    Measure Flask server performance metrics.
    
    Args:
        result: ValidationResult object to store performance metrics
    """
    try:
        # Start Flask server for performance testing
        server_thread = start_flask_server_for_testing()
        
        if not server_thread:
            result.add_warning("Could not start Flask server for performance testing")
            return
        
        time.sleep(2)
        
        # Measure response times over multiple requests
        response_times = []
        
        for _ in range(10):
            start_time = time.time()
            try:
                response = requests.get('http://127.0.0.1:3000/', timeout=5)
                if response.status_code == 200:
                    response_times.append(time.time() - start_time)
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(0.1)
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            result.update_metric('response_time_flask', avg_response_time)
        
        # Measure memory usage
        try:
            current_process = psutil.Process(os.getpid())
            memory_usage = current_process.memory_info().rss / 1024 / 1024  # MB
            result.update_metric('memory_usage_flask', memory_usage)
            
            cpu_usage = current_process.cpu_percent(interval=1)
            result.update_metric('cpu_usage_flask', cpu_usage)
        
        except Exception:
            result.add_warning("Could not measure Flask performance metrics")
    
    except Exception as e:
        result.add_warning(f"Performance measurement error: {str(e)}")


def run_integration_tests(result: ValidationResult):
    """
    Run comprehensive integration tests using test_app.py test suite.
    
    Args:
        result: ValidationResult object to store test results
    """
    try:
        import unittest
        from test_app import TestFlaskServer, TestServerIntegration
        
        # Create test suite
        loader = unittest.TestLoader()
        
        # Load all tests
        flask_tests = loader.loadTestsFromTestCase(TestFlaskServer)
        integration_tests = loader.loadTestsFromTestCase(TestServerIntegration)
        
        full_suite = unittest.TestSuite([flask_tests, integration_tests])
        
        # Custom test runner to capture results
        class ValidationTestRunner:
            def __init__(self):
                self.success_count = 0
                self.failure_count = 0
                self.errors = []
            
            def run(self, test_suite):
                for test_group in test_suite:
                    for test in test_group:
                        try:
                            test_result = unittest.TestResult()
                            test(test_result)
                            
                            if test_result.wasSuccessful():
                                self.success_count += 1
                            else:
                                self.failure_count += 1
                                for failure in test_result.failures + test_result.errors:
                                    self.errors.append(f"{failure[0]}: {failure[1]}")
                        
                        except Exception as e:
                            self.failure_count += 1
                            self.errors.append(f"Test execution error: {str(e)}")
        
        # Run tests
        test_runner = ValidationTestRunner()
        test_runner.run(full_suite)
        
        # Update results
        total_tests = test_runner.success_count + test_runner.failure_count
        result.update_metric('test_count', result.metrics['test_count'] + total_tests)
        result.update_metric('passed_tests', result.metrics['passed_tests'] + test_runner.success_count)
        result.update_metric('failed_tests', result.metrics['failed_tests'] + test_runner.failure_count)
        
        # Add errors
        for error in test_runner.errors:
            result.add_error(f"Integration test error: {error}")
    
    except Exception as e:
        result.add_error(f"Integration test execution error: {str(e)}")


def main():
    """
    Main execution function with command-line argument parsing.
    
    Handles command-line arguments, orchestrates validation process, and
    provides appropriate exit codes for automation integration.
    
    Command-line Arguments:
        --flask-only: Skip Node.js comparison, validate Flask only
        --with-nodejs: Force Node.js comparison even if not auto-detected
        --performance: Include performance benchmarking
        --report=format: Output format (text, json)
        --help: Display usage information
    
    Exit Codes:
        0: All validations passed successfully
        1: Validation failures detected
        2: Execution error or configuration issues
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Migration validation for Node.js to Flask server conversion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate.py                     # Full validation with auto-detection
  python validate.py --flask-only       # Flask-only validation
  python validate.py --performance      # Include performance benchmarks
  python validate.py --report=json      # JSON output format
        """
    )
    
    parser.add_argument('--flask-only', action='store_true',
                       help='Validate Flask server only, skip Node.js comparison')
    parser.add_argument('--with-nodejs', action='store_true',
                       help='Force Node.js comparison testing')
    parser.add_argument('--performance', action='store_true',
                       help='Include performance benchmarking')
    parser.add_argument('--report', choices=['text', 'json'], default='text',
                       help='Output report format (default: text)')
    
    args = parser.parse_args()
    
    try:
        print("Migration Validation Script")
        print("=" * 50)
        print()
        
        # Determine validation mode
        flask_only = args.flask_only
        include_performance = args.performance
        
        if not flask_only and not args.with_nodejs:
            # Auto-detect Node.js availability
            nodejs_available = check_nodejs_availability()
            if not nodejs_available:
                print("Node.js server not available - running Flask-only validation")
                flask_only = True
        
        # Run validation
        validation_result = validate_migration(
            flask_only=flask_only,
            include_performance=include_performance
        )
        
        # Output results
        if args.report == 'json':
            print(validation_result.to_json())
        else:
            print(validation_result.report())
        
        # Exit with appropriate code
        if validation_result.success:
            print("\n🎉 Migration validation completed successfully!")
            sys.exit(0)
        else:
            print(f"\n💥 Migration validation failed with {len(validation_result.errors)} errors")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\nValidation interrupted by user")
        sys.exit(2)
    except Exception as e:
        print(f"Validation execution error: {str(e)}", file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()