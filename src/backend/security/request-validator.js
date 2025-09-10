// Node.js Tutorial HTTP Server - Security-Focused Request Validation Component
// Implements comprehensive input validation, security checks, and malicious request detection
// for HTTP requests with zero external dependencies and educational clarity

// Node.js built-in module imports with version comments
const url = require('node:url'); // Built-in Node.js URL module - stable
const util = require('node:util'); // Built-in Node.js utility module - stable

// Import internal modules for logging and configuration
const { logger } = require('../lib/logger.js');
const { config } = require('../config/environment.js');

// Global validation error constants for consistent error handling across components
const VALIDATION_ERRORS = {
    INVALID_METHOD: 'INVALID_METHOD',
    INVALID_PATH: 'INVALID_PATH', 
    PATH_TRAVERSAL: 'PATH_TRAVERSAL',
    INVALID_URL: 'INVALID_URL',
    REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
    INVALID_HEADERS: 'INVALID_HEADERS'
};

// Supported HTTP methods whitelist - only GET for educational tutorial security
const SUPPORTED_METHODS = ['GET'];

// Allowed URL paths whitelist - only /hello endpoint for tutorial scope
const ALLOWED_PATHS = ['/hello'];

// Security pattern detection regular expressions for threat identification
const SECURITY_PATTERNS = {
    PATH_TRAVERSAL: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/gi,
    NULL_BYTE: /\x00|%00/gi,
    CONTROL_CHARS: /[\x00-\x1f\x7f-\x9f]/gi,
    ENCODED_TRAVERSAL: /%252e%252e%252f|%252e%252e%255c/gi,
    SCRIPT_INJECTION: /<script|javascript:|vbscript:|onload=|onerror=/gi
};

// Maximum URL length to prevent DoS attacks and memory exhaustion
const MAX_URL_LENGTH = 2048;

// Maximum total header size for DoS protection
const MAX_HEADER_SIZE = 8192;

// Request validation timeout for performance monitoring (milliseconds)
const VALIDATION_TIMEOUT = 100;

// Maximum number of validation attempts per correlation ID
const MAX_VALIDATION_ATTEMPTS = 10;

/**
 * Main request validation function that performs comprehensive security validation
 * of HTTP requests including method, path, headers, and malicious content detection
 * @param {object} req - HTTP IncomingMessage object containing request details to validate
 * @returns {object} Validation result object with success flag, error type, error message, and security details
 */
function validateRequest(req) {
    const startTime = performance.now();
    const validationContext = createValidationContext(req);
    
    try {
        logger.info('Starting request validation', {
            method: req.method,
            url: req.url,
            correlationId: validationContext.correlationId
        });

        // Extract and normalize HTTP method for case-insensitive validation
        const method = req.method ? req.method.toUpperCase() : '';
        
        // Validate HTTP method against supported methods whitelist
        const methodValidation = validateMethod(method);
        if (!methodValidation.success) {
            logger.warn('Method validation failed', {
                method,
                error: methodValidation.error,
                correlationId: validationContext.correlationId
            });
            return {
                success: false,
                error: methodValidation.error,
                message: `Unsupported HTTP method: ${method}`,
                context: validationContext,
                duration: performance.now() - startTime
            };
        }

        // Parse and validate request URL using Node.js URL module with security checks
        const urlValidation = validateUrl(req.url, req.headers.host);
        if (!urlValidation.success) {
            logger.warn('URL validation failed', {
                url: req.url,
                error: urlValidation.error,
                correlationId: validationContext.correlationId
            });
            return {
                success: false,
                error: urlValidation.error,
                message: urlValidation.message,
                context: validationContext,
                duration: performance.now() - startTime
            };
        }

        // Validate URL path for security including path traversal and injection attempts
        const pathValidation = validatePath(urlValidation.parsedUrl.pathname);
        if (!pathValidation.success) {
            logger.warn('Path validation failed', {
                path: urlValidation.parsedUrl.pathname,
                error: pathValidation.error,
                threatLevel: pathValidation.threatLevel,
                correlationId: validationContext.correlationId
            });
            return {
                success: false,
                error: pathValidation.error,
                message: pathValidation.message,
                context: validationContext,
                securityThreat: pathValidation.threatLevel,
                duration: performance.now() - startTime
            };
        }

        // Validate request headers for size limits and format compliance
        const headerValidation = validateHeaders(req.headers);
        if (!headerValidation.success) {
            logger.warn('Header validation failed', {
                error: headerValidation.error,
                headerCount: Object.keys(req.headers).length,
                correlationId: validationContext.correlationId
            });
            return {
                success: false,
                error: headerValidation.error,
                message: headerValidation.message,
                context: validationContext,
                duration: performance.now() - startTime
            };
        }

        // Calculate validation duration for performance monitoring
        const duration = performance.now() - startTime;
        
        // Log successful validation for security monitoring
        logger.info('Request validation successful', {
            method,
            path: pathValidation.normalizedPath,
            duration: `${duration.toFixed(2)}ms`,
            correlationId: validationContext.correlationId
        });

        // Check for validation timeout warning
        if (duration > VALIDATION_TIMEOUT) {
            logger.warn('Validation timeout exceeded', {
                duration: `${duration.toFixed(2)}ms`,
                threshold: `${VALIDATION_TIMEOUT}ms`,
                correlationId: validationContext.correlationId
            });
        }

        return {
            success: true,
            context: validationContext,
            validatedData: {
                method,
                path: pathValidation.normalizedPath,
                url: urlValidation.parsedUrl,
                headers: headerValidation.sanitizedHeaders
            },
            duration
        };

    } catch (error) {
        const duration = performance.now() - startTime;
        
        logger.error('Request validation exception', {
            error: error.message,
            stack: error.stack,
            correlationId: validationContext.correlationId,
            duration: `${duration.toFixed(2)}ms`
        });

        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Internal validation error occurred',
            context: validationContext,
            duration
        };
    }
}

/**
 * Validates HTTP request method against whitelist of supported methods
 * for the tutorial application (GET only)
 * @param {string} method - HTTP method string from request object to validate
 * @returns {object} Method validation result with success flag and error details if validation fails
 */
function validateMethod(method) {
    try {
        // Handle null, undefined, or empty method values
        if (!method || typeof method !== 'string') {
            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_METHOD,
                message: 'HTTP method is required and must be a string',
                receivedMethod: method
            };
        }

        // Convert method to uppercase for case-insensitive comparison
        const normalizedMethod = method.trim().toUpperCase();
        
        // Log method validation attempt for security monitoring
        logger.info('Validating HTTP method', { method: normalizedMethod });

        // Check if method exists in SUPPORTED_METHODS array
        if (!SUPPORTED_METHODS.includes(normalizedMethod)) {
            logger.warn('Unsupported method attempted', {
                method: normalizedMethod,
                supportedMethods: SUPPORTED_METHODS,
                securityEvent: 'UNSUPPORTED_METHOD_ATTEMPT'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_METHOD,
                message: `Method '${normalizedMethod}' is not supported. Allowed methods: ${SUPPORTED_METHODS.join(', ')}`,
                receivedMethod: normalizedMethod,
                supportedMethods: SUPPORTED_METHODS
            };
        }

        return {
            success: true,
            method: normalizedMethod,
            message: `Method '${normalizedMethod}' validated successfully`
        };

    } catch (error) {
        logger.error('Method validation exception', { error: error.message, method });
        
        return {
            success: false,
            error: VALIDATION_ERRORS.INVALID_METHOD,
            message: 'Method validation failed due to internal error',
            exception: error.message
        };
    }
}

/**
 * Validates URL path for security vulnerabilities including path traversal attacks,
 * directory traversal, and malicious path patterns
 * @param {string} pathname - URL pathname string to validate for security issues
 * @returns {object} Path validation result with security status, normalized path, and threat detection
 */
function validatePath(pathname) {
    try {
        // Handle null, undefined, or empty pathname values
        if (pathname === null || pathname === undefined) {
            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_PATH,
                message: 'URL pathname is required',
                threatLevel: 'LOW'
            };
        }

        // Convert to string and normalize pathname to handle URL encoding variations
        const normalizedPath = pathname.toString().toLowerCase().trim();

        logger.info('Validating URL path', { 
            originalPath: pathname, 
            normalizedPath 
        });

        // Check pathname against SECURITY_PATTERNS for path traversal attempts
        for (const [patternName, pattern] of Object.entries(SECURITY_PATTERNS)) {
            if (pattern.test(pathname) || pattern.test(normalizedPath)) {
                logger.error('Security threat detected in path', {
                    path: pathname,
                    normalizedPath,
                    threatType: patternName,
                    pattern: pattern.source,
                    securityEvent: 'PATH_SECURITY_VIOLATION'
                });

                return {
                    success: false,
                    error: VALIDATION_ERRORS.PATH_TRAVERSAL,
                    message: `Security violation detected: ${patternName.toLowerCase().replace('_', ' ')}`,
                    threatLevel: 'HIGH',
                    threatType: patternName,
                    originalPath: pathname,
                    normalizedPath
                };
            }
        }

        // Validate pathname against ALLOWED_PATHS whitelist for exact matching
        if (!ALLOWED_PATHS.includes(pathname)) {
            logger.warn('Path not in allowed paths', {
                path: pathname,
                allowedPaths: ALLOWED_PATHS,
                securityEvent: 'UNAUTHORIZED_PATH_ACCESS'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_PATH,
                message: `Path '${pathname}' is not allowed. Allowed paths: ${ALLOWED_PATHS.join(', ')}`,
                threatLevel: 'MEDIUM',
                originalPath: pathname,
                normalizedPath,
                allowedPaths: ALLOWED_PATHS
            };
        }

        return {
            success: true,
            normalizedPath,
            originalPath: pathname,
            message: `Path '${pathname}' validated successfully`,
            threatLevel: 'NONE'
        };

    } catch (error) {
        logger.error('Path validation exception', { 
            error: error.message, 
            pathname,
            stack: error.stack 
        });
        
        return {
            success: false,
            error: VALIDATION_ERRORS.INVALID_PATH,
            message: 'Path validation failed due to internal error',
            threatLevel: 'UNKNOWN',
            exception: error.message
        };
    }
}

/**
 * Validates complete request URL including parsing, format validation,
 * and security assessment using Node.js URL module
 * @param {string} requestUrl - Complete URL string from HTTP request to validate
 * @param {string} host - Host header for URL construction
 * @returns {object} URL validation result with parsed URL components, security status, and validation errors
 */
function validateUrl(requestUrl, host = 'localhost') {
    try {
        // Handle null, undefined, or empty URL values
        if (!requestUrl || typeof requestUrl !== 'string') {
            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_URL,
                message: 'Request URL is required and must be a string',
                providedUrl: requestUrl
            };
        }

        // Check URL length against maximum allowed length limit
        if (requestUrl.length > MAX_URL_LENGTH) {
            logger.warn('URL length exceeds maximum allowed', {
                urlLength: requestUrl.length,
                maxLength: MAX_URL_LENGTH,
                securityEvent: 'OVERSIZED_URL_ATTEMPT'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.REQUEST_TOO_LARGE,
                message: `URL length ${requestUrl.length} exceeds maximum allowed ${MAX_URL_LENGTH}`,
                urlLength: requestUrl.length,
                maxLength: MAX_URL_LENGTH
            };
        }

        logger.info('Validating request URL', { 
            url: requestUrl, 
            length: requestUrl.length,
            host 
        });

        // Parse URL using Node.js URL module with error handling
        let parsedUrl;
        try {
            // Construct full URL if relative path provided
            const fullUrl = requestUrl.startsWith('/') ? 
                `http://${host || 'localhost'}${requestUrl}` : 
                requestUrl;
            
            parsedUrl = new url.URL(fullUrl);
        } catch (parseError) {
            logger.warn('URL parsing failed', {
                url: requestUrl,
                host,
                error: parseError.message,
                securityEvent: 'MALFORMED_URL_ATTEMPT'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_URL,
                message: `Invalid URL format: ${parseError.message}`,
                originalUrl: requestUrl,
                parseError: parseError.message
            };
        }

        // Extract and validate URL components for security issues
        const urlComponents = {
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            pathname: parsedUrl.pathname,
            search: parsedUrl.search,
            hash: parsedUrl.hash,
            href: parsedUrl.href
        };

        // Validate query parameters for security issues
        const queryValidation = validateQueryParameters(parsedUrl.search);
        if (!queryValidation.success) {
            logger.warn('Query parameter validation failed', {
                query: parsedUrl.search,
                error: queryValidation.error
            });

            return {
                success: false,
                error: queryValidation.error,
                message: queryValidation.message,
                urlComponents,
                queryError: queryValidation.details
            };
        }

        return {
            success: true,
            parsedUrl,
            urlComponents,
            originalUrl: requestUrl,
            message: 'URL validated successfully'
        };

    } catch (error) {
        logger.error('URL validation exception', { 
            error: error.message, 
            requestUrl,
            stack: error.stack 
        });
        
        return {
            success: false,
            error: VALIDATION_ERRORS.INVALID_URL,
            message: 'URL validation failed due to internal error',
            exception: error.message
        };
    }
}

/**
 * Validates HTTP request headers for size limits, format compliance,
 * and security issues including header injection attempts
 * @param {object} headers - HTTP headers object from request to validate
 * @returns {object} Header validation result with compliance status and security assessment
 */
function validateHeaders(headers) {
    try {
        // Handle null, undefined, or invalid headers object
        if (!headers || typeof headers !== 'object') {
            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_HEADERS,
                message: 'Headers object is required and must be an object',
                providedHeaders: headers
            };
        }

        logger.info('Validating request headers', { 
            headerCount: Object.keys(headers).length 
        });

        // Calculate total headers size for DoS protection
        const headersString = JSON.stringify(headers);
        const totalHeaderSize = Buffer.byteLength(headersString, 'utf8');

        if (totalHeaderSize > MAX_HEADER_SIZE) {
            logger.warn('Headers size exceeds maximum allowed', {
                totalSize: totalHeaderSize,
                maxSize: MAX_HEADER_SIZE,
                securityEvent: 'OVERSIZED_HEADERS_ATTEMPT'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.REQUEST_TOO_LARGE,
                message: `Headers size ${totalHeaderSize} bytes exceeds maximum allowed ${MAX_HEADER_SIZE} bytes`,
                totalSize: totalHeaderSize,
                maxSize: MAX_HEADER_SIZE
            };
        }

        // Validate individual header names and values for format compliance
        const sanitizedHeaders = {};
        const headerIssues = [];

        for (const [headerName, headerValue] of Object.entries(headers)) {
            const headerValidation = validateSingleHeader(headerName, headerValue);
            
            if (!headerValidation.success) {
                headerIssues.push({
                    header: headerName,
                    issue: headerValidation.error,
                    value: headerValue
                });
                
                logger.warn('Header validation issue', {
                    header: headerName,
                    issue: headerValidation.error,
                    securityEvent: 'HEADER_VALIDATION_ISSUE'
                });
            } else {
                sanitizedHeaders[headerName] = headerValidation.sanitizedValue;
            }
        }

        // Check for critical header issues that should fail validation
        const criticalIssues = headerIssues.filter(issue => 
            issue.issue === 'HEADER_INJECTION' || 
            issue.issue === 'MALICIOUS_CONTENT'
        );

        if (criticalIssues.length > 0) {
            logger.error('Critical header security issues detected', {
                criticalIssues,
                securityEvent: 'CRITICAL_HEADER_THREAT'
            });

            return {
                success: false,
                error: VALIDATION_ERRORS.INVALID_HEADERS,
                message: 'Critical header security violations detected',
                criticalIssues,
                allIssues: headerIssues
            };
        }

        return {
            success: true,
            sanitizedHeaders,
            totalSize: totalHeaderSize,
            headerCount: Object.keys(sanitizedHeaders).length,
            issues: headerIssues,
            message: 'Headers validated successfully'
        };

    } catch (error) {
        logger.error('Header validation exception', { 
            error: error.message,
            stack: error.stack 
        });
        
        return {
            success: false,
            error: VALIDATION_ERRORS.INVALID_HEADERS,
            message: 'Header validation failed due to internal error',
            exception: error.message
        };
    }
}

/**
 * Sanitizes request input by removing or escaping potentially dangerous
 * characters and patterns
 * @param {string} input - Input string to sanitize for security
 * @returns {string} Sanitized input string safe for processing
 */
function sanitizeInput(input) {
    try {
        // Handle null, undefined, or non-string inputs
        if (input === null || input === undefined) {
            return '';
        }

        if (typeof input !== 'string') {
            input = String(input);
        }

        let sanitized = input;

        // Remove null bytes and control characters from input
        sanitized = sanitized.replace(SECURITY_PATTERNS.NULL_BYTE, '');
        sanitized = sanitized.replace(SECURITY_PATTERNS.CONTROL_CHARS, '');

        // Remove path traversal sequences
        sanitized = sanitized.replace(SECURITY_PATTERNS.PATH_TRAVERSAL, '');
        sanitized = sanitized.replace(SECURITY_PATTERNS.ENCODED_TRAVERSAL, '');

        // Remove script injection attempts
        sanitized = sanitized.replace(SECURITY_PATTERNS.SCRIPT_INJECTION, '');

        // Handle URL encoding safely by normalizing percent encoding
        try {
            sanitized = decodeURIComponent(sanitized);
        } catch (decodeError) {
            // Keep original if decoding fails (malformed encoding)
            logger.warn('URL decoding failed during sanitization', {
                input,
                error: decodeError.message
            });
        }

        // Trim whitespace and limit length for additional safety
        sanitized = sanitized.trim();
        if (sanitized.length > MAX_URL_LENGTH) {
            sanitized = sanitized.substring(0, MAX_URL_LENGTH);
            logger.warn('Input truncated during sanitization', {
                originalLength: input.length,
                truncatedLength: sanitized.length
            });
        }

        return sanitized;

    } catch (error) {
        logger.error('Input sanitization exception', {
            error: error.message,
            input: input ? input.substring(0, 100) + '...' : input
        });
        
        // Return empty string as safe fallback
        return '';
    }
}

/**
 * Creates validation context object with request metadata for correlation
 * and security tracking across validation pipeline
 * @param {object} req - HTTP request object for context extraction
 * @returns {object} Validation context object with correlation ID, client information, and security metadata
 */
function createValidationContext(req) {
    try {
        // Generate unique validation correlation ID for tracking
        const correlationId = `val_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // Extract client IP address handling various proxy scenarios
        const clientIp = extractClientIp(req);
        
        // Extract user agent for security logging and pattern analysis
        const userAgent = req.headers && req.headers['user-agent'] ? 
            req.headers['user-agent'].substring(0, 200) : 'Unknown';
        
        // Capture request timestamp for audit trail and performance tracking
        const timestamp = new Date().toISOString();
        
        // Create context object with validation metadata
        const context = {
            correlationId,
            timestamp,
            clientInfo: {
                ip: clientIp,
                userAgent,
                forwarded: req.headers && req.headers['x-forwarded-for'] ? 
                    req.headers['x-forwarded-for'] : null
            },
            requestInfo: {
                method: req.method,
                url: req.url,
                httpVersion: req.httpVersion,
                headers: req.headers ? Object.keys(req.headers).length : 0
            },
            validationMetadata: {
                startTime: Date.now(),
                attempt: 1,
                ruleVersion: '1.0.0'
            }
        };

        logger.info('Validation context created', {
            correlationId,
            clientIp,
            method: req.method,
            url: req.url
        });

        return context;

    } catch (error) {
        logger.error('Validation context creation failed', {
            error: error.message,
            stack: error.stack
        });
        
        // Return minimal context as fallback
        return {
            correlationId: `val_error_${Date.now()}`,
            timestamp: new Date().toISOString(),
            clientInfo: { ip: 'unknown', userAgent: 'unknown' },
            requestInfo: { method: 'unknown', url: 'unknown' },
            validationMetadata: { 
                startTime: Date.now(), 
                attempt: 1, 
                error: 'CONTEXT_CREATION_FAILED' 
            }
        };
    }
}

/**
 * Main request validation class that provides comprehensive HTTP request security validation
 * including method validation, path security checks, input sanitization, and malicious request detection
 */
class RequestValidator {
    /**
     * Initializes request validator with configuration, logging, and security pattern setup
     * for comprehensive request validation
     * @param {object} options - Validation configuration options with security settings and validation rules
     */
    constructor(options = {}) {
        // Load validation configuration from environment and merge with provided options
        this.config = {
            supportedMethods: options.supportedMethods || SUPPORTED_METHODS,
            allowedPaths: options.allowedPaths || ALLOWED_PATHS,
            maxUrlLength: options.maxUrlLength || MAX_URL_LENGTH,
            maxHeaderSize: options.maxHeaderSize || MAX_HEADER_SIZE,
            enableSecurityLogging: options.enableSecurityLogging !== false,
            validationTimeout: options.validationTimeout || VALIDATION_TIMEOUT,
            strictMode: options.strictMode !== false,
            ...options
        };

        // Initialize logger instance for security event tracking
        this.logger = logger;

        // Set up supported HTTP methods array (GET only for tutorial)
        this.supportedMethods = [...this.config.supportedMethods];

        // Configure allowed URL paths array (/hello only)
        this.allowedPaths = [...this.config.allowedPaths];

        // Initialize security patterns for threat detection
        this.securityPatterns = { ...SECURITY_PATTERNS };

        // Configure validation limits and thresholds
        this.limits = {
            maxUrlLength: this.config.maxUrlLength,
            maxHeaderSize: this.config.maxHeaderSize,
            validationTimeout: this.config.validationTimeout
        };

        // Set up validation metrics tracking
        this.metrics = {
            validationCount: 0,
            successCount: 0,
            failureCount: 0,
            securityViolations: 0,
            averageValidationTime: 0,
            lastValidationTime: null
        };

        this.logger.info('RequestValidator initialized', {
            supportedMethods: this.supportedMethods,
            allowedPaths: this.allowedPaths,
            strictMode: this.config.strictMode,
            securityLogging: this.config.enableSecurityLogging
        });
    }

    /**
     * Primary validation method that orchestrates comprehensive request validation
     * including security checks and threat detection
     * @param {object} req - HTTP request object to validate
     * @returns {object} Comprehensive validation result with success status, error details, and security assessment
     */
    async validate(req) {
        const startTime = performance.now();
        
        try {
            // Create validation context for request correlation and tracking
            const context = createValidationContext(req);
            this.updateMetrics('start', startTime);

            this.logger.info('Starting comprehensive request validation', {
                correlationId: context.correlationId,
                method: req.method,
                url: req.url
            });

            // Perform HTTP method validation against supported methods whitelist
            const methodResult = this.validateMethodStrict(req.method, context);
            if (!methodResult.success) {
                this.updateMetrics('failure', startTime);
                return this.createValidationResult(false, methodResult, context, startTime);
            }

            // Execute URL parsing and security validation with threat detection
            const urlResult = this.validateUrlStrict(req.url, req.headers.host, context);
            if (!urlResult.success) {
                this.updateMetrics('failure', startTime);
                return this.createValidationResult(false, urlResult, context, startTime);
            }

            // Validate request headers for size limits and injection attempts
            const headerResult = this.validateHeadersStrict(req.headers, context);
            if (!headerResult.success) {
                this.updateMetrics('failure', startTime);
                return this.createValidationResult(false, headerResult, context, startTime);
            }

            // Check for malicious patterns and security vulnerabilities
            const securityResult = this.validateSecurity(req);
            if (!securityResult.success) {
                this.updateMetrics('securityViolation', startTime);
                return this.createValidationResult(false, securityResult, context, startTime);
            }

            // Update validation metrics and performance counters
            this.updateMetrics('success', startTime);
            
            const duration = performance.now() - startTime;
            
            // Log validation results for security monitoring
            this.logger.info('Request validation completed successfully', {
                correlationId: context.correlationId,
                duration: `${duration.toFixed(2)}ms`,
                validationCount: this.metrics.validationCount,
                successRate: `${((this.metrics.successCount / this.metrics.validationCount) * 100).toFixed(1)}%`
            });

            return {
                success: true,
                context,
                validatedData: {
                    method: methodResult.method,
                    path: urlResult.normalizedPath,
                    url: urlResult.parsedUrl,
                    headers: headerResult.sanitizedHeaders
                },
                securityAssessment: securityResult.assessment,
                metrics: this.getValidationSummary(),
                duration
            };

        } catch (error) {
            const duration = performance.now() - startTime;
            
            this.logger.error('Request validation exception', {
                error: error.message,
                stack: error.stack,
                duration: `${duration.toFixed(2)}ms`
            });

            this.updateMetrics('error', startTime);

            return {
                success: false,
                error: 'VALIDATION_EXCEPTION',
                message: 'Internal validation error',
                exception: error.message,
                duration
            };
        }
    }

    /**
     * Quick validation check that returns boolean result for simple valid/invalid determination
     * @param {object} req - HTTP request object to check
     * @returns {boolean} True if request passes all validation checks, false otherwise
     */
    isValidRequest(req) {
        try {
            // Perform lightweight validation checks for performance
            if (!req || typeof req !== 'object') {
                return false;
            }

            // Check HTTP method against supported methods
            if (!req.method || !this.supportedMethods.includes(req.method.toUpperCase())) {
                return false;
            }

            // Validate URL path against allowed paths using URL parsing
            if (!req.url) {
                return false;
            }

            try {
                const parsedUrl = new url.URL(req.url, `http://${req.headers?.host || 'localhost'}`);
                if (!this.allowedPaths.includes(parsedUrl.pathname)) {
                    return false;
                }
            } catch (urlError) {
                return false;
            }

            // Check for obvious security violations
            if (this.hasObviousSecurityViolations(req.url)) {
                return false;
            }

            return true;

        } catch (error) {
            this.logger.warn('Quick validation check failed', { error: error.message });
            return false;
        }
    }

    /**
     * Dedicated security validation method that focuses on threat detection
     * and malicious request identification
     * @param {object} req - HTTP request object for security analysis
     * @returns {object} Security validation result with threat assessment and security details
     */
    validateSecurity(req) {
        try {
            const securityAssessment = {
                threatLevel: 'NONE',
                threats: [],
                securityScore: 100,
                recommendations: []
            };

            // Analyze request for path traversal attack patterns
            if (req.url) {
                const pathTraversalCheck = this.checkPathTraversal(req.url);
                if (pathTraversalCheck.detected) {
                    securityAssessment.threats.push({
                        type: 'PATH_TRAVERSAL',
                        severity: 'HIGH',
                        details: pathTraversalCheck.details,
                        pattern: pathTraversalCheck.pattern
                    });
                    securityAssessment.threatLevel = 'HIGH';
                    securityAssessment.securityScore -= 50;
                }
            }

            // Check for injection attempts including script injection
            const injectionCheck = this.checkInjectionAttempts(req);
            if (injectionCheck.detected) {
                securityAssessment.threats.push({
                    type: 'INJECTION_ATTEMPT',
                    severity: 'HIGH',
                    details: injectionCheck.details,
                    vectors: injectionCheck.vectors
                });
                securityAssessment.threatLevel = 'HIGH';
                securityAssessment.securityScore -= 40;
            }

            // Validate request size and complexity for DoS protection
            const dosCheck = this.checkDoSAttempts(req);
            if (dosCheck.detected) {
                securityAssessment.threats.push({
                    type: 'DOS_ATTEMPT',
                    severity: 'MEDIUM',
                    details: dosCheck.details,
                    metrics: dosCheck.metrics
                });
                if (securityAssessment.threatLevel === 'NONE') {
                    securityAssessment.threatLevel = 'MEDIUM';
                }
                securityAssessment.securityScore -= 30;
            }

            // Log security violations for incident response
            if (securityAssessment.threats.length > 0) {
                this.logger.error('Security threats detected', {
                    threatLevel: securityAssessment.threatLevel,
                    threatCount: securityAssessment.threats.length,
                    threats: securityAssessment.threats,
                    securityScore: securityAssessment.securityScore,
                    url: req.url,
                    method: req.method,
                    securityEvent: 'THREAT_DETECTION'
                });

                return {
                    success: false,
                    error: 'SECURITY_VIOLATION',
                    message: `Security threats detected: ${securityAssessment.threats.map(t => t.type).join(', ')}`,
                    assessment: securityAssessment
                };
            }

            return {
                success: true,
                assessment: securityAssessment,
                message: 'No security threats detected'
            };

        } catch (error) {
            this.logger.error('Security validation exception', {
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'SECURITY_VALIDATION_ERROR',
                message: 'Security validation failed',
                exception: error.message
            };
        }
    }

    /**
     * Returns validation error constants used by error handler for consistent error processing
     * @returns {object} Validation error constants object for error handler integration
     */
    getValidationErrors() {
        return {
            errors: { ...VALIDATION_ERRORS },
            descriptions: {
                [VALIDATION_ERRORS.INVALID_METHOD]: 'HTTP method not supported',
                [VALIDATION_ERRORS.INVALID_PATH]: 'URL path not allowed',
                [VALIDATION_ERRORS.PATH_TRAVERSAL]: 'Path traversal attack detected',
                [VALIDATION_ERRORS.INVALID_URL]: 'Malformed or invalid URL',
                [VALIDATION_ERRORS.REQUEST_TOO_LARGE]: 'Request size exceeds limits',
                [VALIDATION_ERRORS.INVALID_HEADERS]: 'Header validation failed'
            },
            httpStatusMappings: {
                [VALIDATION_ERRORS.INVALID_METHOD]: 405,
                [VALIDATION_ERRORS.INVALID_PATH]: 404,
                [VALIDATION_ERRORS.PATH_TRAVERSAL]: 400,
                [VALIDATION_ERRORS.INVALID_URL]: 400,
                [VALIDATION_ERRORS.REQUEST_TOO_LARGE]: 413,
                [VALIDATION_ERRORS.INVALID_HEADERS]: 400
            }
        };
    }

    /**
     * Updates security metrics based on validation results for monitoring and alerting
     * @param {object} validationResult - Validation result with security assessment
     * @returns {void} No return value - updates internal security metrics
     */
    updateSecurityMetrics(validationResult) {
        try {
            if (validationResult && validationResult.securityAssessment) {
                const assessment = validationResult.securityAssessment;
                
                // Increment security violation counters by threat type
                if (assessment.threats && assessment.threats.length > 0) {
                    this.metrics.securityViolations += assessment.threats.length;
                    
                    assessment.threats.forEach(threat => {
                        const threatType = threat.type;
                        this.metrics[`${threatType}_count`] = 
                            (this.metrics[`${threatType}_count`] || 0) + 1;
                    });
                }

                // Update security alerting thresholds based on patterns
                this.checkSecurityThresholds();
            }
        } catch (error) {
            this.logger.error('Security metrics update failed', {
                error: error.message
            });
        }
    }

    // Private helper methods

    /**
     * Validates HTTP method with strict checking and context logging
     * @private
     */
    validateMethodStrict(method, context) {
        const result = validateMethod(method);
        
        if (!result.success && this.config.enableSecurityLogging) {
            this.logger.warn('Strict method validation failed', {
                method,
                correlationId: context.correlationId,
                error: result.error
            });
        }

        return result;
    }

    /**
     * Validates URL with strict checking and security analysis
     * @private
     */
    validateUrlStrict(requestUrl, host, context) {
        const urlResult = validateUrl(requestUrl, host);
        
        if (urlResult.success) {
            const pathResult = validatePath(urlResult.parsedUrl.pathname);
            if (!pathResult.success) {
                return pathResult;
            }
            
            return {
                ...urlResult,
                normalizedPath: pathResult.normalizedPath
            };
        }
        
        return urlResult;
    }

    /**
     * Validates headers with strict security checking
     * @private
     */
    validateHeadersStrict(headers, context) {
        const result = validateHeaders(headers);
        
        if (!result.success && this.config.enableSecurityLogging) {
            this.logger.warn('Strict header validation failed', {
                headerCount: headers ? Object.keys(headers).length : 0,
                correlationId: context.correlationId,
                error: result.error
            });
        }

        return result;
    }

    /**
     * Creates standardized validation result object
     * @private
     */
    createValidationResult(success, result, context, startTime) {
        return {
            success,
            ...result,
            context,
            duration: performance.now() - startTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Updates internal validation metrics
     * @private
     */
    updateMetrics(type, startTime) {
        this.metrics.validationCount++;
        
        switch (type) {
            case 'success':
                this.metrics.successCount++;
                break;
            case 'failure':
                this.metrics.failureCount++;
                break;
            case 'securityViolation':
                this.metrics.securityViolations++;
                this.metrics.failureCount++;
                break;
        }

        const duration = performance.now() - startTime;
        this.metrics.averageValidationTime = 
            (this.metrics.averageValidationTime + duration) / 2;
        this.metrics.lastValidationTime = Date.now();
    }

    /**
     * Checks for obvious security violations for quick validation
     * @private
     */
    hasObviousSecurityViolations(url) {
        if (!url) return false;
        
        return Object.values(this.securityPatterns).some(pattern => 
            pattern.test(url)
        );
    }

    /**
     * Checks for path traversal attack patterns
     * @private
     */
    checkPathTraversal(url) {
        const patterns = [
            SECURITY_PATTERNS.PATH_TRAVERSAL,
            SECURITY_PATTERNS.ENCODED_TRAVERSAL
        ];

        for (const pattern of patterns) {
            if (pattern.test(url)) {
                return {
                    detected: true,
                    pattern: pattern.source,
                    details: 'Path traversal pattern detected in URL'
                };
            }
        }

        return { detected: false };
    }

    /**
     * Checks for various injection attack patterns
     * @private
     */
    checkInjectionAttempts(req) {
        const vectors = [];
        
        if (req.url && SECURITY_PATTERNS.SCRIPT_INJECTION.test(req.url)) {
            vectors.push('URL_SCRIPT_INJECTION');
        }

        if (req.url && SECURITY_PATTERNS.NULL_BYTE.test(req.url)) {
            vectors.push('NULL_BYTE_INJECTION');
        }

        return {
            detected: vectors.length > 0,
            vectors,
            details: vectors.length > 0 ? 
                `Injection vectors detected: ${vectors.join(', ')}` : 
                'No injection attempts detected'
        };
    }

    /**
     * Checks for potential DoS attack patterns
     * @private
     */
    checkDoSAttempts(req) {
        const metrics = {};
        let detected = false;

        // Check URL length
        if (req.url && req.url.length > this.limits.maxUrlLength) {
            metrics.oversizedUrl = req.url.length;
            detected = true;
        }

        // Check header size
        if (req.headers) {
            const headerSize = Buffer.byteLength(JSON.stringify(req.headers), 'utf8');
            if (headerSize > this.limits.maxHeaderSize) {
                metrics.oversizedHeaders = headerSize;
                detected = true;
            }
        }

        return {
            detected,
            metrics,
            details: detected ? 
                'Request size exceeds normal limits' : 
                'Request size within normal limits'
        };
    }

    /**
     * Returns summary of validation metrics
     * @private
     */
    getValidationSummary() {
        return {
            total: this.metrics.validationCount,
            success: this.metrics.successCount,
            failures: this.metrics.failureCount,
            securityViolations: this.metrics.securityViolations,
            successRate: this.metrics.validationCount > 0 ? 
                ((this.metrics.successCount / this.metrics.validationCount) * 100).toFixed(1) + '%' : '0%',
            averageTime: `${this.metrics.averageValidationTime.toFixed(2)}ms`
        };
    }

    /**
     * Checks security thresholds for alerting
     * @private
     */
    checkSecurityThresholds() {
        const violationRate = this.metrics.validationCount > 0 ? 
            (this.metrics.securityViolations / this.metrics.validationCount) : 0;

        if (violationRate > 0.1) { // 10% security violation rate
            this.logger.error('High security violation rate detected', {
                violationRate: `${(violationRate * 100).toFixed(1)}%`,
                totalViolations: this.metrics.securityViolations,
                totalValidations: this.metrics.validationCount,
                securityEvent: 'HIGH_VIOLATION_RATE'
            });
        }
    }
}

// Helper functions for header validation and query parameter processing

/**
 * Validates a single header for format compliance and security issues
 * @private
 */
function validateSingleHeader(headerName, headerValue) {
    try {
        // Check for header injection patterns including newline characters
        const headerInjectionPattern = /[\r\n\x00]/gi;
        
        if (headerInjectionPattern.test(headerName) || headerInjectionPattern.test(headerValue)) {
            return {
                success: false,
                error: 'HEADER_INJECTION',
                message: 'Header injection detected'
            };
        }

        // Sanitize header value by removing control characters
        const sanitizedValue = String(headerValue).replace(SECURITY_PATTERNS.CONTROL_CHARS, '');

        return {
            success: true,
            sanitizedValue,
            originalValue: headerValue
        };
    } catch (error) {
        return {
            success: false,
            error: 'HEADER_PROCESSING_ERROR',
            message: error.message
        };
    }
}

/**
 * Validates query parameters for security issues
 * @private
 */
function validateQueryParameters(queryString) {
    try {
        if (!queryString || queryString === '?') {
            return { success: true, message: 'No query parameters to validate' };
        }

        // Check for basic injection patterns in query string
        for (const [patternName, pattern] of Object.entries(SECURITY_PATTERNS)) {
            if (pattern.test(queryString)) {
                return {
                    success: false,
                    error: 'QUERY_SECURITY_VIOLATION',
                    message: `Security pattern detected in query: ${patternName}`,
                    details: { pattern: patternName, query: queryString }
                };
            }
        }

        return { success: true, message: 'Query parameters validated successfully' };
    } catch (error) {
        return {
            success: false,
            error: 'QUERY_VALIDATION_ERROR',
            message: error.message
        };
    }
}

/**
 * Extracts client IP address handling various proxy scenarios
 * @private
 */
function extractClientIp(req) {
    try {
        // Check for forwarded IP addresses from proxies
        const xForwardedFor = req.headers && req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            const ips = xForwardedFor.split(',');
            return ips[0].trim();
        }

        // Check for real IP header
        const xRealIp = req.headers && req.headers['x-real-ip'];
        if (xRealIp) {
            return xRealIp.trim();
        }

        // Use connection remote address as fallback
        if (req.connection && req.connection.remoteAddress) {
            return req.connection.remoteAddress;
        }

        // Use socket remote address as final fallback
        if (req.socket && req.socket.remoteAddress) {
            return req.socket.remoteAddress;
        }

        return 'unknown';
    } catch (error) {
        return 'extraction_error';
    }
}

// Create default validator instance configured with environment settings
const requestValidator = new RequestValidator({
    supportedMethods: SUPPORTED_METHODS,
    allowedPaths: ALLOWED_PATHS,
    maxUrlLength: MAX_URL_LENGTH,
    maxHeaderSize: MAX_HEADER_SIZE,
    strictMode: config.environment === 'production',
    enableSecurityLogging: config.environment !== 'test'
});

// Export RequestValidator class, utility functions, constants, and default instance
module.exports = {
    // RequestValidator class for creating validator instances
    RequestValidator,
    
    // Utility functions for request validation without class instantiation
    validateRequest,
    validateMethod,
    validatePath,
    validateUrl,
    validateHeaders,
    sanitizeInput,
    createValidationContext,
    
    // Validation error constants for error handler integration
    VALIDATION_ERRORS,
    
    // Configuration constants
    SUPPORTED_METHODS,
    ALLOWED_PATHS,
    SECURITY_PATTERNS,
    MAX_URL_LENGTH,
    MAX_HEADER_SIZE,
    
    // Default validator instance configured with environment settings
    requestValidator
};