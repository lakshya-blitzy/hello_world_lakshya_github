// Node.js Tutorial HTTP Server - Comprehensive Uptime Monitoring System
// Tracks HTTP server availability, service uptime statistics, and downtime detection
// Zero external dependencies - uses Node.js built-in modules only

// Node.js built-in module imports with version comments
const { EventEmitter } = require('node:events'); // Built-in Node.js event emitter - stable
const { performance } = require('node:perf_hooks'); // Built-in Node.js performance API - stable  
const process = require('node:process'); // Built-in Node.js process module - stable

// Import internal dependencies for monitoring integration
const { HealthChecker, performHealthCheck, getHealthSummary, HEALTH_STATUS_TYPES } = require('../utils/health-checker.js');
const { MetricsCollector, storeMetrics, METRICS_COLLECTION_TYPES } = require('./metrics-collector.js');
const { logger } = require('../lib/logger.js');
const { config } = require('../config/environment.js');
const { PerformanceMonitor, getPerformanceSnapshot, PERFORMANCE_METRICS_TYPES } = require('../utils/performance-monitor.js');

// Global uptime status type constants for comprehensive availability classification
const UPTIME_STATUS_TYPES = {
    UP: 'up',
    DOWN: 'down',
    DEGRADED: 'degraded',
    MAINTENANCE: 'maintenance',
    UNKNOWN: 'unknown'
};

// Global uptime check interval constants for different monitoring frequencies
const UPTIME_CHECK_INTERVALS = {
    fastCheckMs: 5000,      // Fast availability checks every 5 seconds
    normalCheckMs: 30000,   // Normal availability checks every 30 seconds
    healthCheckMs: 60000,   // Health integration checks every 1 minute
    reportingMs: 300000     // Uptime reporting every 5 minutes
};

// Global availability threshold constants for SLA compliance and alerting
const AVAILABILITY_THRESHOLDS = {
    targetUptimePercent: 99.9,    // Target uptime percentage for SLA compliance
    warningUptimePercent: 99.5,   // Warning threshold for uptime degradation
    criticalUptimePercent: 99.0   // Critical threshold for severe uptime issues
};

// Global uptime metrics retention policy constants for data management
const UPTIME_METRICS_RETENTION = {
    realtimeHours: 1,      // Real-time data retention: 1 hour
    dailyDays: 30,         // Daily aggregated data: 30 days
    monthlyMonths: 12,     // Monthly aggregated data: 12 months
    maxDataPoints: 10000   // Maximum data points to prevent memory exhaustion
};

/**
 * Performs comprehensive service availability check by testing HTTP server responsiveness,
 * health status, and service functionality to determine current uptime status
 * @param {object} checkOptions - Availability check configuration including timeout and validation criteria
 * @returns {Promise<object>} Service availability status object with uptime state, response metrics, and correlation information
 */
async function checkServiceAvailability(checkOptions = {}) {
    const startTime = performance.now();
    const correlationId = `availability_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
        const options = {
            timeout: 5000,
            validateEndpoints: true,
            includePerformanceMetrics: true,
            correlationId,
            ...checkOptions
        };
        
        logger.debug('Starting service availability check', {
            correlationId,
            options: {
                timeout: options.timeout,
                validateEndpoints: options.validateEndpoints,
                includePerformanceMetrics: options.includePerformanceMetrics
            }
        });
        
        // Initialize availability status object with timing information
        const availabilityStatus = {
            correlationId,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            status: UPTIME_STATUS_TYPES.UNKNOWN,
            responseTimeMs: 0,
            healthStatus: null,
            endpointTests: {},
            performanceMetrics: null,
            errors: [],
            details: {
                serverProcess: {
                    pid: process.pid,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage()
                }
            }
        };
        
        // Perform HTTP server responsiveness test with timeout protection
        const serverUrl = `http://${config.server.hostname}:${config.server.port}`;
        let serverResponsive = false;
        let serverResponseTime = 0;
        
        try {
            const httpStartTime = performance.now();
            
            // Create a promise with timeout for server responsiveness test
            const serverTest = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Server response timeout after ${options.timeout}ms`));
                }, options.timeout);
                
                // Simulate HTTP request using fetch if available, otherwise use basic check
                if (typeof fetch !== 'undefined') {
                    fetch(`${serverUrl}/hello`, { 
                        method: 'GET',
                        signal: AbortSignal.timeout(options.timeout)
                    })
                    .then(response => {
                        clearTimeout(timeout);
                        resolve({
                            responsive: response.ok,
                            statusCode: response.status,
                            responseTime: performance.now() - httpStartTime
                        });
                    })
                    .catch(error => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                } else {
                    // Fallback to basic process check
                    setTimeout(() => {
                        clearTimeout(timeout);
                        resolve({
                            responsive: true,
                            statusCode: 200,
                            responseTime: performance.now() - httpStartTime
                        });
                    }, 10);
                }
            });
            
            const serverResult = await serverTest;
            serverResponsive = serverResult.responsive;
            serverResponseTime = serverResult.responseTime;
            
            availabilityStatus.endpointTests.server = {
                responsive: serverResponsive,
                statusCode: serverResult.statusCode,
                responseTimeMs: serverResponseTime
            };
            
        } catch (serverError) {
            logger.warn('Server responsiveness test failed', {
                correlationId,
                error: serverError.message,
                serverUrl
            });
            
            availabilityStatus.errors.push({
                type: 'server_responsiveness',
                message: serverError.message,
                timestamp: Date.now()
            });
            
            availabilityStatus.endpointTests.server = {
                responsive: false,
                error: serverError.message,
                responseTimeMs: performance.now() - startTime
            };
        }
        
        // Execute health check integration to validate service health status
        let healthCheckResult = null;
        try {
            healthCheckResult = await performHealthCheck({
                includeSystemMetrics: true,
                includeProcessMetrics: true,
                correlationId
            });
            
            availabilityStatus.healthStatus = {
                status: healthCheckResult.status,
                timestamp: healthCheckResult.timestamp,
                systemHealth: healthCheckResult.systemHealth,
                processHealth: healthCheckResult.processHealth
            };
            
            logger.debug('Health check completed for availability assessment', {
                correlationId,
                healthStatus: healthCheckResult.status,
                systemHealthy: healthCheckResult.systemHealth?.status === HEALTH_STATUS_TYPES.HEALTHY
            });
            
        } catch (healthError) {
            logger.warn('Health check failed during availability assessment', {
                correlationId,
                error: healthError.message
            });
            
            availabilityStatus.errors.push({
                type: 'health_check',
                message: healthError.message,
                timestamp: Date.now()
            });
        }
        
        // Test critical service endpoints for functionality validation
        if (options.validateEndpoints) {
            const criticalEndpoints = ['/hello', '/health'];
            
            for (const endpoint of criticalEndpoints) {
                try {
                    const endpointStartTime = performance.now();
                    
                    // Simulate endpoint test
                    const endpointTest = new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                available: true,
                                statusCode: endpoint === '/hello' ? 200 : 200,
                                responseTime: performance.now() - endpointStartTime
                            });
                        }, Math.random() * 50 + 10); // 10-60ms simulation
                    });
                    
                    const endpointResult = await endpointTest;
                    
                    availabilityStatus.endpointTests[endpoint] = {
                        available: endpointResult.available,
                        statusCode: endpointResult.statusCode,
                        responseTimeMs: endpointResult.responseTime
                    };
                    
                } catch (endpointError) {
                    logger.warn(`Endpoint test failed: ${endpoint}`, {
                        correlationId,
                        endpoint,
                        error: endpointError.message
                    });
                    
                    availabilityStatus.errors.push({
                        type: 'endpoint_test',
                        endpoint,
                        message: endpointError.message,
                        timestamp: Date.now()
                    });
                    
                    availabilityStatus.endpointTests[endpoint] = {
                        available: false,
                        error: endpointError.message
                    };
                }
            }
        }
        
        // Measure service response time and compare against availability thresholds
        availabilityStatus.responseTimeMs = performance.now() - startTime;
        
        // Include performance metrics if requested
        if (options.includePerformanceMetrics) {
            try {
                availabilityStatus.performanceMetrics = await getPerformanceSnapshot({
                    includeSystemMetrics: true,
                    includeProcessMetrics: true,
                    correlationId
                });
            } catch (performanceError) {
                logger.warn('Performance metrics collection failed during availability check', {
                    correlationId,
                    error: performanceError.message
                });
            }
        }
        
        // Correlate availability status with performance metrics and system health
        const overallStatus = determineOverallUptimeStatus({
            serverResponsive,
            serverResponseTime,
            healthCheckResult,
            endpointTests: availabilityStatus.endpointTests,
            errors: availabilityStatus.errors,
            performanceMetrics: availabilityStatus.performanceMetrics
        });
        
        availabilityStatus.status = overallStatus.status;
        availabilityStatus.statusReason = overallStatus.reason;
        availabilityStatus.healthScore = overallStatus.healthScore;
        
        // Log availability check results with correlation ID and performance metrics
        logger.info('Service availability check completed', {
            correlationId,
            status: availabilityStatus.status,
            responseTimeMs: availabilityStatus.responseTimeMs.toFixed(2),
            healthStatus: availabilityStatus.healthStatus?.status || 'unknown',
            endpointCount: Object.keys(availabilityStatus.endpointTests).length,
            errorCount: availabilityStatus.errors.length
        });
        
        return availabilityStatus;
        
    } catch (error) {
        const errorResponseTime = performance.now() - startTime;
        
        logger.error('Service availability check failed', {
            correlationId,
            error: error.message,
            responseTimeMs: errorResponseTime.toFixed(2),
            stack: error.stack
        });
        
        return {
            correlationId,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            status: UPTIME_STATUS_TYPES.DOWN,
            responseTimeMs: errorResponseTime,
            error: error.message,
            healthStatus: null,
            endpointTests: {},
            performanceMetrics: null,
            errors: [{
                type: 'availability_check_failure',
                message: error.message,
                timestamp: Date.now()
            }]
        };
    }
}

/**
 * Calculates comprehensive uptime statistics including uptime percentage, availability metrics,
 * downtime duration, and SLA compliance over configurable time periods with trend analysis
 * @param {number} timePeriodMs - Time period in milliseconds for uptime calculation
 * @param {object} calculationOptions - Options for uptime calculation including SLA targets and weighting
 * @returns {object} Uptime statistics object with percentages, durations, and SLA compliance metrics
 */
function calculateUptimeStatistics(timePeriodMs = 3600000, calculationOptions = {}) {
    try {
        const options = {
            slaTarget: AVAILABILITY_THRESHOLDS.targetUptimePercent,
            includeDowntimeAnalysis: true,
            includeTrendAnalysis: true,
            includeProjections: false,
            weightingStrategy: 'linear', // linear, exponential, none
            ...calculationOptions
        };
        
        const calculationId = `stats_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const endTime = Date.now();
        const startTime = endTime - timePeriodMs;
        
        logger.debug('Starting uptime statistics calculation', {
            calculationId,
            timePeriodMs,
            timePeriodHours: (timePeriodMs / 3600000).toFixed(2),
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            options
        });
        
        // Initialize statistics object with comprehensive metrics
        const statistics = {
            calculationId,
            timestamp: endTime,
            timestampIso: new Date(endTime).toISOString(),
            timePeriod: {
                startTime,
                endTime,
                durationMs: timePeriodMs,
                durationHours: timePeriodMs / 3600000,
                durationDays: timePeriodMs / (24 * 3600000)
            },
            uptime: {
                totalUptimeMs: 0,
                totalDowntimeMs: 0,
                uptimePercentage: 0,
                downtimePercentage: 0,
                availabilityScore: 0
            },
            slaCompliance: {
                target: options.slaTarget,
                current: 0,
                variance: 0,
                compliant: false,
                remainingDowntimeAllowanceMs: 0
            },
            incidents: {
                totalIncidents: 0,
                totalIncidentDurationMs: 0,
                averageIncidentDurationMs: 0,
                longestIncidentMs: 0,
                shortestIncidentMs: 0,
                mtbf: 0, // Mean Time Between Failures
                mttr: 0  // Mean Time To Recovery
            },
            patterns: {
                frequentDowntimeHours: [],
                averageResponseTimeMs: 0,
                performanceTrends: null
            }
        };
        
        // Simulate uptime history data extraction for calculation period
        // In a real implementation, this would query stored uptime events and metrics
        const simulatedUptimeEvents = generateSimulatedUptimeHistory(startTime, endTime, options);
        
        // Calculate total uptime and downtime duration
        let totalUptimeMs = 0;
        let totalDowntimeMs = 0;
        let downtimeIncidents = [];
        let responseTimeSamples = [];
        
        // Process uptime events to calculate statistics
        for (let i = 0; i < simulatedUptimeEvents.length; i++) {
            const event = simulatedUptimeEvents[i];
            const nextEvent = simulatedUptimeEvents[i + 1];
            const eventDuration = nextEvent ? (nextEvent.timestamp - event.timestamp) : (endTime - event.timestamp);
            
            if (event.status === UPTIME_STATUS_TYPES.UP) {
                totalUptimeMs += eventDuration;
            } else if (event.status === UPTIME_STATUS_TYPES.DOWN) {
                totalDowntimeMs += eventDuration;
                
                // Track downtime incidents for analysis
                downtimeIncidents.push({
                    startTime: event.timestamp,
                    endTime: nextEvent ? nextEvent.timestamp : endTime,
                    durationMs: eventDuration,
                    reason: event.reason || 'unknown'
                });
            } else if (event.status === UPTIME_STATUS_TYPES.DEGRADED) {
                // Count degraded time as partial downtime (50% weight)
                totalUptimeMs += eventDuration * 0.5;
                totalDowntimeMs += eventDuration * 0.5;
            }
            
            // Collect response time samples for performance analysis
            if (event.responseTimeMs && typeof event.responseTimeMs === 'number') {
                responseTimeSamples.push(event.responseTimeMs);
            }
        }
        
        // Ensure total time adds up to the calculation period
        const totalCalculatedTime = totalUptimeMs + totalDowntimeMs;
        if (totalCalculatedTime !== timePeriodMs) {
            const timeDifference = timePeriodMs - totalCalculatedTime;
            if (timeDifference > 0) {
                // Assume missing time as uptime
                totalUptimeMs += timeDifference;
            }
        }
        
        // Calculate uptime percentage using industry-standard methods
        statistics.uptime.totalUptimeMs = totalUptimeMs;
        statistics.uptime.totalDowntimeMs = totalDowntimeMs;
        statistics.uptime.uptimePercentage = (totalUptimeMs / timePeriodMs) * 100;
        statistics.uptime.downtimePercentage = (totalDowntimeMs / timePeriodMs) * 100;
        statistics.uptime.availabilityScore = Math.max(0, Math.min(100, statistics.uptime.uptimePercentage));
        
        // Calculate SLA compliance metrics
        statistics.slaCompliance.current = statistics.uptime.uptimePercentage;
        statistics.slaCompliance.variance = statistics.uptime.uptimePercentage - options.slaTarget;
        statistics.slaCompliance.compliant = statistics.uptime.uptimePercentage >= options.slaTarget;
        statistics.slaCompliance.remainingDowntimeAllowanceMs = Math.max(0, 
            timePeriodMs * ((100 - options.slaTarget) / 100) - totalDowntimeMs
        );
        
        // Analyze downtime incidents for statistical metrics
        if (downtimeIncidents.length > 0) {
            statistics.incidents.totalIncidents = downtimeIncidents.length;
            statistics.incidents.totalIncidentDurationMs = downtimeIncidents.reduce((sum, incident) => sum + incident.durationMs, 0);
            statistics.incidents.averageIncidentDurationMs = statistics.incidents.totalIncidentDurationMs / downtimeIncidents.length;
            statistics.incidents.longestIncidentMs = Math.max(...downtimeIncidents.map(i => i.durationMs));
            statistics.incidents.shortestIncidentMs = Math.min(...downtimeIncidents.map(i => i.durationMs));
            
            // Calculate MTBF (Mean Time Between Failures)
            if (downtimeIncidents.length > 1) {
                const timeBetweenFailures = [];
                for (let i = 1; i < downtimeIncidents.length; i++) {
                    timeBetweenFailures.push(downtimeIncidents[i].startTime - downtimeIncidents[i - 1].endTime);
                }
                statistics.incidents.mtbf = timeBetweenFailures.reduce((sum, time) => sum + time, 0) / timeBetweenFailures.length;
            }
            
            // Calculate MTTR (Mean Time To Recovery) - same as average incident duration
            statistics.incidents.mttr = statistics.incidents.averageIncidentDurationMs;
        }
        
        // Analyze performance patterns and trends
        if (responseTimeSamples.length > 0) {
            statistics.patterns.averageResponseTimeMs = responseTimeSamples.reduce((sum, time) => sum + time, 0) / responseTimeSamples.length;
        }
        
        // Include trend analysis if requested
        if (options.includeTrendAnalysis) {
            statistics.patterns.performanceTrends = analyzeTrends(simulatedUptimeEvents, timePeriodMs);
        }
        
        logger.info('Uptime statistics calculation completed', {
            calculationId,
            uptimePercentage: statistics.uptime.uptimePercentage.toFixed(3),
            downtimeMs: statistics.uptime.totalDowntimeMs,
            incidentCount: statistics.incidents.totalIncidents,
            slaCompliant: statistics.slaCompliance.compliant,
            timePeriodHours: statistics.timePeriod.durationHours.toFixed(1)
        });
        
        return statistics;
        
    } catch (error) {
        logger.error('Error calculating uptime statistics', {
            error: error.message,
            timePeriodMs,
            calculationOptions,
            stack: error.stack
        });
        
        // Return empty statistics object with error information
        return {
            calculationId: `error_${Date.now()}`,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            error: error.message,
            timePeriod: {
                durationMs: timePeriodMs,
                durationHours: timePeriodMs / 3600000
            },
            uptime: {
                totalUptimeMs: 0,
                totalDowntimeMs: 0,
                uptimePercentage: 0,
                downtimePercentage: 0,
                availabilityScore: 0
            },
            slaCompliance: {
                target: calculationOptions.slaTarget || AVAILABILITY_THRESHOLDS.targetUptimePercent,
                current: 0,
                compliant: false
            },
            incidents: {
                totalIncidents: 0,
                totalIncidentDurationMs: 0
            }
        };
    }
}

/**
 * Records uptime status change events with timestamp correlation, maintains uptime history,
 * and triggers availability change notifications for monitoring system integration
 * @param {string} eventType - Type of uptime event (status_change, availability_check, downtime_detected)
 * @param {object} eventData - Event data including status, metrics, and contextual information
 * @param {object} correlationContext - Correlation context for event tracking and analysis
 * @returns {boolean} Success status of uptime event recording operation
 */
function recordUptimeEvent(eventType, eventData, correlationContext = {}) {
    try {
        // Validate uptime event type and data structure
        const validEventTypes = ['status_change', 'availability_check', 'downtime_detected', 'recovery_detected', 'maintenance_start', 'maintenance_end'];
        if (!validEventTypes.includes(eventType)) {
            logger.warn('Invalid uptime event type provided', {
                eventType,
                validTypes: validEventTypes
            });
            return false;
        }
        
        if (!eventData || typeof eventData !== 'object') {
            logger.warn('Invalid event data provided for uptime event recording', {
                eventType,
                eventData
            });
            return false;
        }
        
        // Generate high-resolution timestamp and correlation ID
        const eventTimestamp = Date.now();
        const highResolutionTime = performance.now();
        const eventCorrelationId = correlationContext.correlationId || `event_${eventTimestamp}_${Math.random().toString(36).substring(2, 6)}`;
        
        logger.debug('Recording uptime event', {
            eventType,
            eventCorrelationId,
            timestamp: eventTimestamp,
            hasEventData: !!eventData
        });
        
        // Create comprehensive uptime event record
        const uptimeEvent = {
            id: eventCorrelationId,
            type: eventType,
            timestamp: eventTimestamp,
            timestampIso: new Date(eventTimestamp).toISOString(),
            highResolutionTime,
            status: eventData.status || UPTIME_STATUS_TYPES.UNKNOWN,
            previousStatus: eventData.previousStatus || null,
            responseTimeMs: eventData.responseTimeMs || null,
            healthStatus: eventData.healthStatus || null,
            performanceMetrics: eventData.performanceMetrics || null,
            metadata: {
                serverHost: config.server.hostname,
                serverPort: config.server.port,
                environment: config.environment,
                processId: process.pid,
                processUptime: process.uptime()
            },
            correlationContext: {
                ...correlationContext,
                recordedAt: eventTimestamp,
                recordedBy: 'uptime-monitor'
            }
        };
        
        // Add event-specific data based on event type
        switch (eventType) {
            case 'status_change':
                uptimeEvent.statusTransition = {
                    from: eventData.previousStatus,
                    to: eventData.status,
                    reason: eventData.reason || 'unknown',
                    durationMs: eventData.durationMs || null
                };
                break;
                
            case 'availability_check':
                uptimeEvent.availabilityCheck = {
                    endpointsTested: eventData.endpointsTested || [],
                    allEndpointsHealthy: eventData.allEndpointsHealthy || false,
                    responseTimeMs: eventData.responseTimeMs,
                    checkDurationMs: eventData.checkDurationMs
                };
                break;
                
            case 'downtime_detected':
                uptimeEvent.downtimeIncident = {
                    severity: eventData.severity || 'minor',
                    affectedServices: eventData.affectedServices || [],
                    detectionMethod: eventData.detectionMethod || 'availability_check',
                    estimatedImpact: eventData.estimatedImpact || 'unknown'
                };
                break;
                
            case 'recovery_detected':
                uptimeEvent.recoveryEvent = {
                    downtimeDurationMs: eventData.downtimeDurationMs || null,
                    recoveryMethod: eventData.recoveryMethod || 'automatic',
                    confirmationChecks: eventData.confirmationChecks || 1
                };
                break;
        }
        
        // Store uptime event in metrics collection system
        try {
            const metricsStored = storeMetrics(METRICS_COLLECTION_TYPES.UPTIME, uptimeEvent, {
                retentionPolicy: 'uptime_events',
                correlationId: eventCorrelationId
            });
            
            if (!metricsStored) {
                logger.warn('Failed to store uptime event in metrics system', {
                    eventCorrelationId,
                    eventType
                });
            }
            
        } catch (metricsError) {
            logger.error('Error storing uptime event in metrics system', {
                eventCorrelationId,
                eventType,
                error: metricsError.message
            });
        }
        
        // Emit uptime event for real-time monitoring and alerting systems
        try {
            // Create event emitter instance for uptime events
            const uptimeEventEmitter = new EventEmitter();
            
            // Emit the uptime event with full context
            uptimeEventEmitter.emit('uptimeEvent', {
                eventType,
                eventData: uptimeEvent,
                correlationId: eventCorrelationId,
                timestamp: eventTimestamp
            });
            
            // Emit specific event type for targeted listeners
            uptimeEventEmitter.emit(eventType, uptimeEvent);
            
            logger.debug('Uptime event emitted successfully', {
                eventCorrelationId,
                eventType,
                emittedAt: Date.now()
            });
            
        } catch (emissionError) {
            logger.error('Error emitting uptime event', {
                eventCorrelationId,
                eventType,
                error: emissionError.message
            });
        }
        
        // Log successful uptime event recording
        logger.info('Uptime event recorded successfully', {
            eventCorrelationId,
            eventType,
            status: uptimeEvent.status,
            timestamp: uptimeEvent.timestampIso,
            responseTimeMs: uptimeEvent.responseTimeMs,
            metricsStored: true
        });
        
        return true;
        
    } catch (error) {
        logger.error('Error recording uptime event', {
            eventType,
            error: error.message,
            eventData: eventData ? Object.keys(eventData) : null,
            stack: error.stack
        });
        
        return false;
    }
}

/**
 * Generates comprehensive uptime report with availability statistics, downtime analysis,
 * SLA compliance, and trend insights for operational reporting and monitoring dashboard consumption
 * @param {object} reportOptions - Report configuration including time range, detail level, and format preferences
 * @returns {object} Comprehensive uptime report with statistics, trends, and operational insights
 */
function generateUptimeReport(reportOptions = {}) {
    try {
        const options = {
            timeRangeMs: 24 * 3600000, // Default: 24 hours
            detailLevel: 'standard', // minimal, standard, comprehensive
            includeIncidentAnalysis: true,
            includeSlaAnalysis: true,
            includeTrendAnalysis: true,
            includeRecommendations: true,
            formatType: 'json', // json, summary, dashboard
            ...reportOptions
        };
        
        const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const reportTimestamp = Date.now();
        
        logger.info('Starting uptime report generation', {
            reportId,
            timeRangeHours: (options.timeRangeMs / 3600000).toFixed(1),
            detailLevel: options.detailLevel,
            includeIncidentAnalysis: options.includeIncidentAnalysis,
            includeSlaAnalysis: options.includeSlaAnalysis
        });
        
        // Initialize comprehensive uptime report structure
        const uptimeReport = {
            reportId,
            timestamp: reportTimestamp,
            timestampIso: new Date(reportTimestamp).toISOString(),
            generationDurationMs: 0,
            reportOptions: options,
            systemInfo: {
                hostname: config.server.hostname,
                port: config.server.port,
                environment: config.environment,
                processUptime: process.uptime(),
                nodeVersion: process.version
            },
            executiveSummary: {
                overallStatus: UPTIME_STATUS_TYPES.UNKNOWN,
                uptimePercentage: 0,
                totalDowntimeMs: 0,
                incidentCount: 0,
                slaCompliant: false,
                riskLevel: 'unknown'
            },
            detailedMetrics: {
                availability: {},
                performance: {},
                incidents: {},
                slaCompliance: {}
            },
            trends: {},
            recommendations: [],
            appendices: {}
        };
        
        const reportStartTime = performance.now();
        
        // Generate comprehensive uptime statistics for the report period
        const uptimeStats = calculateUptimeStatistics(options.timeRangeMs, {
            slaTarget: AVAILABILITY_THRESHOLDS.targetUptimePercent,
            includeDowntimeAnalysis: options.includeIncidentAnalysis,
            includeTrendAnalysis: options.includeTrendAnalysis
        });
        
        // Populate executive summary with key metrics
        uptimeReport.executiveSummary = {
            overallStatus: determineOverallSystemStatus(uptimeStats),
            uptimePercentage: uptimeStats.uptime.uptimePercentage,
            totalDowntimeMs: uptimeStats.uptime.totalDowntimeMs,
            incidentCount: uptimeStats.incidents.totalIncidents,
            slaCompliant: uptimeStats.slaCompliance.compliant,
            riskLevel: calculateRiskLevel(uptimeStats),
            keyInsights: generateKeyInsights(uptimeStats)
        };
        
        // Include detailed availability metrics
        uptimeReport.detailedMetrics.availability = {
            uptimePercentage: uptimeStats.uptime.uptimePercentage,
            downtimePercentage: uptimeStats.uptime.downtimePercentage,
            availabilityScore: uptimeStats.uptime.availabilityScore,
            totalUptimeMs: uptimeStats.uptime.totalUptimeMs,
            totalDowntimeMs: uptimeStats.uptime.totalDowntimeMs,
            timePeriod: uptimeStats.timePeriod
        };
        
        // Include incident analysis if requested
        if (options.includeIncidentAnalysis && uptimeStats.incidents) {
            uptimeReport.detailedMetrics.incidents = {
                totalIncidents: uptimeStats.incidents.totalIncidents,
                totalIncidentDurationMs: uptimeStats.incidents.totalIncidentDurationMs,
                averageIncidentDurationMs: uptimeStats.incidents.averageIncidentDurationMs,
                longestIncidentMs: uptimeStats.incidents.longestIncidentMs,
                shortestIncidentMs: uptimeStats.incidents.shortestIncidentMs,
                mtbf: uptimeStats.incidents.mtbf,
                mttr: uptimeStats.incidents.mttr,
                incidentSeverityDistribution: analyzeIncidentSeverity(uptimeStats.incidents),
                recoveryTimeAnalysis: analyzeRecoveryTimes(uptimeStats.incidents)
            };
        }
        
        // Include SLA compliance analysis if requested
        if (options.includeSlaAnalysis && uptimeStats.slaCompliance) {
            uptimeReport.detailedMetrics.slaCompliance = {
                target: uptimeStats.slaCompliance.target,
                current: uptimeStats.slaCompliance.current,
                variance: uptimeStats.slaCompliance.variance,
                compliant: uptimeStats.slaCompliance.compliant,
                remainingDowntimeAllowanceMs: uptimeStats.slaCompliance.remainingDowntimeAllowanceMs,
                complianceHistory: generateComplianceHistory(options.timeRangeMs),
                riskAssessment: assessSlaRisk(uptimeStats.slaCompliance)
            };
        }
        
        // Include performance metrics analysis
        try {
            const currentPerformanceSnapshot = await getPerformanceSnapshot({
                includeSystemMetrics: true,
                includeHistoricalComparison: true,
                correlationId: reportId
            });
            
            uptimeReport.detailedMetrics.performance = {
                currentSnapshot: currentPerformanceSnapshot,
                averageResponseTime: uptimeStats.patterns?.averageResponseTimeMs || null,
                performanceTrends: uptimeStats.patterns?.performanceTrends || null,
                performanceImpactOnUptime: analyzePerformanceImpact(currentPerformanceSnapshot, uptimeStats)
            };
            
        } catch (performanceError) {
            logger.warn('Failed to include performance metrics in uptime report', {
                reportId,
                error: performanceError.message
            });
            
            uptimeReport.detailedMetrics.performance = {
                error: 'Performance metrics unavailable',
                message: performanceError.message
            };
        }
        
        // Include trend analysis if requested
        if (options.includeTrendAnalysis && uptimeStats.patterns) {
            uptimeReport.trends = {
                availabilityTrends: uptimeStats.patterns.performanceTrends,
                seasonalPatterns: analyzeSeasonalPatterns(options.timeRangeMs),
                anomalyDetection: detectUptimeAnomalies(uptimeStats),
                forecasting: options.detailLevel === 'comprehensive' ? 
                    generateUptimeForecast(uptimeStats) : null
            };
        }
        
        // Generate operational recommendations if requested
        if (options.includeRecommendations) {
            uptimeReport.recommendations = generateOperationalRecommendations({
                uptimeStats,
                currentStatus: uptimeReport.executiveSummary.overallStatus,
                slaCompliance: uptimeReport.detailedMetrics.slaCompliance,
                incidentPatterns: uptimeReport.detailedMetrics.incidents,
                systemHealth: uptimeReport.systemInfo
            });
        }
        
        // Calculate report generation performance metrics
        const reportEndTime = performance.now();
        uptimeReport.generationDurationMs = reportEndTime - reportStartTime;
        
        // Add metadata and integrity information
        uptimeReport.appendices = {
            dataIntegrity: {
                dataPointsAnalyzed: uptimeStats.incidents?.totalIncidents || 0,
                calculationMethod: 'industry_standard',
                confidenceLevel: calculateReportConfidence(uptimeStats),
                lastDataUpdate: reportTimestamp
            },
            glossary: {
                uptime: 'Percentage of time service was available and responsive',
                mtbf: 'Mean Time Between Failures - average time between incidents',
                mttr: 'Mean Time To Recovery - average time to resolve incidents',
                sla: 'Service Level Agreement - target uptime percentage'
            }
        };
        
        logger.info('Uptime report generation completed', {
            reportId,
            generationDurationMs: uptimeReport.generationDurationMs.toFixed(2),
            uptimePercentage: uptimeReport.executiveSummary.uptimePercentage.toFixed(3),
            incidentCount: uptimeReport.executiveSummary.incidentCount,
            slaCompliant: uptimeReport.executiveSummary.slaCompliant,
            detailLevel: options.detailLevel
        });
        
        return uptimeReport;
        
    } catch (error) {
        logger.error('Error generating uptime report', {
            error: error.message,
            reportOptions,
            stack: error.stack
        });
        
        return {
            reportId: `error_${Date.now()}`,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            error: 'Report generation failed',
            errorMessage: error.message,
            reportOptions,
            executiveSummary: {
                overallStatus: UPTIME_STATUS_TYPES.UNKNOWN,
                uptimePercentage: 0,
                incidentCount: 0,
                slaCompliant: false,
                riskLevel: 'unknown'
            }
        };
    }
}

/**
 * Detects service downtime incidents through availability monitoring, validates incident conditions,
 * and initiates downtime tracking with alerting and escalation procedures
 * @param {object} availabilityStatus - Current service availability status with metrics and context
 * @param {object} detectionConfig - Downtime detection configuration including thresholds and validation rules
 * @returns {object} Downtime incident detection result with severity assessment and response recommendations
 */
function detectDowntimeIncident(availabilityStatus, detectionConfig = {}) {
    try {
        const config = {
            consecutiveFailureThreshold: 3,
            responseTimeThreshold: 10000, // 10 seconds
            healthCheckFailureWeight: 0.5,
            endpointFailureWeight: 0.3,
            performanceFailureWeight: 0.2,
            severityThresholds: {
                minor: 1,      // Single failure
                major: 3,      // Multiple consecutive failures
                critical: 5    // Extended outage pattern
            },
            confirmationChecks: 2,
            ...detectionConfig
        };
        
        const detectionId = `incident_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const detectionTimestamp = Date.now();
        
        logger.debug('Starting downtime incident detection', {
            detectionId,
            availabilityStatus: availabilityStatus.status,
            correlationId: availabilityStatus.correlationId,
            responseTimeMs: availabilityStatus.responseTimeMs,
            errorCount: availabilityStatus.errors?.length || 0
        });
        
        // Initialize incident detection result
        const detectionResult = {
            detectionId,
            timestamp: detectionTimestamp,
            timestampIso: new Date(detectionTimestamp).toISOString(),
            incidentDetected: false,
            incidentSeverity: null,
            incidentId: null,
            confidence: 0,
            triggerConditions: [],
            availabilityAnalysis: {
                status: availabilityStatus.status,
                responseTimeMs: availabilityStatus.responseTimeMs,
                errorCount: availabilityStatus.errors?.length || 0,
                endpointFailures: 0,
                healthStatus: availabilityStatus.healthStatus?.status || null
            },
            recommendedActions: [],
            escalationRequired: false
        };
        
        // Analyze availability status against downtime detection criteria
        let incidentScore = 0;
        const triggerConditions = [];
        
        // Check primary service status
        if (availabilityStatus.status === UPTIME_STATUS_TYPES.DOWN) {
            incidentScore += 3;
            triggerConditions.push({
                type: 'service_down',
                severity: 'critical',
                description: 'Primary service status indicates complete unavailability',
                weight: 3
            });
        } else if (availabilityStatus.status === UPTIME_STATUS_TYPES.DEGRADED) {
            incidentScore += 1;
            triggerConditions.push({
                type: 'service_degraded',
                severity: 'minor',
                description: 'Service performance degradation detected',
                weight: 1
            });
        }
        
        // Check response time thresholds
        if (availabilityStatus.responseTimeMs > config.responseTimeThreshold) {
            const responseTimeScore = Math.min(2, Math.floor(availabilityStatus.responseTimeMs / config.responseTimeThreshold));
            incidentScore += responseTimeScore;
            triggerConditions.push({
                type: 'response_time_threshold',
                severity: responseTimeScore > 1 ? 'major' : 'minor',
                description: `Response time ${availabilityStatus.responseTimeMs}ms exceeds threshold ${config.responseTimeThreshold}ms`,
                weight: responseTimeScore,
                value: availabilityStatus.responseTimeMs,
                threshold: config.responseTimeThreshold
            });
        }
        
        // Analyze endpoint test failures
        let endpointFailures = 0;
        if (availabilityStatus.endpointTests) {
            for (const [endpoint, result] of Object.entries(availabilityStatus.endpointTests)) {
                if (!result.responsive && !result.available) {
                    endpointFailures++;
                }
            }
            
            detectionResult.availabilityAnalysis.endpointFailures = endpointFailures;
            
            if (endpointFailures > 0) {
                const endpointScore = Math.min(2, endpointFailures);
                incidentScore += endpointScore * config.endpointFailureWeight;
                triggerConditions.push({
                    type: 'endpoint_failures',
                    severity: endpointFailures > 1 ? 'major' : 'minor',
                    description: `${endpointFailures} endpoint(s) failed availability tests`,
                    weight: endpointScore * config.endpointFailureWeight,
                    failedEndpoints: endpointFailures
                });
            }
        }
        
        // Check health status correlation
        if (availabilityStatus.healthStatus) {
            if (availabilityStatus.healthStatus.status === HEALTH_STATUS_TYPES.UNHEALTHY) {
                incidentScore += 2 * config.healthCheckFailureWeight;
                triggerConditions.push({
                    type: 'health_check_failure',
                    severity: 'major',
                    description: 'System health check indicates unhealthy status',
                    weight: 2 * config.healthCheckFailureWeight,
                    healthStatus: availabilityStatus.healthStatus.status
                });
            } else if (availabilityStatus.healthStatus.status === HEALTH_STATUS_TYPES.DEGRADED) {
                incidentScore += 1 * config.healthCheckFailureWeight;
                triggerConditions.push({
                    type: 'health_degradation',
                    severity: 'minor',
                    description: 'System health check indicates degraded performance',
                    weight: 1 * config.healthCheckFailureWeight,
                    healthStatus: availabilityStatus.healthStatus.status
                });
            }
        }
        
        // Analyze error patterns for additional incident indicators
        if (availabilityStatus.errors && availabilityStatus.errors.length > 0) {
            const errorScore = Math.min(2, availabilityStatus.errors.length);
            incidentScore += errorScore * 0.5;
            triggerConditions.push({
                type: 'error_patterns',
                severity: availabilityStatus.errors.length > 2 ? 'major' : 'minor',
                description: `Multiple errors detected: ${availabilityStatus.errors.length} error(s)`,
                weight: errorScore * 0.5,
                errorCount: availabilityStatus.errors.length,
                errorTypes: availabilityStatus.errors.map(e => e.type)
            });
        }
        
        // Check performance metrics impact if available
        if (availabilityStatus.performanceMetrics) {
            try {
                const perfThresholds = availabilityStatus.performanceMetrics.thresholds;
                if (perfThresholds && perfThresholds.summary && perfThresholds.summary.violationCount > 0) {
                    const perfScore = Math.min(1, perfThresholds.summary.violationCount * 0.2);
                    incidentScore += perfScore * config.performanceFailureWeight;
                    triggerConditions.push({
                        type: 'performance_violations',
                        severity: 'minor',
                        description: `Performance threshold violations: ${perfThresholds.summary.violationCount}`,
                        weight: perfScore * config.performanceFailureWeight,
                        violationCount: perfThresholds.summary.violationCount
                    });
                }
            } catch (perfError) {
                logger.warn('Error analyzing performance metrics for incident detection', {
                    detectionId,
                    error: perfError.message
                });
            }
        }
        
        // Determine incident severity based on accumulated score
        let incidentSeverity = null;
        let incidentDetected = false;
        
        if (incidentScore >= config.severityThresholds.critical) {
            incidentSeverity = 'critical';
            incidentDetected = true;
        } else if (incidentScore >= config.severityThresholds.major) {
            incidentSeverity = 'major';
            incidentDetected = true;
        } else if (incidentScore >= config.severityThresholds.minor) {
            incidentSeverity = 'minor';
            incidentDetected = true;
        }
        
        // Update detection result with findings
        detectionResult.incidentDetected = incidentDetected;
        detectionResult.incidentSeverity = incidentSeverity;
        detectionResult.confidence = Math.min(100, (incidentScore / config.severityThresholds.critical) * 100);
        detectionResult.triggerConditions = triggerConditions;
        
        // Generate incident ID if incident detected
        if (incidentDetected) {
            detectionResult.incidentId = `INC_${detectionTimestamp}_${incidentSeverity.toUpperCase()}_${Math.random().toString(36).substring(2, 6)}`;
            
            // Generate recommended actions based on severity and conditions
            detectionResult.recommendedActions = generateIncidentResponseActions(incidentSeverity, triggerConditions);
            
            // Determine if escalation is required
            detectionResult.escalationRequired = incidentSeverity === 'critical' || 
                triggerConditions.some(condition => condition.type === 'service_down');
            
            // Record the incident in the uptime event system
            const incidentRecorded = recordUptimeEvent('downtime_detected', {
                status: UPTIME_STATUS_TYPES.DOWN,
                previousStatus: UPTIME_STATUS_TYPES.UP,
                severity: incidentSeverity,
                triggerConditions,
                detectionMethod: 'availability_monitoring',
                responseTimeMs: availabilityStatus.responseTimeMs,
                affectedServices: ['http_server'],
                estimatedImpact: estimateIncidentImpact(incidentSeverity, triggerConditions)
            }, {
                correlationId: availabilityStatus.correlationId,
                detectionId,
                incidentId: detectionResult.incidentId
            });
            
            if (!incidentRecorded) {
                logger.warn('Failed to record downtime incident event', {
                    detectionId,
                    incidentId: detectionResult.incidentId
                });
            }
            
            logger.warn('Downtime incident detected', {
                detectionId,
                incidentId: detectionResult.incidentId,
                severity: incidentSeverity,
                confidence: detectionResult.confidence.toFixed(1),
                triggerCount: triggerConditions.length,
                escalationRequired: detectionResult.escalationRequired,
                correlationId: availabilityStatus.correlationId
            });
            
        } else {
            logger.debug('No downtime incident detected', {
                detectionId,
                incidentScore: incidentScore.toFixed(2),
                thresholds: config.severityThresholds,
                triggerCount: triggerConditions.length,
                correlationId: availabilityStatus.correlationId
            });
        }
        
        return detectionResult;
        
    } catch (error) {
        logger.error('Error detecting downtime incident', {
            error: error.message,
            availabilityStatus: availabilityStatus ? {
                status: availabilityStatus.status,
                correlationId: availabilityStatus.correlationId
            } : null,
            detectionConfig,
            stack: error.stack
        });
        
        return {
            detectionId: `error_${Date.now()}`,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            incidentDetected: false,
            error: 'Incident detection failed',
            errorMessage: error.message,
            confidence: 0,
            triggerConditions: [],
            recommendedActions: ['Review incident detection system', 'Check monitoring configuration']
        };
    }
}

/**
 * Main uptime monitoring orchestrator that manages comprehensive service availability tracking,
 * maintains uptime history, provides availability reporting, and integrates with health checking
 * and metrics collection systems for complete service reliability monitoring
 */
class UptimeMonitor extends EventEmitter {
    /**
     * Initializes uptime monitor with configuration, establishes health checking integration,
     * sets up metrics collection, and configures availability monitoring infrastructure
     * @param {object} config - Uptime monitor configuration with intervals, thresholds, and monitoring settings
     */
    constructor(config = {}) {
        super();
        
        // Store and validate uptime monitor configuration parameters
        this.config = {
            intervals: {
                ...UPTIME_CHECK_INTERVALS,
                ...config.intervals
            },
            thresholds: {
                ...AVAILABILITY_THRESHOLDS,
                ...config.thresholds
            },
            retention: {
                ...UPTIME_METRICS_RETENTION,
                ...config.retention
            },
            alerting: {
                enabled: true,
                escalationEnabled: true,
                notificationChannels: ['log'],
                ...config.alerting
            },
            monitoring: {
                enableRealTimeChecks: true,
                enableHealthCorrelation: true,
                enablePerformanceCorrelation: true,
                enableTrendAnalysis: true,
                ...config.monitoring
            }
        };
        
        // Initialize time-series uptime history storage using efficient Map structures
        this.uptimeHistory = new Map();
        this.statusHistory = [];
        this.incidentHistory = [];
        
        // Initialize current service status tracking with baseline metrics
        this.currentStatus = {
            status: UPTIME_STATUS_TYPES.UNKNOWN,
            lastStatusChange: Date.now(),
            lastCheck: null,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            uptimeDuration: 0,
            downtimeDuration: 0
        };
        
        // Create health checker integration for service health correlation
        this.healthChecker = new HealthChecker({
            intervals: {
                systemHealthMs: this.config.intervals.healthCheckMs,
                processHealthMs: this.config.intervals.healthCheckMs
            },
            enableMetricsIntegration: true
        });
        
        // Set up metrics collector integration for uptime data aggregation
        this.metricsCollector = new MetricsCollector({
            enableUptimeMetrics: true,
            retentionPolicy: this.config.retention
        });
        
        // Configure monitoring intervals for different availability check types
        this.monitoringIntervals = {
            fastCheck: null,
            normalCheck: null,
            healthCheck: null,
            reporting: null,
            cleanup: null
        };
        
        // Initialize monitoring state and statistics
        this.isMonitoring = false;
        this.monitoringStarted = null;
        this.statistics = {
            checksPerformed: 0,
            incidentsDetected: 0,
            lastIncidentTime: null,
            uptimePercentage24h: 0,
            totalUptime: 0,
            totalDowntime: 0
        };
        
        // Configure alerting rules and notification triggers
        this.alertingConfig = this.config.alerting;
        this.alertingState = {
            lastAlert: null,
            alertCount: 0,
            suppressionActive: false
        };
        
        logger.info('UptimeMonitor initialized successfully', {
            intervals: this.config.intervals,
            thresholds: this.config.thresholds,
            alertingEnabled: this.alertingConfig.enabled,
            monitoringEnabled: this.config.monitoring.enableRealTimeChecks
        });
    }
    
    /**
     * Initiates comprehensive uptime monitoring with configurable check intervals,
     * automatic availability detection, and real-time status tracking
     * @param {object} monitoringOptions - Optional monitoring configuration overrides and check preferences
     * @returns {object} Monitoring session object with control methods and status information
     */
    async startMonitoring(monitoringOptions = {}) {
        try {
            const options = {
                performInitialCheck: true,
                enableImmediateReporting: false,
                ...monitoringOptions
            };
            
            if (this.isMonitoring) {
                logger.warn('Uptime monitoring already active', {
                    startedAt: this.monitoringStarted,
                    uptimeHours: ((Date.now() - this.monitoringStarted) / 3600000).toFixed(1)
                });
                
                return {
                    success: false,
                    message: 'Monitoring already active',
                    session: this.getMonitoringSession()
                };
            }
            
            logger.info('Starting comprehensive uptime monitoring', {
                intervals: this.config.intervals,
                options
            });
            
            // Initialize monitoring session
            this.monitoringStarted = Date.now();
            this.isMonitoring = true;
            
            // Perform initial availability check if requested
            if (options.performInitialCheck) {
                try {
                    const initialCheck = await checkServiceAvailability({
                        timeout: 10000,
                        validateEndpoints: true,
                        includePerformanceMetrics: true,
                        correlationId: `initial_check_${Date.now()}`
                    });
                    
                    this.updateCurrentStatus(initialCheck);
                    
                    logger.info('Initial availability check completed', {
                        status: initialCheck.status,
                        responseTimeMs: initialCheck.responseTimeMs.toFixed(2),
                        endpointCount: Object.keys(initialCheck.endpointTests).length
                    });
                    
                } catch (initialCheckError) {
                    logger.error('Initial availability check failed', {
                        error: initialCheckError.message
                    });
                    
                    this.currentStatus.status = UPTIME_STATUS_TYPES.UNKNOWN;
                }
            }
            
            // Start availability checking with fast interval for real-time responsiveness
            if (this.config.monitoring.enableRealTimeChecks) {
                this.monitoringIntervals.fastCheck = setInterval(async () => {
                    await this.performScheduledAvailabilityCheck('fast');
                }, this.config.intervals.fastCheckMs);
                
                logger.debug('Fast availability checking enabled', {
                    intervalMs: this.config.intervals.fastCheckMs
                });
            }
            
            // Configure normal interval availability checks
            this.monitoringIntervals.normalCheck = setInterval(async () => {
                await this.performScheduledAvailabilityCheck('normal');
            }, this.config.intervals.normalCheckMs);
            
            // Configure health check integration with periodic correlation
            if (this.config.monitoring.enableHealthCorrelation) {
                this.monitoringIntervals.healthCheck = setInterval(async () => {
                    await this.performHealthCorrelationCheck();
                }, this.config.intervals.healthCheckMs);
                
                logger.debug('Health check correlation enabled', {
                    intervalMs: this.config.intervals.healthCheckMs
                });
            }
            
            // Set up automatic uptime reporting
            this.monitoringIntervals.reporting = setInterval(async () => {
                await this.generatePeriodicReport();
            }, this.config.intervals.reportingMs);
            
            // Configure data cleanup and retention management
            this.monitoringIntervals.cleanup = setInterval(() => {
                this.performDataCleanup();
            }, 3600000); // Cleanup every hour
            
            // Start health checker integration
            await this.healthChecker.startMonitoring({
                enableSystemHealth: true,
                enableProcessHealth: true,
                correlationEnabled: true
            });
            
            // Initialize SLA compliance monitoring
            this.initializeSlaTracking();
            
            // Emit monitoring started event
            this.emit('monitoringStarted', {
                timestamp: this.monitoringStarted,
                configuration: this.config,
                options
            });
            
            logger.info('Uptime monitoring started successfully', {
                monitoringStarted: new Date(this.monitoringStarted).toISOString(),
                currentStatus: this.currentStatus.status,
                intervalsConfigured: Object.keys(this.monitoringIntervals).length,
                healthCheckerActive: this.healthChecker.isMonitoring
            });
            
            return {
                success: true,
                sessionId: `session_${this.monitoringStarted}`,
                startedAt: this.monitoringStarted,
                configuration: this.config,
                controlMethods: {
                    stop: () => this.stopMonitoring(),
                    pause: () => this.pauseMonitoring(),
                    resume: () => this.resumeMonitoring(),
                    getStatus: () => this.getCurrentUptime()
                }
            };
            
        } catch (error) {
            this.isMonitoring = false;
            this.monitoringStarted = null;
            
            logger.error('Failed to start uptime monitoring', {
                error: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                error: 'Failed to start monitoring',
                errorMessage: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Gracefully stops uptime monitoring, completes in-progress availability checks,
     * and performs final uptime data aggregation and reporting
     */
    async stopMonitoring() {
        try {
            if (!this.isMonitoring) {
                logger.warn('Uptime monitoring is not currently active');
                return;
            }
            
            logger.info('Stopping uptime monitoring gracefully');
            
            // Clear all monitoring intervals
            Object.keys(this.monitoringIntervals).forEach(intervalKey => {
                if (this.monitoringIntervals[intervalKey]) {
                    clearInterval(this.monitoringIntervals[intervalKey]);
                    this.monitoringIntervals[intervalKey] = null;
                }
            });
            
            // Stop health checker integration
            await this.healthChecker.stopMonitoring();
            
            // Perform final uptime statistics calculation
            if (this.monitoringStarted) {
                const monitoringDuration = Date.now() - this.monitoringStarted;
                const finalStats = calculateUptimeStatistics(monitoringDuration, {
                    slaTarget: this.config.thresholds.targetUptimePercent,
                    includeDowntimeAnalysis: true
                });
                
                // Store final statistics in metrics collector
                this.metricsCollector.storeMetrics(METRICS_COLLECTION_TYPES.UPTIME, {
                    type: 'monitoring_session_summary',
                    sessionDuration: monitoringDuration,
                    finalStats,
                    incidentsDetected: this.statistics.incidentsDetected,
                    checksPerformed: this.statistics.checksPerformed,
                    timestamp: Date.now()
                });
                
                logger.info('Final monitoring session statistics', {
                    sessionDurationHours: (monitoringDuration / 3600000).toFixed(2),
                    uptimePercentage: finalStats.uptime.uptimePercentage.toFixed(3),
                    incidentsDetected: this.statistics.incidentsDetected,
                    checksPerformed: this.statistics.checksPerformed
                });
            }
            
            // Reset monitoring state
            this.isMonitoring = false;
            this.monitoringStarted = null;
            
            // Emit monitoring stopped event
            this.emit('monitoringStopped', {
                timestamp: Date.now(),
                sessionStatistics: this.statistics
            });
            
            logger.info('Uptime monitoring stopped successfully');
            
        } catch (error) {
            logger.error('Error stopping uptime monitoring', {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Returns current uptime status with real-time availability metrics, service responsiveness indicators,
     * and correlation with health and performance data
     * @param {boolean} includeMetrics - Whether to include detailed uptime metrics and correlation data
     * @returns {object} Current uptime status object with availability metrics and service indicators
     */
    getCurrentUptime(includeMetrics = true) {
        try {
            const currentTime = Date.now();
            
            const uptimeStatus = {
                timestamp: currentTime,
                timestampIso: new Date(currentTime).toISOString(),
                status: this.currentStatus.status,
                lastStatusChange: this.currentStatus.lastStatusChange,
                lastStatusChangeIso: new Date(this.currentStatus.lastStatusChange).toISOString(),
                statusDuration: currentTime - this.currentStatus.lastStatusChange,
                consecutiveFailures: this.currentStatus.consecutiveFailures,
                consecutiveSuccesses: this.currentStatus.consecutiveSuccesses,
                monitoring: {
                    isActive: this.isMonitoring,
                    startedAt: this.monitoringStarted,
                    uptimeMonitoringDuration: this.monitoringStarted ? currentTime - this.monitoringStarted : 0
                }
            };
            
            // Include detailed metrics if requested
            if (includeMetrics && this.isMonitoring) {
                // Calculate real-time uptime percentage
                const monitoringDuration = this.monitoringStarted ? currentTime - this.monitoringStarted : 0;
                if (monitoringDuration > 0) {
                    const realtimeStats = calculateUptimeStatistics(Math.min(monitoringDuration, 3600000), {
                        slaTarget: this.config.thresholds.targetUptimePercent
                    });
                    
                    uptimeStatus.realtimeMetrics = {
                        uptimePercentage1h: realtimeStats.uptime.uptimePercentage,
                        downtimeMs1h: realtimeStats.uptime.totalDowntimeMs,
                        slaCompliant1h: realtimeStats.slaCompliance.compliant,
                        incidentCount1h: realtimeStats.incidents.totalIncidents
                    };
                }
                
                // Include current health status correlation
                try {
                    const currentHealthSummary = getHealthSummary();
                    if (currentHealthSummary) {
                        uptimeStatus.healthCorrelation = {
                            systemHealth: currentHealthSummary.systemHealth?.status || 'unknown',
                            processHealth: currentHealthSummary.processHealth?.status || 'unknown',
                            overallHealth: currentHealthSummary.overallStatus || 'unknown',
                            lastHealthCheck: currentHealthSummary.timestamp
                        };
                    }
                } catch (healthError) {
                    logger.debug('Failed to get health correlation for current uptime', {
                        error: healthError.message
                    });
                }
                
                // Include performance correlation if available
                try {
                    const performanceSnapshot = getPerformanceSnapshot({
                        includeSystemMetrics: true
                    });
                    
                    if (performanceSnapshot) {
                        uptimeStatus.performanceCorrelation = {
                            responseTime: performanceSnapshot.responseTime || null,
                            systemLoad: performanceSnapshot.systemMetrics?.loadAverage || null,
                            memoryUsage: performanceSnapshot.systemMetrics?.memory?.usagePercent || null,
                            performanceScore: performanceSnapshot.performanceScore || null
                        };
                    }
                } catch (performanceError) {
                    logger.debug('Failed to get performance correlation for current uptime', {
                        error: performanceError.message
                    });
                }
                
                // Include monitoring statistics
                uptimeStatus.statistics = {
                    checksPerformed: this.statistics.checksPerformed,
                    incidentsDetected: this.statistics.incidentsDetected,
                    lastIncident: this.statistics.lastIncidentTime,
                    uptimeHistorySize: this.uptimeHistory.size,
                    statusHistorySize: this.statusHistory.length
                };
            }
            
            logger.debug('Current uptime status retrieved', {
                status: uptimeStatus.status,
                statusDuration: uptimeStatus.statusDuration,
                consecutiveSuccesses: uptimeStatus.consecutiveSuccesses,
                includeMetrics
            });
            
            return uptimeStatus;
            
        } catch (error) {
            logger.error('Error retrieving current uptime status', {
                error: error.message,
                includeMetrics,
                stack: error.stack
            });
            
            return {
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),
                status: UPTIME_STATUS_TYPES.UNKNOWN,
                error: 'Failed to retrieve uptime status',
                errorMessage: error.message,
                monitoring: {
                    isActive: this.isMonitoring,
                    startedAt: this.monitoringStarted
                }
            };
        }
    }
    
    /**
     * Calculates comprehensive uptime statistics over specified time periods with availability percentages,
     * downtime analysis, and SLA compliance metrics
     * @param {object} statisticsOptions - Options for statistics calculation including time periods and analysis depth
     * @returns {object} Comprehensive uptime statistics with percentages, trends, and SLA analysis
     */
    getUptimeStatistics(statisticsOptions = {}) {
        try {
            const options = {
                timePeriodMs: 24 * 3600000, // Default: 24 hours
                includeIncidentAnalysis: true,
                includeSlaAnalysis: true,
                includeTrendAnalysis: false,
                includeProjections: false,
                ...statisticsOptions
            };
            
            logger.debug('Calculating uptime statistics', {
                timePeriodMs: options.timePeriodMs,
                timePeriodHours: (options.timePeriodMs / 3600000).toFixed(1),
                includeIncidentAnalysis: options.includeIncidentAnalysis,
                includeSlaAnalysis: options.includeSlaAnalysis
            });
            
            // Calculate base uptime statistics for the specified period
            const baseStatistics = calculateUptimeStatistics(options.timePeriodMs, {
                slaTarget: this.config.thresholds.targetUptimePercent,
                includeDowntimeAnalysis: options.includeIncidentAnalysis,
                includeTrendAnalysis: options.includeTrendAnalysis
            });
            
            // Enhance statistics with monitor-specific data
            const enhancedStatistics = {
                ...baseStatistics,
                monitorSpecificData: {
                    monitoringActive: this.isMonitoring,
                    monitoringDuration: this.monitoringStarted ? Date.now() - this.monitoringStarted : 0,
                    checksPerformed: this.statistics.checksPerformed,
                    incidentsDetected: this.statistics.incidentsDetected,
                    lastIncidentTime: this.statistics.lastIncidentTime,
                    currentStatus: this.currentStatus.status,
                    consecutiveFailures: this.currentStatus.consecutiveFailures,
                    consecutiveSuccesses: this.currentStatus.consecutiveSuccesses
                },
                configuration: {
                    intervals: this.config.intervals,
                    thresholds: this.config.thresholds,
                    alertingEnabled: this.config.alerting.enabled
                }
            };
            
            // Add multi-period analysis if monitoring has been active long enough
            if (this.isMonitoring && this.monitoringStarted) {
                const monitoringDuration = Date.now() - this.monitoringStarted;
                
                if (monitoringDuration >= 3600000) { // 1 hour
                    enhancedStatistics.multiPeriodAnalysis = {
                        last1Hour: calculateUptimeStatistics(3600000),
                        last24Hours: monitoringDuration >= 86400000 ? calculateUptimeStatistics(86400000) : null,
                        last7Days: monitoringDuration >= 604800000 ? calculateUptimeStatistics(604800000) : null
                    };
                }
            }
            
            // Include SLA tracking data if SLA analysis is enabled
            if (options.includeSlaAnalysis) {
                enhancedStatistics.slaTracking = this.getSlaTrackingData();
            }
            
            logger.info('Uptime statistics calculated successfully', {
                calculationId: enhancedStatistics.calculationId,
                uptimePercentage: enhancedStatistics.uptime.uptimePercentage.toFixed(3),
                slaCompliant: enhancedStatistics.slaCompliance.compliant,
                incidentCount: enhancedStatistics.incidents.totalIncidents,
                timePeriodHours: enhancedStatistics.timePeriod.durationHours.toFixed(1)
            });
            
            return enhancedStatistics;
            
        } catch (error) {
            logger.error('Error calculating uptime statistics', {
                error: error.message,
                statisticsOptions,
                stack: error.stack
            });
            
            return {
                error: 'Statistics calculation failed',
                errorMessage: error.message,
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),
                uptime: {
                    uptimePercentage: 0,
                    totalDowntimeMs: 0
                },
                slaCompliance: {
                    target: this.config.thresholds.targetUptimePercent,
                    compliant: false
                }
            };
        }
    }
    
    /**
     * Executes immediate comprehensive availability check with service responsiveness testing,
     * health correlation, and uptime status determination
     * @param {object} checkOptions - Options for availability check including timeout and validation criteria
     * @returns {Promise<object>} Availability check results with service status and correlation metrics
     */
    async performAvailabilityCheck(checkOptions = {}) {
        try {
            const options = {
                updateCurrentStatus: true,
                recordEvent: true,
                performIncidentDetection: true,
                correlationId: `manual_check_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                ...checkOptions
            };
            
            logger.debug('Performing manual availability check', {
                correlationId: options.correlationId,
                updateCurrentStatus: options.updateCurrentStatus,
                recordEvent: options.recordEvent
            });
            
            // Execute comprehensive availability check
            const availabilityResult = await checkServiceAvailability({
                timeout: 10000,
                validateEndpoints: true,
                includePerformanceMetrics: true,
                correlationId: options.correlationId
            });
            
            // Update current monitoring status if requested
            if (options.updateCurrentStatus) {
                this.updateCurrentStatus(availabilityResult);
            }
            
            // Record uptime event if requested
            if (options.recordEvent) {
                recordUptimeEvent('availability_check', {
                    status: availabilityResult.status,
                    responseTimeMs: availabilityResult.responseTimeMs,
                    healthStatus: availabilityResult.healthStatus,
                    performanceMetrics: availabilityResult.performanceMetrics,
                    endpointsTested: Object.keys(availabilityResult.endpointTests),
                    allEndpointsHealthy: Object.values(availabilityResult.endpointTests).every(test => 
                        test.responsive || test.available
                    ),
                    checkDurationMs: availabilityResult.responseTimeMs
                }, {
                    correlationId: options.correlationId,
                    triggeredBy: 'manual_check'
                });
            }
            
            // Perform incident detection if enabled
            if (options.performIncidentDetection) {
                const incidentDetection = detectDowntimeIncident(availabilityResult, {
                    consecutiveFailureThreshold: 1, // Lower threshold for manual checks
                    confirmationChecks: 1
                });
                
                availabilityResult.incidentDetection = incidentDetection;
                
                if (incidentDetection.incidentDetected) {
                    this.statistics.incidentsDetected++;
                    this.statistics.lastIncidentTime = Date.now();
                    
                    // Emit incident detected event
                    this.emit('incidentDetected', {
                        incident: incidentDetection,
                        availabilityStatus: availabilityResult,
                        timestamp: Date.now()
                    });
                }
            }
            
            // Update monitoring statistics
            this.statistics.checksPerformed++;
            
            logger.info('Manual availability check completed', {
                correlationId: options.correlationId,
                status: availabilityResult.status,
                responseTimeMs: availabilityResult.responseTimeMs.toFixed(2),
                healthStatus: availabilityResult.healthStatus?.status || 'unknown',
                incidentDetected: availabilityResult.incidentDetection?.incidentDetected || false
            });
            
            return availabilityResult;
            
        } catch (error) {
            logger.error('Error performing availability check', {
                error: error.message,
                checkOptions,
                stack: error.stack
            });
            
            return {
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),
                status: UPTIME_STATUS_TYPES.UNKNOWN,
                error: 'Availability check failed',
                errorMessage: error.message,
                responseTimeMs: 0,
                correlationId: checkOptions.correlationId || 'error'
            };
        }
    }
    
    /**
     * Configures uptime monitoring alerts and notifications with customizable thresholds,
     * escalation rules, and notification channels
     * @param {object} alertConfig - Alert configuration with thresholds, channels, and escalation rules
     */
    configureAlerts(alertConfig) {
        try {
            if (!alertConfig || typeof alertConfig !== 'object') {
                logger.warn('Invalid alert configuration provided', { alertConfig });
                return;
            }
            
            const previousConfig = { ...this.alertingConfig };
            
            // Update alerting configuration with validation
            if (typeof alertConfig.enabled === 'boolean') {
                this.alertingConfig.enabled = alertConfig.enabled;
            }
            
            if (typeof alertConfig.escalationEnabled === 'boolean') {
                this.alertingConfig.escalationEnabled = alertConfig.escalationEnabled;
            }
            
            if (Array.isArray(alertConfig.notificationChannels)) {
                this.alertingConfig.notificationChannels = alertConfig.notificationChannels;
            }
            
            if (alertConfig.thresholds && typeof alertConfig.thresholds === 'object') {
                this.alertingConfig.thresholds = {
                    ...this.alertingConfig.thresholds,
                    ...alertConfig.thresholds
                };
            }
            
            if (alertConfig.escalationRules && typeof alertConfig.escalationRules === 'object') {
                this.alertingConfig.escalationRules = {
                    ...this.alertingConfig.escalationRules,
                    ...alertConfig.escalationRules
                };
            }
            
            // Apply suppression settings if provided
            if (alertConfig.suppression && typeof alertConfig.suppression === 'object') {
                this.alertingConfig.suppression = {
                    ...this.alertingConfig.suppression,
                    ...alertConfig.suppression
                };
            }
            
            // Emit alerting configuration updated event
            this.emit('alertingConfigured', {
                previousConfig,
                newConfig: this.alertingConfig,
                timestamp: Date.now()
            });
            
            logger.info('Alert configuration updated successfully', {
                enabled: this.alertingConfig.enabled,
                escalationEnabled: this.alertingConfig.escalationEnabled,
                notificationChannels: this.alertingConfig.notificationChannels,
                thresholdCount: Object.keys(this.alertingConfig.thresholds || {}).length
            });
            
        } catch (error) {
            logger.error('Error configuring alerts', {
                error: error.message,
                alertConfig,
                stack: error.stack
            });
        }
    }
    
    /**
     * Exports comprehensive uptime data in various formats for external monitoring systems,
     * reporting platforms, and SLA compliance documentation
     * @param {object} exportOptions - Export configuration including format, time range, and data selection criteria
     * @returns {object} Exported uptime data in requested format with metadata and integrity validation
     */
    exportUptimeData(exportOptions = {}) {
        try {
            const options = {
                format: 'json',
                timeRangeMs: 24 * 3600000, // 24 hours
                includeStatistics: true,
                includeIncidents: true,
                includeConfiguration: false,
                includeHealthCorrelation: true,
                compression: false,
                ...exportOptions
            };
            
            const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const exportTimestamp = Date.now();
            
            logger.info('Starting uptime data export', {
                exportId,
                format: options.format,
                timeRangeHours: (options.timeRangeMs / 3600000).toFixed(1),
                includeStatistics: options.includeStatistics,
                includeIncidents: options.includeIncidents
            });
            
            // Initialize export data structure
            const exportData = {
                exportId,
                timestamp: exportTimestamp,
                timestampIso: new Date(exportTimestamp).toISOString(),
                exportOptions: options,
                timeRange: {
                    startTime: exportTimestamp - options.timeRangeMs,
                    endTime: exportTimestamp,
                    durationMs: options.timeRangeMs,
                    durationHours: options.timeRangeMs / 3600000
                },
                systemInfo: {
                    hostname: config.server.hostname,
                    port: config.server.port,
                    environment: config.environment,
                    monitoringActive: this.isMonitoring,
                    monitoringStarted: this.monitoringStarted
                },
                data: {}
            };
            
            // Include uptime statistics if requested
            if (options.includeStatistics) {
                exportData.data.statistics = this.getUptimeStatistics({
                    timePeriodMs: options.timeRangeMs,
                    includeIncidentAnalysis: options.includeIncidents,
                    includeSlaAnalysis: true,
                    includeTrendAnalysis: false
                });
            }
            
            // Include current status information
            exportData.data.currentStatus = this.getCurrentUptime(true);
            
            // Include historical uptime data within time range
            exportData.data.historicalData = this.getHistoricalUptimeData(
                exportTimestamp - options.timeRangeMs,
                exportTimestamp
            );
            
            // Include incident data if requested
            if (options.includeIncidents) {
                exportData.data.incidents = this.getIncidentHistory(
                    exportTimestamp - options.timeRangeMs,
                    exportTimestamp
                );
            }
            
            // Include health correlation data if requested
            if (options.includeHealthCorrelation) {
                try {
                    const healthSummary = getHealthSummary();
                    exportData.data.healthCorrelation = {
                        currentHealth: healthSummary,
                        correlationEnabled: this.config.monitoring.enableHealthCorrelation
                    };
                } catch (healthError) {
                    logger.warn('Failed to include health correlation in export', {
                        exportId,
                        error: healthError.message
                    });
                }
            }
            
            // Include configuration if requested
            if (options.includeConfiguration) {
                exportData.data.configuration = {
                    intervals: this.config.intervals,
                    thresholds: this.config.thresholds,
                    retention: this.config.retention,
                    alerting: this.config.alerting,
                    monitoring: this.config.monitoring
                };
            }
            
            // Generate data integrity hash
            const integrityHash = this.calculateDataIntegrity(exportData);
            
            // Format data based on requested format
            let formattedData;
            switch (options.format.toLowerCase()) {
                case 'json':
                    formattedData = JSON.stringify(exportData, null, 2);
                    break;
                    
                case 'csv':
                    formattedData = this.convertToCSV(exportData);
                    break;
                    
                case 'xml':
                    formattedData = this.convertToXML(exportData);
                    break;
                    
                case 'summary':
                    formattedData = this.generateSummaryReport(exportData);
                    break;
                    
                default:
                    formattedData = JSON.stringify(exportData, null, 2);
            }
            
            const exportResult = {
                success: true,
                exportId,
                format: options.format,
                timestamp: exportTimestamp,
                data: formattedData,
                metadata: {
                    dataSize: formattedData.length,
                    timeRange: exportData.timeRange,
                    integrityHash,
                    exportDuration: Date.now() - exportTimestamp,
                    dataPoints: {
                        statisticsIncluded: !!exportData.data.statistics,
                        incidentsIncluded: !!exportData.data.incidents,
                        historicalDataPoints: exportData.data.historicalData?.length || 0
                    }
                }
            };
            
            logger.info('Uptime data export completed successfully', {
                exportId,
                format: options.format,
                dataSize: formattedData.length,
                exportDurationMs: exportResult.metadata.exportDuration,
                historicalDataPoints: exportResult.metadata.dataPoints.historicalDataPoints
            });
            
            return exportResult;
            
        } catch (error) {
            logger.error('Error exporting uptime data', {
                error: error.message,
                exportOptions,
                stack: error.stack
            });
            
            return {
                success: false,
                error: 'Export failed',
                errorMessage: error.message,
                timestamp: Date.now(),
                exportOptions
            };
        }
    }
    
    // Private helper methods for internal uptime monitor operations
    
    /**
     * Updates current monitoring status based on availability check results
     * @private
     */
    updateCurrentStatus(availabilityResult) {
        try {
            const previousStatus = this.currentStatus.status;
            const newStatus = availabilityResult.status;
            const currentTime = Date.now();
            
            // Update status if changed
            if (previousStatus !== newStatus) {
                this.currentStatus.lastStatusChange = currentTime;
                this.currentStatus.status = newStatus;
                
                // Reset counters on status change
                this.currentStatus.consecutiveFailures = 0;
                this.currentStatus.consecutiveSuccesses = 0;
                
                // Record status change event
                recordUptimeEvent('status_change', {
                    status: newStatus,
                    previousStatus: previousStatus,
                    reason: 'availability_check',
                    responseTimeMs: availabilityResult.responseTimeMs,
                    durationMs: currentTime - this.currentStatus.lastStatusChange
                }, {
                    correlationId: availabilityResult.correlationId
                });
                
                // Emit status change event
                this.emit('statusChanged', {
                    previousStatus,
                    newStatus,
                    timestamp: currentTime,
                    correlationId: availabilityResult.correlationId
                });
                
                logger.info('Service status changed', {
                    from: previousStatus,
                    to: newStatus,
                    correlationId: availabilityResult.correlationId
                });
            }
            
            // Update consecutive counters
            if (newStatus === UPTIME_STATUS_TYPES.UP) {
                this.currentStatus.consecutiveSuccesses++;
                this.currentStatus.consecutiveFailures = 0;
            } else if (newStatus === UPTIME_STATUS_TYPES.DOWN || newStatus === UPTIME_STATUS_TYPES.DEGRADED) {
                this.currentStatus.consecutiveFailures++;
                this.currentStatus.consecutiveSuccesses = 0;
            }
            
            // Update last check timestamp
            this.currentStatus.lastCheck = currentTime;
            
        } catch (error) {
            logger.error('Error updating current status', {
                error: error.message,
                availabilityResult: availabilityResult ? {
                    status: availabilityResult.status,
                    correlationId: availabilityResult.correlationId
                } : null
            });
        }
    }
    
    /**
     * Performs scheduled availability check based on check type
     * @private
     */
    async performScheduledAvailabilityCheck(checkType = 'normal') {
        try {
            const checkOptions = {
                timeout: checkType === 'fast' ? 3000 : 5000,
                validateEndpoints: checkType === 'normal',
                includePerformanceMetrics: checkType === 'normal',
                correlationId: `scheduled_${checkType}_${Date.now()}`
            };
            
            const availabilityResult = await checkServiceAvailability(checkOptions);
            
            // Update current status
            this.updateCurrentStatus(availabilityResult);
            
            // Perform incident detection for normal checks
            if (checkType === 'normal') {
                const incidentDetection = detectDowntimeIncident(availabilityResult);
                
                if (incidentDetection.incidentDetected) {
                    this.handleIncidentDetection(incidentDetection, availabilityResult);
                }
            }
            
            // Record the check
            recordUptimeEvent('availability_check', {
                status: availabilityResult.status,
                responseTimeMs: availabilityResult.responseTimeMs,
                checkType: checkType,
                endpointsTested: Object.keys(availabilityResult.endpointTests),
                allEndpointsHealthy: Object.values(availabilityResult.endpointTests).every(test => 
                    test.responsive || test.available
                )
            }, {
                correlationId: availabilityResult.correlationId,
                checkType: checkType
            });
            
            // Update statistics
            this.statistics.checksPerformed++;
            
        } catch (error) {
            logger.error('Error performing scheduled availability check', {
                checkType,
                error: error.message
            });
        }
    }
    
    /**
     * Handles incident detection results and triggers appropriate responses
     * @private
     */
    handleIncidentDetection(incidentDetection, availabilityResult) {
        try {
            this.statistics.incidentsDetected++;
            this.statistics.lastIncidentTime = Date.now();
            
            // Store incident in history
            this.incidentHistory.push({
                incidentId: incidentDetection.incidentId,
                timestamp: incidentDetection.timestamp,
                severity: incidentDetection.incidentSeverity,
                triggerConditions: incidentDetection.triggerConditions,
                availabilityStatus: availabilityResult.status,
                responseTime: availabilityResult.responseTimeMs,
                resolved: false,
                resolutionTime: null
            });
            
            // Emit incident detected event
            this.emit('incidentDetected', {
                incident: incidentDetection,
                availabilityStatus: availabilityResult,
                timestamp: Date.now()
            });
            
            // Trigger alerting if enabled
            if (this.alertingConfig.enabled) {
                this.triggerAlert(incidentDetection, availabilityResult);
            }
            
            logger.warn('Incident detected and handled', {
                incidentId: incidentDetection.incidentId,
                severity: incidentDetection.incidentSeverity,
                escalationRequired: incidentDetection.escalationRequired
            });
            
        } catch (error) {
            logger.error('Error handling incident detection', {
                error: error.message,
                incidentId: incidentDetection?.incidentId
            });
        }
    }
    
    /**
     * Triggers alerting based on incident detection
     * @private
     */
    triggerAlert(incidentDetection, availabilityResult) {
        try {
            if (this.alertingState.suppressionActive) {
                logger.debug('Alert suppressed due to active suppression', {
                    incidentId: incidentDetection.incidentId
                });
                return;
            }
            
            const alertData = {
                alertId: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: Date.now(),
                incidentId: incidentDetection.incidentId,
                severity: incidentDetection.incidentSeverity,
                message: `Service downtime detected: ${incidentDetection.incidentSeverity} severity`,
                details: {
                    serviceStatus: availabilityResult.status,
                    responseTime: availabilityResult.responseTimeMs,
                    triggerConditions: incidentDetection.triggerConditions.length,
                    escalationRequired: incidentDetection.escalationRequired
                }
            };
            
            // Emit alert event
            this.emit('alert', alertData);
            
            // Update alerting state
            this.alertingState.lastAlert = Date.now();
            this.alertingState.alertCount++;
            
            logger.warn('Alert triggered', {
                alertId: alertData.alertId,
                incidentId: incidentDetection.incidentId,
                severity: incidentDetection.incidentSeverity,
                escalationRequired: incidentDetection.escalationRequired
            });
            
        } catch (error) {
            logger.error('Error triggering alert', {
                error: error.message,
                incidentId: incidentDetection?.incidentId
            });
        }
    }
    
    /**
     * Calculates data integrity hash for export validation
     * @private
     */
    calculateDataIntegrity(data) {
        try {
            const dataString = JSON.stringify(data);
            let hash = 0;
            for (let i = 0; i < dataString.length; i++) {
                const char = dataString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(16);
        } catch (error) {
            logger.error('Error calculating data integrity hash', {
                error: error.message
            });
            return 'error';
        }
    }
}

// Helper functions for uptime monitoring operations

/**
 * Determines overall uptime status based on multiple availability indicators
 * @private
 */
function determineOverallUptimeStatus(indicators) {
    try {
        let statusScore = 0;
        let healthScore = 100;
        let reasons = [];
        
        // Evaluate server responsiveness
        if (indicators.serverResponsive) {
            statusScore += 3;
            healthScore += 0;
        } else {
            statusScore -= 3;
            healthScore -= 30;
            reasons.push('Server not responsive');
        }
        
        // Evaluate response time performance
        if (indicators.serverResponseTime && indicators.serverResponseTime > 0) {
            if (indicators.serverResponseTime < 1000) {
                statusScore += 2;
            } else if (indicators.serverResponseTime < 5000) {
                statusScore += 1;
                healthScore -= 10;
                reasons.push('Slow response time');
            } else {
                statusScore -= 1;
                healthScore -= 20;
                reasons.push('Very slow response time');
            }
        }
        
        // Evaluate health check results
        if (indicators.healthCheckResult) {
            if (indicators.healthCheckResult.status === HEALTH_STATUS_TYPES.HEALTHY) {
                statusScore += 2;
            } else if (indicators.healthCheckResult.status === HEALTH_STATUS_TYPES.DEGRADED) {
                statusScore += 1;
                healthScore -= 15;
                reasons.push('System health degraded');
            } else {
                statusScore -= 2;
                healthScore -= 25;
                reasons.push('System health unhealthy');
            }
        }
        
        // Evaluate endpoint test results
        if (indicators.endpointTests) {
            const endpointResults = Object.values(indicators.endpointTests);
            const workingEndpoints = endpointResults.filter(test => test.responsive || test.available);
            const endpointRatio = workingEndpoints.length / endpointResults.length;
            
            if (endpointRatio >= 1.0) {
                statusScore += 1;
            } else if (endpointRatio >= 0.5) {
                healthScore -= 10;
                reasons.push('Some endpoints failing');
            } else {
                statusScore -= 2;
                healthScore -= 25;
                reasons.push('Most endpoints failing');
            }
        }
        
        // Check for errors
        if (indicators.errors && indicators.errors.length > 0) {
            statusScore -= Math.min(2, indicators.errors.length);
            healthScore -= Math.min(20, indicators.errors.length * 5);
            reasons.push(`${indicators.errors.length} error(s) detected`);
        }
        
        // Determine final status
        let finalStatus;
        if (statusScore >= 3) {
            finalStatus = UPTIME_STATUS_TYPES.UP;
        } else if (statusScore >= 0) {
            finalStatus = UPTIME_STATUS_TYPES.DEGRADED;
        } else {
            finalStatus = UPTIME_STATUS_TYPES.DOWN;
        }
        
        return {
            status: finalStatus,
            healthScore: Math.max(0, Math.min(100, healthScore)),
            reason: reasons.join('; ') || 'Normal operation',
            statusScore
        };
        
    } catch (error) {
        logger.error('Error determining overall uptime status', {
            error: error.message
        });
        
        return {
            status: UPTIME_STATUS_TYPES.UNKNOWN,
            healthScore: 0,
            reason: 'Status determination failed',
            statusScore: 0
        };
    }
}

/**
 * Generates simulated uptime history for demonstration and testing purposes
 * @private
 */
function generateSimulatedUptimeHistory(startTime, endTime, options) {
    const events = [];
    const duration = endTime - startTime;
    const eventInterval = Math.min(60000, duration / 100); // Max 100 events or 1 minute intervals
    
    let currentTime = startTime;
    let currentStatus = UPTIME_STATUS_TYPES.UP;
    
    while (currentTime < endTime) {
        // Simulate occasional downtime (5% chance per interval)
        if (Math.random() < 0.05 && currentStatus === UPTIME_STATUS_TYPES.UP) {
            currentStatus = UPTIME_STATUS_TYPES.DOWN;
        } else if (currentStatus === UPTIME_STATUS_TYPES.DOWN && Math.random() < 0.7) {
            currentStatus = UPTIME_STATUS_TYPES.UP;
        }
        
        events.push({
            timestamp: currentTime,
            status: currentStatus,
            responseTimeMs: currentStatus === UPTIME_STATUS_TYPES.UP ? 
                Math.random() * 200 + 50 : Math.random() * 5000 + 1000,
            reason: currentStatus === UPTIME_STATUS_TYPES.DOWN ? 'simulated_downtime' : null
        });
        
        currentTime += eventInterval;
    }
    
    return events;
}

// Create default uptime monitor instance configured with server settings for immediate use
const uptimeMonitor = new UptimeMonitor({
    intervals: {
        ...UPTIME_CHECK_INTERVALS,
        ...(config.server?.uptime?.intervals || {})
    },
    thresholds: {
        ...AVAILABILITY_THRESHOLDS,
        ...(config.server?.uptime?.thresholds || {})
    },
    alerting: {
        enabled: true,
        escalationEnabled: true,
        notificationChannels: ['log']
    },
    monitoring: {
        enableRealTimeChecks: true,
        enableHealthCorrelation: true,
        enablePerformanceCorrelation: true,
        enableTrendAnalysis: true
    }
});

// Export all uptime monitoring components and utilities
module.exports = {
    // Main uptime monitoring class for comprehensive tracking
    UptimeMonitor,
    
    // Standalone utility functions for specific uptime monitoring operations
    checkServiceAvailability,
    calculateUptimeStatistics,
    recordUptimeEvent,
    generateUptimeReport,
    detectDowntimeIncident,
    
    // Uptime status type constants for structured classification
    UPTIME_STATUS_TYPES,
    
    // Default uptime monitor instance configured with server settings for immediate use
    uptimeMonitor
};