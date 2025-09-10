/**
 * Node.js Tutorial HTTP Server - Security Headers Utility Component
 * 
 * Security headers utility component that applies essential HTTP security headers to protect against 
 * common web vulnerabilities. Implements standardized security headers including Content-Type protection, 
 * clickjacking prevention, and XSS mitigation while maintaining zero external dependencies and educational 
 * clarity for the Node.js tutorial application.
 * 
 * This module provides comprehensive HTTP security header application with configurable policies and 
 * validation capabilities for web application protection, following OWASP security principles while 
 * maintaining educational simplicity and appropriate security controls.
 * 
 * Educational Features:
 * - Demonstrates fundamental web security concepts through practical security header implementation
 * - Shows security header application without external security libraries
 * - Implements industry-standard security practices including MIME sniffing and clickjacking prevention
 * - Provides educational context about vulnerabilities each header prevents
 * - Demonstrates configurable security policies with validation
 * 
 * Dependencies: Node.js built-in modules only (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import security configuration including default security headers and protection mechanisms
import { serverConfig } from '../config/server-config.js';

// Import logging functionality for security header application events and security monitoring
import { logger } from '../lib/logger.js';

// Import environment configuration for security header behavior and environment-specific settings
import { config } from '../config/environment.js';

// Global security headers constants with industry standard values for web application protection
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',                    // Prevents MIME type sniffing attacks
    'X-Frame-Options': 'DENY',                             // Prevents clickjacking attacks through iframe denial
    'X-XSS-Protection': '0',                               // Disabled to prevent XSS filter bypass vulnerabilities
    'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevents sensitive content caching
    'Pragma': 'no-cache',                                  // HTTP/1.0 cache control compatibility
    'Expires': '0'                                         // Ensures immediate content expiration
};

// Educational descriptions for each security header explaining purpose and security benefit
const HEADER_DESCRIPTIONS = {
    'X-Content-Type-Options': 'Prevents MIME type sniffing attacks that could lead to content type confusion',
    'X-Frame-Options': 'Prevents clickjacking attacks by denying page embedding in frames or iframes',
    'X-XSS-Protection': 'Disabled to prevent XSS filter bypass attacks in legacy browsers',
    'Cache-Control': 'Prevents sensitive content from being cached by browsers or intermediaries',
    'Pragma': 'Provides HTTP/1.0 cache control compatibility for legacy systems',
    'Expires': 'Ensures immediate content expiration to prevent any form of caching'
};

// Security policy configuration for header application behavior and customization
const SECURITY_POLICIES = {
    contentTypeProtection: true,        // Enable MIME type sniffing protection
    clickjackingProtection: true,       // Enable clickjacking attack prevention
    cacheControlEnabled: true,          // Enable comprehensive cache control
    strictTransportSecurity: false     // HTTPS not required for tutorial application
};

/**
 * Main function that applies essential security headers to HTTP responses for protection against 
 * common web vulnerabilities including MIME sniffing, clickjacking, and XSS attacks
 * @param {Object} res - HTTP ServerResponse object to apply security headers to
 * @param {Object} options - Optional configuration object to override default security header settings
 * @returns {Object} HTTP ServerResponse object with security headers applied for method chaining
 */
export function applySecurityHeaders(res, options = {}) {
    try {
        // Load security header configuration from server config and environment settings
        const securityConfig = serverConfig.security || {};
        const environmentConfig = config.server || {};
        
        // Validate HTTP response object is in writable state for header modification
        if (!res || typeof res.setHeader !== 'function') {
            logger.error('Invalid response object provided to applySecurityHeaders', { 
                responseObject: typeof res 
            });
            throw new Error('Invalid HTTP ServerResponse object provided');
        }

        if (res.headersSent) {
            logger.warn('Cannot apply security headers - headers already sent', {
                url: res.req?.url,
                method: res.req?.method
            });
            return res;
        }

        // Apply X-Content-Type-Options header to 'nosniff' for MIME type protection
        if (SECURITY_POLICIES.contentTypeProtection) {
            setContentTypeProtection(res);
        }

        // Set X-Frame-Options header to 'DENY' for clickjacking prevention
        if (SECURITY_POLICIES.clickjackingProtection) {
            setClickjackingProtection(res);
        }

        // Configure X-XSS-Protection header to '0' to disable problematic XSS filtering
        res.setHeader('X-XSS-Protection', SECURITY_HEADERS['X-XSS-Protection']);

        // Add Cache-Control headers to prevent sensitive content caching
        if (SECURITY_POLICIES.cacheControlEnabled) {
            setCacheControlHeaders(res);
        }

        // Apply any custom security headers from options parameter if provided
        if (options.customHeaders && typeof options.customHeaders === 'object') {
            Object.entries(options.customHeaders).forEach(([headerName, headerValue]) => {
                if (headerName && headerValue) {
                    res.setHeader(headerName, headerValue);
                    logger.debug('Applied custom security header', { 
                        header: headerName, 
                        value: headerValue 
                    });
                }
            });
        }

        // Calculate applied header count for monitoring
        const appliedHeaders = Object.keys(SECURITY_HEADERS).filter(headerName => 
            res.getHeader(headerName) !== undefined
        );

        // Log security header application with header count and response correlation
        logger.info('Security headers applied successfully', {
            appliedHeaderCount: appliedHeaders.length,
            headers: appliedHeaders,
            requestUrl: res.req?.url,
            requestMethod: res.req?.method,
            customHeadersCount: options.customHeaders ? Object.keys(options.customHeaders).length : 0
        });

        // Return response object with all security headers applied for method chaining
        return res;

    } catch (error) {
        // Log security header application error with full context for debugging
        logger.error('Failed to apply security headers', {
            error: {
                message: error.message,
                stack: error.stack
            },
            requestUrl: res.req?.url,
            requestMethod: res.req?.method,
            responseHeadersSent: res.headersSent
        });

        // Return response object even on error to prevent request processing failure
        return res;
    }
}

/**
 * Sets X-Content-Type-Options header to prevent MIME type sniffing attacks that could lead 
 * to content type confusion vulnerabilities
 * @param {Object} res - HTTP ServerResponse object to apply content type protection
 * @returns {Object} HTTP ServerResponse object with content type protection header set
 */
export function setContentTypeProtection(res) {
    try {
        // Check if response headers are still modifiable
        if (res.headersSent) {
            logger.warn('Cannot set content type protection - headers already sent');
            return res;
        }

        // Set X-Content-Type-Options header to 'nosniff' value
        res.setHeader('X-Content-Type-Options', SECURITY_HEADERS['X-Content-Type-Options']);

        // Log content type protection application for security monitoring
        logger.debug('Content type protection applied', {
            header: 'X-Content-Type-Options',
            value: SECURITY_HEADERS['X-Content-Type-Options'],
            protection: 'MIME type sniffing prevention'
        });

        // Return response object for method chaining
        return res;

    } catch (error) {
        logger.error('Failed to set content type protection header', {
            error: error.message,
            headerName: 'X-Content-Type-Options'
        });
        return res;
    }
}

/**
 * Sets X-Frame-Options header to prevent clickjacking attacks by denying the page from 
 * being embedded in frames or iframes
 * @param {Object} res - HTTP ServerResponse object to apply clickjacking protection
 * @returns {Object} HTTP ServerResponse object with clickjacking protection header set
 */
export function setClickjackingProtection(res) {
    try {
        // Validate response object allows header modification
        if (res.headersSent) {
            logger.warn('Cannot set clickjacking protection - headers already sent');
            return res;
        }

        // Set X-Frame-Options header to 'DENY' for maximum protection
        res.setHeader('X-Frame-Options', SECURITY_HEADERS['X-Frame-Options']);

        // Log clickjacking protection application for security audit
        logger.debug('Clickjacking protection applied', {
            header: 'X-Frame-Options',
            value: SECURITY_HEADERS['X-Frame-Options'],
            protection: 'Frame embedding denial'
        });

        // Return response object with protection applied
        return res;

    } catch (error) {
        logger.error('Failed to set clickjacking protection header', {
            error: error.message,
            headerName: 'X-Frame-Options'
        });
        return res;
    }
}

/**
 * Sets comprehensive cache control headers to prevent sensitive content from being cached 
 * by browsers, proxies, or intermediaries
 * @param {Object} res - HTTP ServerResponse object to apply cache control headers
 * @returns {Object} HTTP ServerResponse object with cache control headers applied
 */
export function setCacheControlHeaders(res) {
    try {
        // Check response state before applying headers
        if (res.headersSent) {
            logger.warn('Cannot set cache control headers - headers already sent');
            return res;
        }

        // Set Cache-Control header with no-cache, no-store, and must-revalidate directives
        res.setHeader('Cache-Control', SECURITY_HEADERS['Cache-Control']);

        // Add Pragma header set to 'no-cache' for HTTP/1.0 compatibility
        res.setHeader('Pragma', SECURITY_HEADERS['Pragma']);

        // Set Expires header to '0' to ensure immediate expiration
        res.setHeader('Expires', SECURITY_HEADERS['Expires']);

        // Log cache control header application for security tracking
        logger.debug('Cache control headers applied', {
            headers: {
                'Cache-Control': SECURITY_HEADERS['Cache-Control'],
                'Pragma': SECURITY_HEADERS['Pragma'],
                'Expires': SECURITY_HEADERS['Expires']
            },
            protection: 'Content caching prevention'
        });

        // Return response object with comprehensive cache prevention
        return res;

    } catch (error) {
        logger.error('Failed to set cache control headers', {
            error: error.message,
            headerNames: ['Cache-Control', 'Pragma', 'Expires']
        });
        return res;
    }
}

/**
 * Validates that required security headers are present and correctly configured on HTTP responses 
 * for security compliance verification
 * @param {Object} res - HTTP ServerResponse object to validate security headers
 * @returns {Object} Validation result object with compliance status and missing headers information
 */
export function validateSecurityHeaders(res) {
    try {
        // Extract current headers from HTTP response object
        const currentHeaders = {};
        if (res && typeof res.getHeaders === 'function') {
            const headers = res.getHeaders();
            Object.keys(headers).forEach(key => {
                currentHeaders[key.toLowerCase()] = headers[key];
            });
        }

        // Check presence of required security headers against configuration
        const requiredHeaders = Object.keys(SECURITY_HEADERS);
        const presentHeaders = [];
        const missingHeaders = [];
        const incorrectHeaders = [];

        requiredHeaders.forEach(headerName => {
            const normalizedHeaderName = headerName.toLowerCase();
            const expectedValue = SECURITY_HEADERS[headerName];

            if (currentHeaders[normalizedHeaderName]) {
                presentHeaders.push(headerName);
                
                // Validate header values match expected security policy settings
                if (currentHeaders[normalizedHeaderName] !== expectedValue) {
                    incorrectHeaders.push({
                        header: headerName,
                        expected: expectedValue,
                        actual: currentHeaders[normalizedHeaderName]
                    });
                }
            } else {
                missingHeaders.push(headerName);
            }
        });

        // Identify any missing or misconfigured security headers
        const isCompliant = missingHeaders.length === 0 && incorrectHeaders.length === 0;
        
        // Generate validation report with compliance status and recommendations
        const validationResult = {
            compliant: isCompliant,
            totalRequiredHeaders: requiredHeaders.length,
            presentHeaders: presentHeaders.length,
            missingHeaders: missingHeaders,
            incorrectHeaders: incorrectHeaders,
            compliance: {
                contentTypeProtection: currentHeaders['x-content-type-options'] === 'nosniff',
                clickjackingProtection: currentHeaders['x-frame-options'] === 'DENY',
                cacheControlEnabled: currentHeaders['cache-control']?.includes('no-cache'),
                xssProtectionDisabled: currentHeaders['x-xss-protection'] === '0'
            },
            recommendations: []
        };

        // Add specific recommendations for missing or incorrect headers
        if (missingHeaders.length > 0) {
            validationResult.recommendations.push(`Apply missing security headers: ${missingHeaders.join(', ')}`);
        }
        
        if (incorrectHeaders.length > 0) {
            validationResult.recommendations.push('Correct header values to match security policy requirements');
        }

        // Log validation results for security monitoring and compliance tracking
        logger.info('Security header validation completed', {
            compliant: isCompliant,
            presentHeaders: presentHeaders.length,
            missingHeaders: missingHeaders.length,
            incorrectHeaders: incorrectHeaders.length,
            requestUrl: res.req?.url
        });

        if (!isCompliant) {
            logger.warn('Security headers not fully compliant', {
                missingHeaders: missingHeaders,
                incorrectHeaders: incorrectHeaders
            });
        }

        // Return comprehensive validation result with remediation suggestions
        return validationResult;

    } catch (error) {
        logger.error('Failed to validate security headers', {
            error: error.message,
            stack: error.stack
        });

        return {
            compliant: false,
            error: true,
            errorMessage: error.message,
            totalRequiredHeaders: Object.keys(SECURITY_HEADERS).length,
            presentHeaders: 0,
            missingHeaders: Object.keys(SECURITY_HEADERS),
            incorrectHeaders: [],
            recommendations: ['Resolve validation error and retry header validation']
        };
    }
}

/**
 * Returns detailed information about available security headers including descriptions, purposes, 
 * and educational context for learning
 * @returns {Object} Security headers information object with descriptions and educational content
 */
export function getSecurityHeadersInfo() {
    try {
        // Compile information about each available security header
        const headerInfo = {};
        
        Object.keys(SECURITY_HEADERS).forEach(headerName => {
            headerInfo[headerName] = {
                value: SECURITY_HEADERS[headerName],
                description: HEADER_DESCRIPTIONS[headerName],
                category: getHeaderCategory(headerName),
                vulnerabilityPrevented: getVulnerabilityPrevented(headerName),
                educationalNote: getEducationalNote(headerName),
                rfcReference: getRfcReference(headerName),
                browserSupport: getBrowserSupport(headerName)
            };
        });

        // Include header purpose and security benefit descriptions
        const securityInfo = {
            headers: headerInfo,
            policies: SECURITY_POLICIES,
            summary: {
                totalHeaders: Object.keys(SECURITY_HEADERS).length,
                protectionCategories: [
                    'MIME Type Sniffing Prevention',
                    'Clickjacking Attack Prevention', 
                    'XSS Filter Bypass Prevention',
                    'Content Caching Prevention'
                ],
                complianceStandards: [
                    'OWASP Security Headers',
                    'Mozilla Web Security Guidelines',
                    'RFC HTTP Security Standards'
                ]
            },
            
            // Add educational context about vulnerabilities each header prevents
            vulnerabilities: {
                mimeSniffing: {
                    description: 'MIME type sniffing attacks exploit browser content type detection',
                    prevention: 'X-Content-Type-Options: nosniff',
                    severity: 'Medium'
                },
                clickjacking: {
                    description: 'Clickjacking tricks users into clicking hidden or disguised elements',
                    prevention: 'X-Frame-Options: DENY',
                    severity: 'High'
                },
                xssFilterBypass: {
                    description: 'XSS filter bypass exploits browser XSS protection mechanisms',
                    prevention: 'X-XSS-Protection: 0 (disabled)',
                    severity: 'Medium'
                },
                cachePoisoning: {
                    description: 'Cache poisoning exposes sensitive content through caching',
                    prevention: 'Cache-Control, Pragma, Expires headers',
                    severity: 'Medium'
                }
            },
            
            // Include configuration options and customization possibilities
            configuration: {
                defaultPolicies: SECURITY_POLICIES,
                customizationOptions: [
                    'Custom header values through options parameter',
                    'Per-endpoint policy configuration',
                    'Environment-specific header settings',
                    'Dynamic header value generation'
                ],
                bestPractices: [
                    'Apply security headers to all HTTP responses',
                    'Validate header presence and correctness regularly',
                    'Monitor security header compliance in logs',
                    'Update header values based on security recommendations'
                ]
            }
        };

        // Log information request for educational tracking
        logger.debug('Security headers information requested', {
            totalHeaders: Object.keys(SECURITY_HEADERS).length,
            requestTimestamp: new Date().toISOString()
        });

        // Return comprehensive information object for educational use
        return securityInfo;

    } catch (error) {
        logger.error('Failed to generate security headers information', {
            error: error.message
        });

        return {
            error: true,
            errorMessage: error.message,
            headers: {},
            summary: {
                totalHeaders: 0,
                protectionCategories: [],
                complianceStandards: []
            }
        };
    }
}

/**
 * Security headers management class that provides comprehensive HTTP security header application 
 * with configurable policies and validation capabilities for web application protection
 */
export class SecurityHeaders {
    /**
     * Initializes security headers manager with configuration, logging, and policy setup for 
     * consistent security header application
     * @param {Object} options - Configuration options including security policies and custom header settings
     */
    constructor(options = {}) {
        try {
            // Load security header configuration from server config and environment
            this.config = {
                ...serverConfig.security,
                ...config.server,
                ...options
            };

            // Initialize logger instance for security event tracking and monitoring
            this.logger = logger;

            // Configure security policies based on environment and application requirements
            this.securityPolicies = {
                ...SECURITY_POLICIES,
                ...options.policies
            };

            // Set up header descriptions and educational information
            this.headerDescriptions = { ...HEADER_DESCRIPTIONS };

            // Initialize validation rules and compliance checking capabilities
            this.validationRules = {
                requiredHeaders: Object.keys(SECURITY_HEADERS),
                headerValues: { ...SECURITY_HEADERS },
                customValidation: options.customValidation || {}
            };

            // Configure custom header options and policy overrides if provided
            this.customHeaders = options.customHeaders || {};

            this.logger.info('SecurityHeaders instance initialized', {
                policiesEnabled: Object.keys(this.securityPolicies).filter(key => this.securityPolicies[key]).length,
                customHeadersCount: Object.keys(this.customHeaders).length,
                validationRulesCount: this.validationRules.requiredHeaders.length
            });

        } catch (error) {
            this.logger.error('Failed to initialize SecurityHeaders instance', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Applies configured security headers to HTTP response with policy compliance and validation
     * @param {Object} res - HTTP ServerResponse object to apply security headers
     * @param {Object} customOptions - Optional custom header settings to override defaults
     * @returns {Object} HTTP ServerResponse object with security headers applied
     */
    apply(res, customOptions = {}) {
        try {
            // Validate response object is in writable state for header modification
            if (!res || typeof res.setHeader !== 'function') {
                this.logger.error('Invalid response object provided to SecurityHeaders.apply');
                throw new Error('Invalid HTTP ServerResponse object provided');
            }

            if (res.headersSent) {
                this.logger.warn('Cannot apply security headers - headers already sent');
                return res;
            }

            // Load applicable security headers based on configured policies
            const headersToApply = {};
            
            if (this.securityPolicies.contentTypeProtection) {
                headersToApply['X-Content-Type-Options'] = SECURITY_HEADERS['X-Content-Type-Options'];
            }
            
            if (this.securityPolicies.clickjackingProtection) {
                headersToApply['X-Frame-Options'] = SECURITY_HEADERS['X-Frame-Options'];
            }
            
            if (this.securityPolicies.cacheControlEnabled) {
                headersToApply['Cache-Control'] = SECURITY_HEADERS['Cache-Control'];
                headersToApply['Pragma'] = SECURITY_HEADERS['Pragma'];
                headersToApply['Expires'] = SECURITY_HEADERS['Expires'];
            }

            // Always apply XSS protection header (disabled)
            headersToApply['X-XSS-Protection'] = SECURITY_HEADERS['X-XSS-Protection'];

            // Apply content type protection headers for MIME sniffing prevention
            // Set clickjacking protection headers based on policy configuration
            // Apply cache control headers for sensitive content protection
            Object.entries(headersToApply).forEach(([headerName, headerValue]) => {
                res.setHeader(headerName, headerValue);
            });

            // Include any custom security headers from options parameter
            const mergedCustomHeaders = {
                ...this.customHeaders,
                ...customOptions.customHeaders
            };

            if (Object.keys(mergedCustomHeaders).length > 0) {
                Object.entries(mergedCustomHeaders).forEach(([headerName, headerValue]) => {
                    if (headerName && headerValue) {
                        res.setHeader(headerName, headerValue);
                    }
                });
            }

            // Validate all applied headers for policy compliance
            const validation = this.validate(res);

            // Log security header application with compliance status
            this.logger.info('SecurityHeaders applied successfully', {
                appliedHeaders: Object.keys(headersToApply).length,
                customHeaders: Object.keys(mergedCustomHeaders).length,
                compliant: validation.compliant,
                requestUrl: res.req?.url
            });

            // Return response object with complete security header protection
            return res;

        } catch (error) {
            this.logger.error('Failed to apply security headers', {
                error: error.message,
                requestUrl: res.req?.url
            });
            return res;
        }
    }

    /**
     * Validates HTTP response security headers for compliance with configured security policies 
     * and industry best practices
     * @param {Object} res - HTTP ServerResponse object to validate security headers
     * @returns {Object} Validation result with compliance status and security assessment
     */
    validate(res) {
        try {
            // Extract current security headers from HTTP response
            const currentHeaders = {};
            if (res && typeof res.getHeaders === 'function') {
                const headers = res.getHeaders();
                Object.keys(headers).forEach(key => {
                    currentHeaders[key.toLowerCase()] = headers[key];
                });
            }

            // Compare headers against configured security policy requirements
            const requiredHeaders = this.validationRules.requiredHeaders.filter(headerName => {
                const headerKey = headerName.toLowerCase();
                if (headerKey === 'x-content-type-options') return this.securityPolicies.contentTypeProtection;
                if (headerKey === 'x-frame-options') return this.securityPolicies.clickjackingProtection;
                if (headerKey.includes('cache') || headerKey === 'pragma' || headerKey === 'expires') {
                    return this.securityPolicies.cacheControlEnabled;
                }
                return true; // XSS protection always required
            });

            const validationResults = {
                compliant: true,
                checkedHeaders: 0,
                passedChecks: 0,
                failedChecks: [],
                securityScore: 0,
                recommendations: []
            };

            // Check header values for correct configuration and security effectiveness
            requiredHeaders.forEach(headerName => {
                const normalizedName = headerName.toLowerCase();
                const expectedValue = this.validationRules.headerValues[headerName];
                
                validationResults.checkedHeaders++;
                
                if (currentHeaders[normalizedName] === expectedValue) {
                    validationResults.passedChecks++;
                } else {
                    validationResults.compliant = false;
                    validationResults.failedChecks.push({
                        header: headerName,
                        expected: expectedValue,
                        actual: currentHeaders[normalizedName] || 'missing'
                    });
                }
            });

            // Calculate security score based on header compliance
            validationResults.securityScore = validationResults.checkedHeaders > 0 ? 
                Math.round((validationResults.passedChecks / validationResults.checkedHeaders) * 100) : 0;

            // Identify missing headers that should be present for security
            if (validationResults.failedChecks.length > 0) {
                validationResults.recommendations.push('Apply missing or incorrect security headers');
                validationResults.recommendations.push('Review security policy configuration');
            }

            // Assess overall security posture based on applied headers
            if (validationResults.securityScore < 80) {
                validationResults.recommendations.push('Security score below recommended threshold');
            }

            // Generate detailed validation report with recommendations
            const validationReport = {
                ...validationResults,
                timestamp: new Date().toISOString(),
                policies: this.securityPolicies,
                requestUrl: res.req?.url || 'unknown'
            };

            // Log validation results for security monitoring and compliance tracking
            this.logger.info('Security header validation completed', {
                compliant: validationResults.compliant,
                securityScore: validationResults.securityScore,
                failedChecks: validationResults.failedChecks.length,
                requestUrl: res.req?.url
            });

            return validationReport;

        } catch (error) {
            this.logger.error('Failed to validate security headers', {
                error: error.message
            });

            return {
                compliant: false,
                error: true,
                errorMessage: error.message,
                securityScore: 0,
                recommendations: ['Resolve validation error and retry']
            };
        }
    }

    /**
     * Updates security header policies and configuration for dynamic security policy management
     * @param {Object} newPolicy - Updated security policy configuration object
     * @returns {void} No return value - updates internal policy configuration
     */
    updatePolicy(newPolicy) {
        try {
            // Validate new policy configuration for consistency and security
            if (!newPolicy || typeof newPolicy !== 'object') {
                throw new Error('Invalid policy configuration provided');
            }

            const oldPolicies = { ...this.securityPolicies };

            // Update internal security policy settings with new configuration
            this.securityPolicies = {
                ...this.securityPolicies,
                ...newPolicy
            };

            // Reconfigure header application behavior based on updated policies
            if (newPolicy.customHeaders) {
                this.customHeaders = {
                    ...this.customHeaders,
                    ...newPolicy.customHeaders
                };
            }

            // Log policy update with changes and effective date
            this.logger.info('Security header policies updated', {
                previousPolicies: oldPolicies,
                newPolicies: this.securityPolicies,
                changedPolicies: Object.keys(newPolicy),
                effectiveDate: new Date().toISOString()
            });

            // Update validation rules to match new policy requirements
            this.validationRules.requiredHeaders = Object.keys(SECURITY_HEADERS).filter(headerName => {
                const headerKey = headerName.toLowerCase();
                if (headerKey === 'x-content-type-options') return this.securityPolicies.contentTypeProtection;
                if (headerKey === 'x-frame-options') return this.securityPolicies.clickjackingProtection;
                if (headerKey.includes('cache') || headerKey === 'pragma' || headerKey === 'expires') {
                    return this.securityPolicies.cacheControlEnabled;
                }
                return true;
            });

        } catch (error) {
            this.logger.error('Failed to update security header policies', {
                error: error.message,
                newPolicy: newPolicy
            });
            throw error;
        }
    }

    /**
     * Returns comprehensive information about security headers including educational content 
     * and configuration details
     * @returns {Object} Security headers information with descriptions and educational content
     */
    getInfo() {
        try {
            // Compile current security header configuration and policies
            const info = {
                configuration: {
                    policies: this.securityPolicies,
                    customHeaders: this.customHeaders,
                    validationRules: this.validationRules
                },
                
                // Include educational information about each security header purpose
                headers: {},
                
                // Add vulnerability descriptions that headers protect against
                vulnerabilities: {
                    mimeSniffing: 'MIME type sniffing can lead to content type confusion attacks',
                    clickjacking: 'Clickjacking tricks users into unintended actions',
                    xssFilterBypass: 'XSS filter bypass exploits browser protection mechanisms',
                    cachePoisoning: 'Cache poisoning can expose sensitive information'
                },
                
                // Include configuration examples and customization options
                examples: {
                    basicUsage: 'securityHeaders.apply(res)',
                    withCustomHeaders: 'securityHeaders.apply(res, { customHeaders: { "Custom-Header": "value" } })',
                    validation: 'const result = securityHeaders.validate(res)',
                    policyUpdate: 'securityHeaders.updatePolicy({ contentTypeProtection: false })'
                }
            };

            // Populate header information with descriptions and educational content
            Object.keys(SECURITY_HEADERS).forEach(headerName => {
                info.headers[headerName] = {
                    value: SECURITY_HEADERS[headerName],
                    description: this.headerDescriptions[headerName],
                    enabled: this.isHeaderEnabled(headerName),
                    purpose: getHeaderPurpose(headerName)
                };
            });

            this.logger.debug('Security headers information compiled', {
                totalHeaders: Object.keys(info.headers).length,
                enabledPolicies: Object.keys(this.securityPolicies).filter(key => this.securityPolicies[key]).length
            });

            // Return comprehensive information object for educational and documentation purposes
            return info;

        } catch (error) {
            this.logger.error('Failed to compile security headers information', {
                error: error.message
            });

            return {
                error: true,
                errorMessage: error.message,
                configuration: {},
                headers: {},
                vulnerabilities: {},
                examples: {}
            };
        }
    }

    /**
     * Checks if a specific security header is enabled based on current policies
     * @private
     * @param {string} headerName - Name of the header to check
     * @returns {boolean} True if header is enabled by current policies
     */
    isHeaderEnabled(headerName) {
        const headerKey = headerName.toLowerCase();
        if (headerKey === 'x-content-type-options') return this.securityPolicies.contentTypeProtection;
        if (headerKey === 'x-frame-options') return this.securityPolicies.clickjackingProtection;
        if (headerKey.includes('cache') || headerKey === 'pragma' || headerKey === 'expires') {
            return this.securityPolicies.cacheControlEnabled;
        }
        return true; // XSS protection always enabled
    }
}

// Helper functions for educational content generation

/**
 * Determines the security category for a given header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} Security category classification
 */
function getHeaderCategory(headerName) {
    if (headerName === 'X-Content-Type-Options') return 'Content Type Security';
    if (headerName === 'X-Frame-Options') return 'Clickjacking Protection';
    if (headerName === 'X-XSS-Protection') return 'XSS Protection';
    if (['Cache-Control', 'Pragma', 'Expires'].includes(headerName)) return 'Cache Security';
    return 'General Security';
}

/**
 * Gets the specific vulnerability prevented by a header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} Vulnerability type prevented
 */
function getVulnerabilityPrevented(headerName) {
    if (headerName === 'X-Content-Type-Options') return 'MIME Type Sniffing Attacks';
    if (headerName === 'X-Frame-Options') return 'Clickjacking Attacks';
    if (headerName === 'X-XSS-Protection') return 'XSS Filter Bypass';
    if (['Cache-Control', 'Pragma', 'Expires'].includes(headerName)) return 'Cache-based Information Disclosure';
    return 'Various Web Vulnerabilities';
}

/**
 * Provides educational notes about a security header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} Educational explanation
 */
function getEducationalNote(headerName) {
    if (headerName === 'X-Content-Type-Options') {
        return 'Prevents browsers from MIME-sniffing responses away from declared content type';
    }
    if (headerName === 'X-Frame-Options') {
        return 'Blocks page from being embedded in frames to prevent clickjacking';
    }
    if (headerName === 'X-XSS-Protection') {
        return 'Disabled to prevent XSS filter bypass vulnerabilities in modern browsers';
    }
    if (['Cache-Control', 'Pragma', 'Expires'].includes(headerName)) {
        return 'Prevents sensitive content from being cached by browsers or proxies';
    }
    return 'Provides additional security protection for web applications';
}

/**
 * Gets RFC reference information for a header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} RFC or specification reference
 */
function getRfcReference(headerName) {
    if (headerName === 'Cache-Control') return 'RFC 7234';
    if (headerName === 'Pragma') return 'RFC 7234';
    if (headerName === 'Expires') return 'RFC 7234';
    return 'Web Security Standards';
}

/**
 * Gets browser support information for a header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} Browser support status
 */
function getBrowserSupport(headerName) {
    if (['X-Content-Type-Options', 'X-Frame-Options'].includes(headerName)) {
        return 'Widely supported in modern browsers';
    }
    if (headerName === 'X-XSS-Protection') {
        return 'Legacy header - disabled for security reasons';
    }
    if (['Cache-Control', 'Pragma', 'Expires'].includes(headerName)) {
        return 'Universal browser support';
    }
    return 'Modern browser support';
}

/**
 * Gets the primary purpose of a security header
 * @private
 * @param {string} headerName - Name of the security header
 * @returns {string} Primary purpose description
 */
function getHeaderPurpose(headerName) {
    if (headerName === 'X-Content-Type-Options') return 'MIME type sniffing protection';
    if (headerName === 'X-Frame-Options') return 'Clickjacking attack prevention';
    if (headerName === 'X-XSS-Protection') return 'XSS filter bypass prevention';
    if (['Cache-Control', 'Pragma', 'Expires'].includes(headerName)) return 'Cache control and privacy protection';
    return 'Web application security enhancement';
}

// Create and export default security headers instance configured with environment settings
const securityHeaders = new SecurityHeaders({
    policies: SECURITY_POLICIES,
    customHeaders: {},
    environment: config.environment
});

// Export individual utility functions for granular security header management
export { setContentTypeProtection, setClickjackingProtection, setCacheControlHeaders, validateSecurityHeaders, getSecurityHeadersInfo };

// Export security headers constants for use by other components and testing
export { SECURITY_HEADERS };

// Export default security headers instance configured with environment settings
export { securityHeaders };

// Export the SecurityHeaders class for creating custom security header managers
export { SecurityHeaders };