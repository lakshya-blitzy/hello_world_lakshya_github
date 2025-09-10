// Node.js Built-in Modules - v20.x LTS
const { EventEmitter } = require('node:events'); // Event-driven metrics collection notifications and real-time data streaming
const { performance } = require('node:perf_hooks'); // High-resolution timing for metrics collection operations and performance measurement
const util = require('node:util'); // Object inspection and deep cloning for metrics data processing and serialization
const process = require('node:process'); // Process metrics collection including memory usage, CPU statistics, and system resource monitoring

// Internal Module Imports - Educational HTTP Server Application Dependencies
const { logger } = require('../lib/logger.js'); // Import logging functionality for metrics collection events and monitoring system notifications
const { serverConfig } = require('../config/server-config.js'); // Import server configuration for performance thresholds and monitoring settings
const { PerformanceMonitor } = require('../utils/performance-monitor.js'); // Import performance monitoring capabilities for real-time metrics collection
const { HealthChecker } = require('../utils/health-checker.js'); // Import health checking functionality for system health metrics collection

/**
 * METRICS COLLECTION TYPES - Classification constants for different types of monitoring data
 * These constants ensure consistent categorization across the metrics collection system
 */
const METRICS_COLLECTION_TYPES = {
    PERFORMANCE: 'performance', // HTTP response times, system resource utilization, throughput measurements
    HEALTH: 'health',           // Component health status, system health indicators, health trend analysis
    UPTIME: 'uptime',          // Availability metrics, uptime statistics, service continuity tracking
    REQUEST: 'request',        // HTTP request count, success rates, error rates, endpoint usage statistics
    SYSTEM: 'system',          // Node.js process metrics, operating system statistics, resource utilization
    ERROR: 'error'             // Error tracking, failure patterns, error rate monitoring
};

/**
 * METRICS STORAGE CONFIGURATION - Settings for time-series data storage and retention management
 * Configured to maintain educational application memory efficiency while providing comprehensive monitoring
 */
const METRICS_STORAGE_CONFIG = {
    maxMemoryUsageMb: 10,           // Maximum memory usage for metrics storage (10MB limit for educational scope)
    retentionHours: 24,             // Retain metrics data for 24 hours to demonstrate historical analysis
    aggregationIntervalMs: 300000,  // Aggregate metrics every 5 minutes for trend analysis
    cleanupIntervalMs: 600000       // Clean up expired metrics every 10 minutes for memory efficiency
};

/**
 * TIME SERIES BUCKETS - Different time window configurations for metrics aggregation
 * Provides multiple aggregation levels for real-time monitoring and historical analysis
 */
const TIME_SERIES_BUCKETS = {
    realTimeMs: 60000,    // 1-minute buckets for real-time monitoring and immediate feedback
    shortTermMs: 3600000, // 1-hour buckets for short-term trend analysis and performance tracking
    longTermMs: 86400000  // 24-hour buckets for long-term pattern analysis and capacity planning
};

/**
 * METRICS EXPORT FORMATS - Supported output formats for external monitoring system integration
 * Enables compatibility with various monitoring tools and business intelligence platforms
 */
const METRICS_EXPORT_FORMATS = {
    JSON: 'json',           // Structured JSON format for API consumption and web dashboards
    CSV: 'csv',            // Comma-separated values for spreadsheet analysis and reporting
    PROMETHEUS: 'prometheus', // Prometheus metrics format for observability stack integration
    PLAIN_TEXT: 'text'     // Human-readable plain text format for debugging and console output
};

/**
 * Stores metrics data in time-series format with automatic aggregation and retention management
 * Provides efficient memory usage for comprehensive monitoring data persistence
 * 
 * @param {string} metricsType - Type of metrics being stored (performance, health, uptime, request, system, error)
 * @param {Object} metricsData - Metrics data object with values, timestamps, and metadata
 * @param {Object} [storageOptions={}] - Optional storage configuration including retention and aggregation settings
 * @returns {boolean} Success status of metrics storage operation
 */
function storeMetrics(metricsType, metricsData, storageOptions = {}) {
    try {
        // Validate metrics type against supported collection types
        if (!Object.values(METRICS_COLLECTION_TYPES).includes(metricsType)) {
            logger.warn('Invalid metrics type provided for storage', { 
                metricsType, 
                validTypes: Object.values(METRICS_COLLECTION_TYPES) 
            });
            return false;
        }

        // Timestamp metrics data with high-resolution timing for accurate chronological ordering
        const timestamp = performance.now();
        const storageEntry = {
            timestamp: timestamp,
            metricsType: metricsType,
            data: util.structuredClone(metricsData), // Deep clone to prevent data modification
            correlationId: metricsData.correlationId || `metrics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...storageOptions
        };

        // Determine appropriate time-series bucket for data storage based on current time and aggregation rules
        const timeBucket = Math.floor(timestamp / TIME_SERIES_BUCKETS.realTimeMs) * TIME_SERIES_BUCKETS.realTimeMs;
        
        // Store metrics in memory-efficient time-series structure using Map for fast access
        if (!global.metricsStorage) {
            global.metricsStorage = new Map();
        }
        
        const bucketKey = `${metricsType}-${timeBucket}`;
        if (!global.metricsStorage.has(bucketKey)) {
            global.metricsStorage.set(bucketKey, []);
        }
        
        global.metricsStorage.get(bucketKey).push(storageEntry);

        // Update metrics indexes for fast retrieval and querying
        if (!global.metricsIndexes) {
            global.metricsIndexes = new Map();
        }
        
        if (!global.metricsIndexes.has(metricsType)) {
            global.metricsIndexes.set(metricsType, []);
        }
        
        global.metricsIndexes.get(metricsType).push({
            timestamp: timestamp,
            bucketKey: bucketKey,
            correlationId: storageEntry.correlationId
        });

        // Log metrics storage operation for audit trail and debugging
        logger.debug('Metrics stored successfully', {
            metricsType: metricsType,
            timestamp: timestamp,
            bucketKey: bucketKey,
            dataSize: JSON.stringify(metricsData).length
        });

        return true;
    } catch (error) {
        // Log storage errors for system monitoring and troubleshooting
        logger.error('Failed to store metrics data', {
            error: error.message,
            metricsType: metricsType,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Retrieves stored metrics data with flexible filtering, time range selection, and aggregation options
 * Enables monitoring dashboard consumption and analysis with efficient query processing
 * 
 * @param {string} metricsType - Type of metrics to retrieve
 * @param {Object} timeRange - Time range specification with start and end timestamps
 * @param {Object} [queryOptions={}] - Query options including aggregation, filtering, and formatting preferences
 * @returns {Array} Array of metrics data objects matching query criteria with timestamps and values
 */
function retrieveMetrics(metricsType, timeRange, queryOptions = {}) {
    try {
        // Validate metrics type and time range parameters
        if (!Object.values(METRICS_COLLECTION_TYPES).includes(metricsType)) {
            logger.warn('Invalid metrics type for retrieval', { metricsType });
            return [];
        }

        if (!timeRange || !timeRange.start || !timeRange.end) {
            logger.warn('Invalid time range provided for metrics retrieval', { timeRange });
            return [];
        }

        // Check if metrics storage exists
        if (!global.metricsStorage || !global.metricsIndexes) {
            logger.info('No metrics storage found, returning empty results');
            return [];
        }

        // Determine optimal time-series bucket for data retrieval based on query time range
        const startBucket = Math.floor(timeRange.start / TIME_SERIES_BUCKETS.realTimeMs) * TIME_SERIES_BUCKETS.realTimeMs;
        const endBucket = Math.floor(timeRange.end / TIME_SERIES_BUCKETS.realTimeMs) * TIME_SERIES_BUCKETS.realTimeMs;
        
        const retrievedMetrics = [];
        
        // Iterate through relevant time buckets to collect matching metrics
        for (let bucket = startBucket; bucket <= endBucket; bucket += TIME_SERIES_BUCKETS.realTimeMs) {
            const bucketKey = `${metricsType}-${bucket}`;
            const bucketData = global.metricsStorage.get(bucketKey);
            
            if (bucketData) {
                // Apply time range filtering to bucket data
                const filteredData = bucketData.filter(entry => 
                    entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
                );
                retrievedMetrics.push(...filteredData);
            }
        }

        // Apply additional filtering based on query criteria
        let filteredResults = retrievedMetrics;
        if (queryOptions.correlationId) {
            filteredResults = filteredResults.filter(entry => 
                entry.correlationId === queryOptions.correlationId
            );
        }

        // Perform data aggregation if specified in query options
        if (queryOptions.aggregation) {
            filteredResults = aggregateMetrics(filteredResults, {
                method: queryOptions.aggregation,
                interval: queryOptions.aggregationInterval || TIME_SERIES_BUCKETS.realTimeMs
            });
        }

        // Format retrieved data according to output preferences
        const formattedResults = filteredResults.map(entry => ({
            timestamp: entry.timestamp,
            metricsType: entry.metricsType,
            data: entry.data,
            correlationId: entry.correlationId,
            metadata: {
                retrievalTime: performance.now(),
                queryOptions: queryOptions
            }
        }));

        // Log metrics retrieval operation for audit and debugging
        logger.debug('Metrics retrieved successfully', {
            metricsType: metricsType,
            timeRange: timeRange,
            resultCount: formattedResults.length,
            queryOptions: queryOptions
        });

        return formattedResults;
    } catch (error) {
        // Log retrieval errors for system monitoring
        logger.error('Failed to retrieve metrics data', {
            error: error.message,
            metricsType: metricsType,
            timeRange: timeRange,
            stack: error.stack
        });
        return [];
    }
}

/**
 * Performs time-series data aggregation operations including statistical calculations and trend analysis
 * Enables historical metrics analysis and data consolidation for long-term storage optimization
 * 
 * @param {Array} rawMetricsData - Array of raw metrics data points for aggregation
 * @param {Object} aggregationConfig - Aggregation configuration including time buckets and statistical methods
 * @returns {Object} Aggregated metrics object with statistical summaries and trend analysis
 */
function aggregateMetrics(rawMetricsData, aggregationConfig) {
    try {
        if (!Array.isArray(rawMetricsData) || rawMetricsData.length === 0) {
            logger.warn('No data provided for metrics aggregation');
            return {
                aggregationTimestamp: performance.now(),
                dataPointsCount: 0,
                aggregatedData: {},
                statisticalSummary: {},
                trendAnalysis: {}
            };
        }

        // Group raw metrics data by configured time intervals
        const timeInterval = aggregationConfig.interval || TIME_SERIES_BUCKETS.realTimeMs;
        const groupedData = new Map();
        
        rawMetricsData.forEach(dataPoint => {
            const timeKey = Math.floor(dataPoint.timestamp / timeInterval) * timeInterval;
            if (!groupedData.has(timeKey)) {
                groupedData.set(timeKey, []);
            }
            groupedData.get(timeKey).push(dataPoint);
        });

        const aggregatedResults = {
            aggregationTimestamp: performance.now(),
            timeWindow: {
                start: Math.min(...rawMetricsData.map(d => d.timestamp)),
                end: Math.max(...rawMetricsData.map(d => d.timestamp))
            },
            dataPointsCount: rawMetricsData.length,
            aggregatedData: {},
            statisticalSummary: {},
            trendAnalysis: {}
        };

        // Calculate statistical aggregations for each time bucket
        groupedData.forEach((dataPoints, timeKey) => {
            const numericValues = dataPoints
                .map(dp => dp.data?.value || dp.data?.responseTime || 0)
                .filter(val => typeof val === 'number' && !isNaN(val));

            if (numericValues.length > 0) {
                // Calculate basic statistical measures
                const sortedValues = numericValues.sort((a, b) => a - b);
                const sum = numericValues.reduce((acc, val) => acc + val, 0);
                const mean = sum / numericValues.length;
                
                aggregatedResults.aggregatedData[timeKey] = {
                    count: numericValues.length,
                    sum: sum,
                    min: sortedValues[0],
                    max: sortedValues[sortedValues.length - 1],
                    mean: mean,
                    median: sortedValues[Math.floor(sortedValues.length / 2)],
                    p95: sortedValues[Math.floor(sortedValues.length * 0.95)],
                    p99: sortedValues[Math.floor(sortedValues.length * 0.99)]
                };

                // Calculate standard deviation for statistical analysis
                const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
                aggregatedResults.aggregatedData[timeKey].standardDeviation = Math.sqrt(variance);
            }
        });

        // Generate trend analysis and change detection calculations
        const timeKeys = Array.from(groupedData.keys()).sort((a, b) => a - b);
        if (timeKeys.length > 1) {
            const firstPeriod = aggregatedResults.aggregatedData[timeKeys[0]];
            const lastPeriod = aggregatedResults.aggregatedData[timeKeys[timeKeys.length - 1]];
            
            if (firstPeriod && lastPeriod) {
                aggregatedResults.trendAnalysis = {
                    trend: lastPeriod.mean > firstPeriod.mean ? 'increasing' : 'decreasing',
                    changeRate: ((lastPeriod.mean - firstPeriod.mean) / firstPeriod.mean) * 100,
                    volatility: Math.max(...Object.values(aggregatedResults.aggregatedData).map(d => d.standardDeviation || 0)),
                    dataQuality: {
                        completeness: (Object.keys(aggregatedResults.aggregatedData).length / timeKeys.length) * 100,
                        consistency: 100 - (Math.abs(aggregatedResults.trendAnalysis?.volatility || 0) / lastPeriod.mean * 100)
                    }
                };
            }
        }

        // Log aggregation operation and performance statistics
        logger.debug('Metrics aggregation completed', {
            inputDataPoints: rawMetricsData.length,
            outputBuckets: Object.keys(aggregatedResults.aggregatedData).length,
            aggregationMethod: aggregationConfig.method,
            processingTime: performance.now() - aggregatedResults.aggregationTimestamp
        });

        return aggregatedResults;
    } catch (error) {
        logger.error('Failed to aggregate metrics data', {
            error: error.message,
            dataPointsCount: rawMetricsData?.length || 0,
            aggregationConfig: aggregationConfig,
            stack: error.stack
        });
        
        return {
            aggregationTimestamp: performance.now(),
            dataPointsCount: 0,
            aggregatedData: {},
            statisticalSummary: {},
            trendAnalysis: {},
            error: error.message
        };
    }
}

/**
 * Performs automatic cleanup of expired metrics data based on retention policies
 * Maintains memory efficiency and prevents storage overflow while preserving essential data
 * 
 * @param {boolean} [forceCleanup=false] - Whether to perform immediate cleanup regardless of schedule
 * @returns {Object} Cleanup operation results with removed data statistics and memory recovery information
 */
function cleanupExpiredMetrics(forceCleanup = false) {
    try {
        const cleanupStartTime = performance.now();
        const initialMemoryUsage = process.memoryUsage();
        
        // Check if cleanup should be performed based on schedule or force flag
        const lastCleanupTime = global.lastMetricsCleanup || 0;
        const timeSinceLastCleanup = cleanupStartTime - lastCleanupTime;
        
        if (!forceCleanup && timeSinceLastCleanup < METRICS_STORAGE_CONFIG.cleanupIntervalMs) {
            logger.debug('Metrics cleanup skipped - not yet time for scheduled cleanup', {
                timeSinceLastCleanup: timeSinceLastCleanup,
                cleanupInterval: METRICS_STORAGE_CONFIG.cleanupIntervalMs
            });
            return { skipped: true, reason: 'Not yet time for cleanup' };
        }

        // Calculate metrics data expiration based on retention policies
        const retentionThreshold = cleanupStartTime - (METRICS_STORAGE_CONFIG.retentionHours * 3600 * 1000);
        let removedBuckets = 0;
        let removedDataPoints = 0;
        let consolidatedDataPoints = 0;

        // Clean up expired data from metrics storage
        if (global.metricsStorage) {
            const bucketsToRemove = [];
            
            global.metricsStorage.forEach((bucketData, bucketKey) => {
                // Extract timestamp from bucket key to determine expiration
                const bucketTimestamp = parseFloat(bucketKey.split('-').pop());
                
                if (bucketTimestamp < retentionThreshold) {
                    // Perform data consolidation before removal if configured
                    if (bucketData.length > 0) {
                        const consolidatedData = {
                            timestamp: bucketTimestamp,
                            metricsType: bucketData[0].metricsType,
                            data: {
                                consolidated: true,
                                originalCount: bucketData.length,
                                summary: aggregateMetrics(bucketData, { interval: TIME_SERIES_BUCKETS.longTermMs })
                            }
                        };
                        
                        // Store consolidated data in long-term storage (could be extended to file system)
                        consolidatedDataPoints++;
                    }
                    
                    removedDataPoints += bucketData.length;
                    bucketsToRemove.push(bucketKey);
                }
            });

            // Remove expired buckets from storage
            bucketsToRemove.forEach(bucketKey => {
                global.metricsStorage.delete(bucketKey);
                removedBuckets++;
            });
        }

        // Clean up expired entries from metrics indexes
        if (global.metricsIndexes) {
            global.metricsIndexes.forEach((indexData, metricsType) => {
                const filteredIndexes = indexData.filter(entry => entry.timestamp >= retentionThreshold);
                global.metricsIndexes.set(metricsType, filteredIndexes);
            });
        }

        // Update last cleanup timestamp
        global.lastMetricsCleanup = cleanupStartTime;

        // Calculate memory recovery statistics
        const finalMemoryUsage = process.memoryUsage();
        const memoryRecovered = initialMemoryUsage.heapUsed - finalMemoryUsage.heapUsed;
        const cleanupDuration = performance.now() - cleanupStartTime;

        const cleanupResults = {
            timestamp: cleanupStartTime,
            duration: cleanupDuration,
            removedBuckets: removedBuckets,
            removedDataPoints: removedDataPoints,
            consolidatedDataPoints: consolidatedDataPoints,
            memoryRecovered: memoryRecovered,
            retentionThreshold: retentionThreshold,
            forceCleanup: forceCleanup
        };

        // Log cleanup operation results for monitoring and audit
        logger.info('Metrics cleanup completed successfully', cleanupResults);

        // Emit cleanup completed event for monitoring integration
        if (global.metricsEventEmitter) {
            global.metricsEventEmitter.emit('cleanup-completed', cleanupResults);
        }

        return cleanupResults;
    } catch (error) {
        logger.error('Failed to cleanup expired metrics', {
            error: error.message,
            forceCleanup: forceCleanup,
            stack: error.stack
        });
        
        return {
            timestamp: performance.now(),
            error: error.message,
            removedBuckets: 0,
            removedDataPoints: 0
        };
    }
}

/**
 * Exports metrics data in various formats for external monitoring systems and analysis platforms
 * Supports multiple output formats with comprehensive formatting options and metadata inclusion
 * 
 * @param {string} exportFormat - Output format (json, csv, prometheus, text)
 * @param {Object} exportOptions - Export configuration including time range, metrics types, and formatting preferences
 * @returns {string} Formatted metrics data in requested export format
 */
function exportMetricsData(exportFormat, exportOptions = {}) {
    try {
        // Validate export format and configuration options
        if (!Object.values(METRICS_EXPORT_FORMATS).includes(exportFormat)) {
            logger.warn('Invalid export format requested', { 
                exportFormat, 
                validFormats: Object.values(METRICS_EXPORT_FORMATS) 
            });
            return '';
        }

        const exportStartTime = performance.now();
        
        // Retrieve metrics data based on export criteria
        const timeRange = exportOptions.timeRange || {
            start: performance.now() - (3600 * 1000), // Default to last hour
            end: performance.now()
        };

        const metricsTypes = exportOptions.metricsTypes || Object.values(METRICS_COLLECTION_TYPES);
        let allMetricsData = [];

        // Collect data for all requested metrics types
        metricsTypes.forEach(metricsType => {
            const typeData = retrieveMetrics(metricsType, timeRange, exportOptions.queryOptions);
            allMetricsData = allMetricsData.concat(typeData);
        });

        // Sort data by timestamp for chronological export
        allMetricsData.sort((a, b) => a.timestamp - b.timestamp);

        let exportedData = '';
        const exportMetadata = {
            exportTimestamp: exportStartTime,
            exportFormat: exportFormat,
            dataPointsCount: allMetricsData.length,
            timeRange: timeRange,
            metricsTypes: metricsTypes
        };

        // Apply format-specific data transformation and serialization
        switch (exportFormat) {
            case METRICS_EXPORT_FORMATS.JSON:
                exportedData = JSON.stringify({
                    metadata: exportMetadata,
                    data: allMetricsData
                }, null, exportOptions.prettify ? 2 : 0);
                break;

            case METRICS_EXPORT_FORMATS.CSV:
                // Generate CSV headers
                const csvHeaders = ['timestamp', 'metricsType', 'correlationId', 'dataValue', 'responseTime', 'errorCount'];
                let csvContent = csvHeaders.join(',') + '\n';
                
                // Convert data to CSV format
                allMetricsData.forEach(entry => {
                    const csvRow = [
                        new Date(entry.timestamp).toISOString(),
                        entry.metricsType,
                        entry.correlationId,
                        entry.data?.value || '',
                        entry.data?.responseTime || '',
                        entry.data?.errorCount || ''
                    ].join(',');
                    csvContent += csvRow + '\n';
                });
                
                exportedData = csvContent;
                break;

            case METRICS_EXPORT_FORMATS.PROMETHEUS:
                // Generate Prometheus metrics format
                let prometheusMetrics = '';
                prometheusMetrics += `# HELP nodejs_tutorial_requests_total Total number of HTTP requests\n`;
                prometheusMetrics += `# TYPE nodejs_tutorial_requests_total counter\n`;
                
                const requestMetrics = allMetricsData.filter(d => d.metricsType === METRICS_COLLECTION_TYPES.REQUEST);
                const totalRequests = requestMetrics.length;
                prometheusMetrics += `nodejs_tutorial_requests_total ${totalRequests}\n`;
                
                prometheusMetrics += `# HELP nodejs_tutorial_response_time_seconds Response time in seconds\n`;
                prometheusMetrics += `# TYPE nodejs_tutorial_response_time_seconds histogram\n`;
                
                const responseTimes = allMetricsData
                    .filter(d => d.data?.responseTime)
                    .map(d => d.data.responseTime / 1000);
                
                if (responseTimes.length > 0) {
                    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                    prometheusMetrics += `nodejs_tutorial_response_time_seconds_sum ${avgResponseTime * totalRequests}\n`;
                    prometheusMetrics += `nodejs_tutorial_response_time_seconds_count ${totalRequests}\n`;
                }
                
                exportedData = prometheusMetrics;
                break;

            case METRICS_EXPORT_FORMATS.PLAIN_TEXT:
                // Generate human-readable text format
                exportedData = `=== Node.js Tutorial Metrics Export ===\n`;
                exportedData += `Export Time: ${new Date(exportStartTime).toISOString()}\n`;
                exportedData += `Data Points: ${allMetricsData.length}\n`;
                exportedData += `Time Range: ${new Date(timeRange.start).toISOString()} to ${new Date(timeRange.end).toISOString()}\n\n`;
                
                // Group data by metrics type for readable output
                const groupedByType = {};
                allMetricsData.forEach(entry => {
                    if (!groupedByType[entry.metricsType]) {
                        groupedByType[entry.metricsType] = [];
                    }
                    groupedByType[entry.metricsType].push(entry);
                });
                
                Object.keys(groupedByType).forEach(metricsType => {
                    exportedData += `--- ${metricsType.toUpperCase()} METRICS ---\n`;
                    groupedByType[metricsType].forEach(entry => {
                        exportedData += `${new Date(entry.timestamp).toISOString()}: ${JSON.stringify(entry.data)}\n`;
                    });
                    exportedData += '\n';
                });
                break;

            default:
                throw new Error(`Unsupported export format: ${exportFormat}`);
        }

        // Log export operation for audit and monitoring purposes
        const exportDuration = performance.now() - exportStartTime;
        logger.info('Metrics data exported successfully', {
            exportFormat: exportFormat,
            dataPointsCount: allMetricsData.length,
            exportSize: exportedData.length,
            duration: exportDuration,
            timeRange: timeRange
        });

        return exportedData;
    } catch (error) {
        logger.error('Failed to export metrics data', {
            error: error.message,
            exportFormat: exportFormat,
            exportOptions: exportOptions,
            stack: error.stack
        });
        return '';
    }
}

/**
 * Calculates comprehensive statistics for metrics data including distributions and performance indicators
 * Provides statistical analysis for monitoring dashboard consumption and trend analysis
 * 
 * @param {Array} metricsDataArray - Array of metrics data for statistical analysis
 * @param {Object} [statisticsOptions={}] - Options for statistical calculations and analysis scope
 * @returns {Object} Statistics object with distributions, correlations, and performance indicators
 */
function calculateMetricsStatistics(metricsDataArray, statisticsOptions = {}) {
    try {
        if (!Array.isArray(metricsDataArray) || metricsDataArray.length === 0) {
            logger.warn('No data provided for statistics calculation');
            return {
                calculationTimestamp: performance.now(),
                dataPointsCount: 0,
                basicStatistics: {},
                distributions: {},
                performanceIndicators: {},
                correlations: {}
            };
        }

        const calculationStartTime = performance.now();
        
        // Extract numeric values for statistical analysis
        const numericValues = metricsDataArray
            .map(entry => entry.data?.value || entry.data?.responseTime || 0)
            .filter(val => typeof val === 'number' && !isNaN(val))
            .sort((a, b) => a - b);

        // Calculate basic statistical measures
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const mean = numericValues.length > 0 ? sum / numericValues.length : 0;
        const median = numericValues.length > 0 ? 
            numericValues[Math.floor(numericValues.length / 2)] : 0;

        // Calculate variance and standard deviation
        const variance = numericValues.length > 0 ?
            numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length : 0;
        const standardDeviation = Math.sqrt(variance);

        // Generate percentile distributions and quartile analysis
        const percentiles = {};
        const percentileKeys = [25, 50, 75, 90, 95, 99];
        percentileKeys.forEach(percentile => {
            const index = Math.floor((percentile / 100) * numericValues.length);
            percentiles[`p${percentile}`] = numericValues[Math.min(index, numericValues.length - 1)] || 0;
        });

        // Calculate performance indicators and threshold compliance
        const performanceThresholds = serverConfig.performance || {};
        const performanceIndicators = {
            throughput: metricsDataArray.filter(d => d.metricsType === METRICS_COLLECTION_TYPES.REQUEST).length,
            averageResponseTime: mean,
            errorRate: (metricsDataArray.filter(d => d.metricsType === METRICS_COLLECTION_TYPES.ERROR).length / metricsDataArray.length) * 100,
            thresholdCompliance: {
                responseTimeThreshold: performanceThresholds.responseTimeThreshold || 100,
                responseTimeCompliance: (numericValues.filter(val => val <= (performanceThresholds.responseTimeThreshold || 100)).length / numericValues.length) * 100
            }
        };

        // Perform correlation analysis between different metrics types
        const correlationAnalysis = {};
        const metricsTypeGroups = {};
        
        // Group metrics by type for correlation calculation
        metricsDataArray.forEach(entry => {
            if (!metricsTypeGroups[entry.metricsType]) {
                metricsTypeGroups[entry.metricsType] = [];
            }
            metricsTypeGroups[entry.metricsType].push(entry);
        });

        // Calculate correlation between performance and error metrics
        const performanceData = metricsTypeGroups[METRICS_COLLECTION_TYPES.PERFORMANCE] || [];
        const errorData = metricsTypeGroups[METRICS_COLLECTION_TYPES.ERROR] || [];
        
        if (performanceData.length > 0 && errorData.length > 0) {
            correlationAnalysis.performanceErrorCorrelation = calculateCorrelation(
                performanceData.map(d => d.data?.responseTime || 0),
                errorData.map(d => d.data?.errorCount || 0)
            );
        }

        const statisticsResults = {
            calculationTimestamp: calculationStartTime,
            dataPointsCount: metricsDataArray.length,
            processingDuration: performance.now() - calculationStartTime,
            basicStatistics: {
                count: numericValues.length,
                sum: sum,
                mean: mean,
                median: median,
                min: numericValues[0] || 0,
                max: numericValues[numericValues.length - 1] || 0,
                standardDeviation: standardDeviation,
                variance: variance
            },
            distributions: {
                percentiles: percentiles,
                quartiles: {
                    q1: percentiles.p25,
                    q2: percentiles.p50,
                    q3: percentiles.p75,
                    iqr: percentiles.p75 - percentiles.p25
                }
            },
            performanceIndicators: performanceIndicators,
            correlations: correlationAnalysis,
            dataQuality: {
                completeness: (numericValues.length / metricsDataArray.length) * 100,
                outliers: numericValues.filter(val => 
                    val < (mean - 2 * standardDeviation) || val > (mean + 2 * standardDeviation)
                ).length
            }
        };

        logger.debug('Metrics statistics calculated successfully', {
            dataPointsCount: metricsDataArray.length,
            processingDuration: statisticsResults.processingDuration,
            statisticsOptions: statisticsOptions
        });

        return statisticsResults;
    } catch (error) {
        logger.error('Failed to calculate metrics statistics', {
            error: error.message,
            dataPointsCount: metricsDataArray?.length || 0,
            statisticsOptions: statisticsOptions,
            stack: error.stack
        });
        
        return {
            calculationTimestamp: performance.now(),
            dataPointsCount: 0,
            basicStatistics: {},
            distributions: {},
            performanceIndicators: {},
            correlations: {},
            error: error.message
        };
    }
}

/**
 * Helper function to calculate correlation coefficient between two data series
 * Used for correlation analysis between different metrics types
 * 
 * @param {Array} seriesA - First data series
 * @param {Array} seriesB - Second data series
 * @returns {number} Pearson correlation coefficient (-1 to 1)
 */
function calculateCorrelation(seriesA, seriesB) {
    if (seriesA.length !== seriesB.length || seriesA.length === 0) {
        return 0;
    }

    const n = seriesA.length;
    const sumA = seriesA.reduce((acc, val) => acc + val, 0);
    const sumB = seriesB.reduce((acc, val) => acc + val, 0);
    const sumAB = seriesA.reduce((acc, val, i) => acc + (val * seriesB[i]), 0);
    const sumA2 = seriesA.reduce((acc, val) => acc + (val * val), 0);
    const sumB2 = seriesB.reduce((acc, val) => acc + (val * val), 0);

    const numerator = (n * sumAB) - (sumA * sumB);
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

    return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * MetricsCollector - Central metrics collection orchestrator that manages comprehensive monitoring data aggregation
 * 
 * This class serves as the main interface for metrics collection, providing unified access to performance monitoring,
 * health checking, and system metrics collection with configurable intervals and automatic data management.
 * Educational implementation demonstrates metrics collection patterns and monitoring system integration.
 */
class MetricsCollector extends EventEmitter {
    /**
     * Initialize MetricsCollector with configuration, monitoring components, and storage infrastructure
     * Sets up time-series storage, collection intervals, and automatic retention management
     * 
     * @param {Object} [config={}] - Metrics collector configuration with storage and collection settings
     */
    constructor(config = {}) {
        super();

        // Store and validate metrics collector configuration parameters
        this.config = {
            // Collection intervals for different metrics types (in milliseconds)
            collectionIntervals: {
                performance: config.performanceInterval || 5000,    // Collect performance metrics every 5 seconds
                health: config.healthInterval || 30000,           // Collect health metrics every 30 seconds  
                system: config.systemInterval || 10000,           // Collect system metrics every 10 seconds
                uptime: config.uptimeInterval || 60000,           // Collect uptime metrics every minute
                request: config.requestInterval || 1000,          // Collect request metrics every second
                aggregation: config.aggregationInterval || 300000  // Aggregate data every 5 minutes
            },
            // Storage configuration settings
            storage: {
                maxMemoryMb: config.maxMemoryMb || METRICS_STORAGE_CONFIG.maxMemoryUsageMb,
                retentionHours: config.retentionHours || METRICS_STORAGE_CONFIG.retentionHours,
                cleanupInterval: config.cleanupInterval || METRICS_STORAGE_CONFIG.cleanupIntervalMs
            },
            // Export and integration settings
            export: {
                defaultFormat: config.defaultExportFormat || METRICS_EXPORT_FORMATS.JSON,
                includeMetadata: config.includeMetadata !== false
            }
        };

        // Initialize time-series metrics storage using efficient Map structures for fast access
        this.metricsStorage = global.metricsStorage || new Map();
        global.metricsStorage = this.metricsStorage;

        // Set up storage indexes for fast metrics retrieval and querying operations
        this.metricsIndexes = global.metricsIndexes || new Map();
        global.metricsIndexes = this.metricsIndexes;

        // Create performance monitor instance for system metrics integration
        this.performanceMonitor = new PerformanceMonitor({
            enableDetailedMetrics: true,
            trackingEnabled: true
        });

        // Initialize health checker instance for health metrics collection
        this.healthChecker = new HealthChecker({
            enableHealthHistory: true,
            performanceThresholds: serverConfig.performance
        });

        // Configure collection intervals for different metrics types
        this.collectionIntervals = new Map();

        // Set collection state to inactive initially
        this.isCollecting = false;

        // Initialize storage statistics tracking and monitoring overhead measurement
        this.storageStatistics = {
            totalDataPoints: 0,
            storageUsageBytes: 0,
            collectionCount: 0,
            lastCleanupTime: 0,
            performanceOverhead: 0
        };

        // Set up automatic cleanup timers for expired data retention
        this.setupAutomaticCleanup();

        // Configure event emitter for real-time metrics streaming
        global.metricsEventEmitter = this;

        // Log successful initialization
        logger.info('MetricsCollector initialized successfully', {
            config: this.config,
            performanceMonitorEnabled: !!this.performanceMonitor,
            healthCheckerEnabled: !!this.healthChecker
        });
    }

    /**
     * Set up automatic cleanup operations for expired metrics data
     * Configures periodic cleanup to maintain memory efficiency and storage optimization
     * 
     * @private
     */
    setupAutomaticCleanup() {
        // Set up periodic cleanup based on configuration
        setInterval(() => {
            if (this.isCollecting) {
                const cleanupResults = cleanupExpiredMetrics();
                this.storageStatistics.lastCleanupTime = performance.now();
                
                // Emit cleanup event for monitoring integration
                this.emit('cleanup-completed', cleanupResults);
                
                // Update storage statistics after cleanup
                this.updateStorageStatistics();
            }
        }, this.config.storage.cleanupInterval);

        logger.debug('Automatic cleanup configured', {
            cleanupInterval: this.config.storage.cleanupInterval,
            retentionHours: this.config.storage.retentionHours
        });
    }

    /**
     * Update internal storage statistics for monitoring and reporting
     * Tracks storage usage, data points, and collection performance metrics
     * 
     * @private
     */
    updateStorageStatistics() {
        try {
            let totalDataPoints = 0;
            let storageUsageBytes = 0;

            // Calculate total data points across all storage buckets
            this.metricsStorage.forEach((bucketData, bucketKey) => {
                totalDataPoints += bucketData.length;
                storageUsageBytes += JSON.stringify(bucketData).length;
            });

            // Update statistics object
            this.storageStatistics = {
                ...this.storageStatistics,
                totalDataPoints: totalDataPoints,
                storageUsageBytes: storageUsageBytes,
                storageMegabytes: storageUsageBytes / (1024 * 1024),
                lastUpdated: performance.now()
            };

            // Emit storage statistics update event
            this.emit('storage-statistics-updated', this.storageStatistics);
        } catch (error) {
            logger.error('Failed to update storage statistics', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Initiates comprehensive metrics collection across all monitoring components
     * Configures collection intervals and starts automatic data aggregation with real-time streaming
     * 
     * @param {Object} [collectionOptions={}] - Collection configuration including intervals, metrics types, and aggregation settings
     * @returns {Object} Collection session object with control methods and status information
     */
    startCollection(collectionOptions = {}) {
        try {
            if (this.isCollecting) {
                logger.warn('Metrics collection already active', { currentState: this.isCollecting });
                return { success: false, reason: 'Collection already active' };
            }

            const collectionStartTime = performance.now();

            // Merge collection options with default configuration
            const effectiveOptions = {
                ...this.config.collectionIntervals,
                ...collectionOptions
            };

            // Validate collection configuration and initialize metrics storage
            this.validateCollectionConfiguration(effectiveOptions);

            // Start performance metrics collection with configured intervals
            if (effectiveOptions.performance > 0) {
                const performanceInterval = setInterval(() => {
                    this.collectPerformanceMetrics({
                        includeSystemMetrics: true,
                        includeProcessMetrics: true
                    });
                }, effectiveOptions.performance);

                this.collectionIntervals.set('performance', performanceInterval);
                logger.debug('Performance metrics collection started', { interval: effectiveOptions.performance });
            }

            // Initialize health metrics collection with health checker integration
            if (effectiveOptions.health > 0) {
                const healthInterval = setInterval(() => {
                    this.collectHealthMetrics(true); // Include detailed health analysis
                }, effectiveOptions.health);

                this.collectionIntervals.set('health', healthInterval);
                logger.debug('Health metrics collection started', { interval: effectiveOptions.health });
            }

            // Set up uptime metrics collection and availability tracking
            if (effectiveOptions.uptime > 0) {
                const uptimeInterval = setInterval(() => {
                    this.collectUptimeMetrics();
                }, effectiveOptions.uptime);

                this.collectionIntervals.set('uptime', uptimeInterval);
                logger.debug('Uptime metrics collection started', { interval: effectiveOptions.uptime });
            }

            // Start system resource metrics collection using process monitoring
            if (effectiveOptions.system > 0) {
                const systemInterval = setInterval(() => {
                    this.collectSystemMetrics();
                }, effectiveOptions.system);

                this.collectionIntervals.set('system', systemInterval);
                logger.debug('System metrics collection started', { interval: effectiveOptions.system });
            }

            // Initialize automatic data aggregation and retention management
            if (effectiveOptions.aggregation > 0) {
                const aggregationInterval = setInterval(() => {
                    this.performPeriodicAggregation();
                }, effectiveOptions.aggregation);

                this.collectionIntervals.set('aggregation', aggregationInterval);
                logger.debug('Metrics aggregation started', { interval: effectiveOptions.aggregation });
            }

            // Set collection state to active and emit collection started event
            this.isCollecting = true;
            const collectionSession = {
                sessionId: `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                startTime: collectionStartTime,
                options: effectiveOptions,
                stop: () => this.stopCollection(),
                getStatus: () => this.getCollectionStatus()
            };

            // Emit collection started event for monitoring integration
            this.emit('collection-started', {
                sessionId: collectionSession.sessionId,
                startTime: collectionStartTime,
                options: effectiveOptions
            });

            // Log successful collection startup
            logger.info('Metrics collection started successfully', {
                sessionId: collectionSession.sessionId,
                intervals: effectiveOptions,
                startupTime: performance.now() - collectionStartTime
            });

            return { success: true, session: collectionSession };
        } catch (error) {
            logger.error('Failed to start metrics collection', {
                error: error.message,
                collectionOptions: collectionOptions,
                stack: error.stack
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Validates collection configuration parameters and ensures valid intervals
     * Prevents invalid configuration that could cause performance issues
     * 
     * @param {Object} options - Collection configuration to validate
     * @private
     */
    validateCollectionConfiguration(options) {
        // Validate collection intervals are reasonable
        Object.keys(options).forEach(key => {
            const interval = options[key];
            if (typeof interval !== 'number' || interval < 0) {
                throw new Error(`Invalid collection interval for ${key}: ${interval}`);
            }
            
            // Warn about very frequent collection intervals that might impact performance
            if (interval > 0 && interval < 1000) {
                logger.warn(`Very frequent collection interval configured for ${key}`, { 
                    interval: interval,
                    recommendation: 'Consider increasing interval for better performance' 
                });
            }
        });
    }

    /**
     * Gracefully stops metrics collection, completes in-progress operations, and performs final data consolidation
     * Ensures all metrics data is properly stored and collection resources are cleaned up
     * 
     * @returns {void} No return value, performs collection cleanup operations
     */
    stopCollection() {
        try {
            if (!this.isCollecting) {
                logger.warn('Metrics collection is not currently active');
                return;
            }

            const stopStartTime = performance.now();

            // Clear all collection intervals and scheduled operations
            this.collectionIntervals.forEach((interval, intervalType) => {
                clearInterval(interval);
                logger.debug(`Cleared ${intervalType} collection interval`);
            });
            this.collectionIntervals.clear();

            // Complete any in-progress metrics aggregation operations
            try {
                this.performPeriodicAggregation();
                logger.debug('Completed final metrics aggregation');
            } catch (aggregationError) {
                logger.warn('Error during final aggregation', { error: aggregationError.message });
            }

            // Perform final data consolidation and storage optimization
            const finalCleanup = cleanupExpiredMetrics(true); // Force cleanup
            
            // Generate collection session summary with statistics
            const sessionSummary = {
                stopTime: stopStartTime,
                totalDataPoints: this.storageStatistics.totalDataPoints,
                storageUsage: this.storageStatistics.storageMegabytes,
                collectionDuration: stopStartTime - (global.collectionStartTime || stopStartTime),
                finalCleanup: finalCleanup
            };

            // Set collection state to inactive and emit collection stopped event
            this.isCollecting = false;
            this.emit('collection-stopped', sessionSummary);

            // Log collection session statistics and performance metrics
            logger.info('Metrics collection stopped successfully', {
                ...sessionSummary,
                stopDuration: performance.now() - stopStartTime
            });
        } catch (error) {
            logger.error('Error stopping metrics collection', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Get current collection status and statistics
     * Provides real-time information about collection state and performance
     * 
     * @returns {Object} Current collection status with statistics and performance metrics
     */
    getCollectionStatus() {
        try {
            // Update storage statistics before returning status
            this.updateStorageStatistics();

            const currentStatus = {
                isCollecting: this.isCollecting,
                activeIntervals: Array.from(this.collectionIntervals.keys()),
                storageStatistics: this.storageStatistics,
                configuration: this.config,
                performanceMetrics: {
                    performanceMonitorStatus: this.performanceMonitor ? 'active' : 'inactive',
                    healthCheckerStatus: this.healthChecker ? 'active' : 'inactive',
                    memoryUsage: process.memoryUsage(),
                    uptime: process.uptime() * 1000 // Convert to milliseconds
                },
                timestamp: performance.now()
            };

            return currentStatus;
        } catch (error) {
            logger.error('Error retrieving collection status', {
                error: error.message,
                stack: error.stack
            });

            return {
                isCollecting: this.isCollecting,
                error: error.message,
                timestamp: performance.now()
            };
        }
    }

    /**
     * Collects real-time performance metrics including response times, throughput, and system resource utilization
     * Integrates with PerformanceMonitor for comprehensive performance data collection with timestamp correlation
     * 
     * @param {Object} [collectionScope={}] - Scope configuration for performance metrics collection
     * @returns {Object} Performance metrics data object with timestamps and correlation information
     */
    collectPerformanceMetrics(collectionScope = {}) {
        try {
            const collectionStartTime = performance.now();

            // Retrieve current performance snapshot from performance monitor
            const performanceSnapshot = this.performanceMonitor.getPerformanceSnapshot();
            
            // Collect HTTP response time metrics and request throughput data
            const httpMetrics = {
                averageResponseTime: performanceSnapshot.timing?.averageResponseTime || 0,
                requestThroughput: performanceSnapshot.throughput?.requestsPerSecond || 0,
                activeConnections: performanceSnapshot.connections?.active || 0,
                totalRequests: performanceSnapshot.counters?.totalRequests || 0
            };

            // Gather system resource utilization including memory and CPU usage
            const systemMetrics = performanceSnapshot.system || {};
            const resourceUtilization = {
                memoryUsage: {
                    heapUsed: systemMetrics.memoryUsage?.heapUsed || 0,
                    heapTotal: systemMetrics.memoryUsage?.heapTotal || 0,
                    external: systemMetrics.memoryUsage?.external || 0,
                    rss: systemMetrics.memoryUsage?.rss || 0
                },
                cpuUsage: systemMetrics.cpuUsage || { user: 0, system: 0 }
            };

            // Measure event loop lag and Node.js process performance indicators
            const eventLoopLag = performanceSnapshot.eventLoop?.lag || 0;
            const processMetrics = {
                uptime: process.uptime() * 1000,
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform
            };

            // Include performance threshold compliance and violation tracking
            const performanceThresholds = serverConfig.performance || {};
            const thresholdCompliance = {
                responseTimeThreshold: performanceThresholds.responseTimeThreshold || 100,
                responseTimeCompliant: httpMetrics.averageResponseTime <= (performanceThresholds.responseTimeThreshold || 100),
                memoryThreshold: performanceThresholds.memoryThreshold || (50 * 1024 * 1024), // 50MB default
                memoryCompliant: resourceUtilization.memoryUsage.heapUsed <= (performanceThresholds.memoryThreshold || (50 * 1024 * 1024))
            };

            // Compile comprehensive performance metrics object
            const performanceMetrics = {
                timestamp: collectionStartTime,
                correlationId: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                http: httpMetrics,
                system: resourceUtilization,
                eventLoop: {
                    lag: eventLoopLag,
                    utilization: performanceSnapshot.eventLoop?.utilization || 0
                },
                process: processMetrics,
                thresholds: thresholdCompliance,
                collectionScope: collectionScope,
                collectionDuration: performance.now() - collectionStartTime
            };

            // Store performance metrics in time-series storage with indexes
            const storageSuccess = storeMetrics(METRICS_COLLECTION_TYPES.PERFORMANCE, performanceMetrics);
            
            if (storageSuccess) {
                // Update collection statistics
                this.storageStatistics.collectionCount++;
                this.storageStatistics.performanceOverhead += performanceMetrics.collectionDuration;

                // Emit real-time performance metrics event
                this.emit('performance-metrics-collected', performanceMetrics);

                logger.debug('Performance metrics collected successfully', {
                    correlationId: performanceMetrics.correlationId,
                    averageResponseTime: httpMetrics.averageResponseTime,
                    memoryUsage: resourceUtilization.memoryUsage.heapUsed,
                    collectionDuration: performanceMetrics.collectionDuration
                });
            }

            return performanceMetrics;
        } catch (error) {
            logger.error('Failed to collect performance metrics', {
                error: error.message,
                collectionScope: collectionScope,
                stack: error.stack
            });

            // Return basic error metrics to maintain collection continuity
            return {
                timestamp: performance.now(),
                correlationId: `perf-error-${Date.now()}`,
                error: error.message,
                collectionScope: collectionScope
            };
        }
    }

    /**
     * Collects comprehensive health metrics including component health status and system health indicators
     * Integrates with HealthChecker for health trend analysis with correlation tracking
     * 
     * @param {boolean} [includeDetailed=false] - Whether to include detailed health component analysis
     * @returns {Object} Health metrics data object with component status and trend information
     */
    collectHealthMetrics(includeDetailed = false) {
        try {
            const collectionStartTime = performance.now();

            // Retrieve current health summary from health checker component
            const healthSummary = this.healthChecker.getHealthSummary();

            // Collect individual component health status and metrics
            const componentHealth = {
                serverHealth: healthSummary.components?.server || { status: 'unknown', score: 0 },
                systemHealth: healthSummary.components?.system || { status: 'unknown', score: 0 },
                processHealth: healthSummary.components?.process || { status: 'unknown', score: 0 },
                performanceHealth: healthSummary.components?.performance || { status: 'unknown', score: 0 }
            };

            // Gather system health indicators and resource availability
            const systemHealthIndicators = {
                overallScore: healthSummary.overallScore || 0,
                overallStatus: healthSummary.overallStatus || 'unknown',
                healthGrade: healthSummary.healthGrade || 'F',
                activeAlerts: healthSummary.alerts?.length || 0,
                recommendations: healthSummary.recommendations?.length || 0
            };

            // Include health threshold compliance and violation tracking
            const healthThresholds = serverConfig.health || {};
            const thresholdCompliance = {
                minimumHealthScore: healthThresholds.minimumScore || 70,
                scoreCompliant: systemHealthIndicators.overallScore >= (healthThresholds.minimumScore || 70),
                criticalAlerts: healthSummary.alerts?.filter(alert => alert.severity === 'critical').length || 0,
                warningAlerts: healthSummary.alerts?.filter(alert => alert.severity === 'warning').length || 0
            };

            // Calculate health trend indicators and change detection
            const healthTrends = this.calculateHealthTrends(systemHealthIndicators.overallScore);

            // Compile comprehensive health metrics object
            const healthMetrics = {
                timestamp: collectionStartTime,
                correlationId: `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                overall: systemHealthIndicators,
                components: componentHealth,
                thresholds: thresholdCompliance,
                trends: healthTrends,
                alerts: includeDetailed ? healthSummary.alerts : [],
                recommendations: includeDetailed ? healthSummary.recommendations : [],
                includeDetailed: includeDetailed,
                collectionDuration: performance.now() - collectionStartTime
            };

            // Store health metrics in time-series storage with status indexing
            const storageSuccess = storeMetrics(METRICS_COLLECTION_TYPES.HEALTH, healthMetrics);

            if (storageSuccess) {
                // Update collection statistics
                this.storageStatistics.collectionCount++;

                // Emit real-time health metrics event
                this.emit('health-metrics-collected', healthMetrics);

                logger.debug('Health metrics collected successfully', {
                    correlationId: healthMetrics.correlationId,
                    overallScore: systemHealthIndicators.overallScore,
                    overallStatus: systemHealthIndicators.overallStatus,
                    activeAlerts: systemHealthIndicators.activeAlerts,
                    collectionDuration: healthMetrics.collectionDuration
                });
            }

            return healthMetrics;
        } catch (error) {
            logger.error('Failed to collect health metrics', {
                error: error.message,
                includeDetailed: includeDetailed,
                stack: error.stack
            });

            // Return basic error metrics to maintain collection continuity
            return {
                timestamp: performance.now(),
                correlationId: `health-error-${Date.now()}`,
                error: error.message,
                includeDetailed: includeDetailed
            };
        }
    }

    /**
     * Calculate health trend indicators based on historical health scores
     * Provides trend analysis and change detection for health monitoring
     * 
     * @param {number} currentHealthScore - Current health score for trend calculation
     * @returns {Object} Health trend analysis with change indicators
     * @private
     */
    calculateHealthTrends(currentHealthScore) {
        try {
            // Retrieve recent health metrics for trend analysis
            const recentTimeRange = {
                start: performance.now() - (3600 * 1000), // Last hour
                end: performance.now()
            };

            const recentHealthMetrics = retrieveMetrics(METRICS_COLLECTION_TYPES.HEALTH, recentTimeRange);
            
            if (recentHealthMetrics.length < 2) {
                return {
                    trend: 'insufficient_data',
                    changeRate: 0,
                    dataPoints: recentHealthMetrics.length
                };
            }

            // Calculate health score trend
            const healthScores = recentHealthMetrics.map(metric => metric.data?.overall?.overallScore || 0);
            const firstScore = healthScores[0];
            const lastScore = healthScores[healthScores.length - 1];
            
            const changeRate = firstScore > 0 ? ((lastScore - firstScore) / firstScore) * 100 : 0;
            const trend = changeRate > 5 ? 'improving' : changeRate < -5 ? 'degrading' : 'stable';

            return {
                trend: trend,
                changeRate: changeRate,
                currentScore: currentHealthScore,
                previousScore: firstScore,
                dataPoints: healthScores.length,
                averageScore: healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
            };
        } catch (error) {
            logger.warn('Error calculating health trends', { error: error.message });
            return {
                trend: 'error',
                changeRate: 0,
                currentScore: currentHealthScore,
                error: error.message
            };
        }
    }

    /**
     * Collects system-level metrics including operating system statistics and Node.js process metrics
     * Provides comprehensive system resource utilization data with trend analysis
     * 
     * @returns {Object} System metrics data object with resource usage and process statistics
     */
    collectSystemMetrics() {
        try {
            const collectionStartTime = performance.now();

            // Collect Node.js process metrics including memory and CPU usage
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            const processMetrics = {
                memory: {
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                    external: memoryUsage.external,
                    rss: memoryUsage.rss,
                    usagePercentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system,
                    total: cpuUsage.user + cpuUsage.system
                },
                uptime: process.uptime() * 1000, // Convert to milliseconds
                pid: process.pid,
                ppid: process.ppid
            };

            // Gather operating system statistics and resource availability
            const systemInfo = {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                title: process.title,
                execPath: process.execPath,
                cwd: process.cwd()
            };

            // Include disk usage and file system health indicators (basic implementation)
            const resourceMetrics = {
                loadAverage: [], // Would be populated on Unix systems
                freeMemory: 0,   // Would be populated with os.freemem()
                totalMemory: 0,  // Would be populated with os.totalmem()
                networkConnections: 0 // Would be populated with network monitoring
            };

            // Track garbage collection performance and memory trends
            const gcMetrics = {
                // These would be populated with --expose-gc flag and gc monitoring
                collections: 0,
                timeSpent: 0,
                lastGc: 0
            };

            // Compile comprehensive system metrics object
            const systemMetrics = {
                timestamp: collectionStartTime,
                correlationId: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                process: processMetrics,
                system: systemInfo,
                resources: resourceMetrics,
                garbageCollection: gcMetrics,
                environment: {
                    nodeEnv: process.env.NODE_ENV || 'development',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    locale: Intl.DateTimeFormat().resolvedOptions().locale
                },
                collectionDuration: performance.now() - collectionStartTime
            };

            // Store system metrics in time-series storage with resource indexing
            const storageSuccess = storeMetrics(METRICS_COLLECTION_TYPES.SYSTEM, systemMetrics);

            if (storageSuccess) {
                // Update collection statistics
                this.storageStatistics.collectionCount++;

                // Emit real-time system metrics event
                this.emit('system-metrics-collected', systemMetrics);

                logger.debug('System metrics collected successfully', {
                    correlationId: systemMetrics.correlationId,
                    memoryUsage: processMetrics.memory.heapUsed,
                    cpuUsage: processMetrics.cpu.total,
                    uptime: processMetrics.uptime,
                    collectionDuration: systemMetrics.collectionDuration
                });
            }

            return systemMetrics;
        } catch (error) {
            logger.error('Failed to collect system metrics', {
                error: error.message,
                stack: error.stack
            });

            // Return basic error metrics to maintain collection continuity
            return {
                timestamp: performance.now(),
                correlationId: `system-error-${Date.now()}`,
                error: error.message
            };
        }
    }

    /**
     * Collects uptime metrics and availability statistics
     * Tracks service availability and uptime patterns for reliability analysis
     * 
     * @returns {Object} Uptime metrics data object with availability statistics
     * @private
     */
    collectUptimeMetrics() {
        try {
            const collectionStartTime = performance.now();
            const processUptimeMs = process.uptime() * 1000;

            // Calculate uptime statistics
            const uptimeMetrics = {
                timestamp: collectionStartTime,
                correlationId: `uptime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                uptime: {
                    processUptimeMs: processUptimeMs,
                    processUptimeHours: processUptimeMs / (1000 * 60 * 60),
                    startTime: Date.now() - processUptimeMs
                },
                availability: {
                    status: 'running',
                    isHealthy: this.isCollecting,
                    lastRestart: global.lastRestartTime || (Date.now() - processUptimeMs)
                },
                collectionDuration: performance.now() - collectionStartTime
            };

            // Store uptime metrics
            const storageSuccess = storeMetrics(METRICS_COLLECTION_TYPES.UPTIME, uptimeMetrics);

            if (storageSuccess) {
                this.storageStatistics.collectionCount++;
                this.emit('uptime-metrics-collected', uptimeMetrics);
            }

            return uptimeMetrics;
        } catch (error) {
            logger.error('Failed to collect uptime metrics', {
                error: error.message,
                stack: error.stack
            });

            return {
                timestamp: performance.now(),
                correlationId: `uptime-error-${Date.now()}`,
                error: error.message
            };
        }
    }

    /**
     * Performs periodic aggregation of collected metrics data
     * Consolidates raw metrics into aggregated summaries for long-term analysis
     * 
     * @private
     */
    performPeriodicAggregation() {
        try {
            const aggregationStartTime = performance.now();

            // Define aggregation time window (last aggregation interval)
            const aggregationWindow = {
                start: aggregationStartTime - this.config.collectionIntervals.aggregation,
                end: aggregationStartTime
            };

            // Perform aggregation for each metrics type
            Object.values(METRICS_COLLECTION_TYPES).forEach(metricsType => {
                const rawData = retrieveMetrics(metricsType, aggregationWindow);
                
                if (rawData.length > 0) {
                    const aggregatedData = aggregateMetrics(rawData, {
                        interval: this.config.collectionIntervals.aggregation,
                        method: 'comprehensive'
                    });

                    // Store aggregated metrics
                    storeMetrics(`${metricsType}-aggregated`, aggregatedData, {
                        isAggregated: true,
                        originalDataPoints: rawData.length
                    });

                    logger.debug(`Aggregated ${metricsType} metrics`, {
                        originalDataPoints: rawData.length,
                        aggregationWindow: aggregationWindow
                    });
                }
            });

            const aggregationDuration = performance.now() - aggregationStartTime;
            logger.debug('Periodic aggregation completed', { duration: aggregationDuration });

            // Emit aggregation completed event
            this.emit('aggregation-completed', {
                timestamp: aggregationStartTime,
                duration: aggregationDuration,
                window: aggregationWindow
            });
        } catch (error) {
            logger.error('Error during periodic aggregation', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Returns comprehensive metrics summary with current values, historical trends, and statistical analysis
     * Provides data for monitoring dashboard consumption and operational insights
     * 
     * @param {Object} [summaryOptions={}] - Summary configuration including time ranges and aggregation preferences
     * @returns {Object} Metrics summary object with current values, trends, and statistical analysis
     */
    getMetricsSummary(summaryOptions = {}) {
        try {
            const summaryStartTime = performance.now();

            // Define default time ranges for summary analysis
            const timeRanges = {
                realTime: {
                    start: summaryStartTime - (5 * 60 * 1000), // Last 5 minutes
                    end: summaryStartTime
                },
                shortTerm: {
                    start: summaryStartTime - (60 * 60 * 1000), // Last hour
                    end: summaryStartTime
                },
                longTerm: {
                    start: summaryStartTime - (24 * 60 * 60 * 1000), // Last 24 hours
                    end: summaryStartTime
                }
            };

            // Use provided time range or default to real-time
            const queryTimeRange = summaryOptions.timeRange || timeRanges.realTime;

            // Retrieve current metrics values across all collection types
            const currentMetrics = {};
            Object.values(METRICS_COLLECTION_TYPES).forEach(metricsType => {
                const metricsData = retrieveMetrics(metricsType, queryTimeRange, {
                    limit: summaryOptions.limit || 100
                });
                currentMetrics[metricsType] = metricsData;
            });

            // Calculate metrics trends and change indicators for specified time ranges
            const trendAnalysis = {};
            Object.keys(currentMetrics).forEach(metricsType => {
                if (currentMetrics[metricsType].length > 0) {
                    const statistics = calculateMetricsStatistics(currentMetrics[metricsType], {
                        includeTrends: true,
                        includeCorrelations: summaryOptions.includeCorrelations
                    });
                    trendAnalysis[metricsType] = statistics;
                }
            });

            // Generate statistical summaries and distribution analysis
            const overallStatistics = {
                totalDataPoints: Object.values(currentMetrics).reduce((sum, data) => sum + data.length, 0),
                collectionStatus: this.getCollectionStatus(),
                storageStatistics: this.storageStatistics,
                performanceOverview: {
                    averageCollectionTime: this.storageStatistics.performanceOverhead / Math.max(this.storageStatistics.collectionCount, 1),
                    storageEfficiency: this.storageStatistics.storageMegabytes / Math.max(this.storageStatistics.totalDataPoints, 1) * 1024 * 1024 // Bytes per data point
                }
            };

            // Include threshold compliance status and violation tracking
            const complianceStatus = this.calculateComplianceStatus(currentMetrics);

            // Compile comprehensive metrics summary
            const metricsSummary = {
                timestamp: summaryStartTime,
                timeRange: queryTimeRange,
                currentMetrics: currentMetrics,
                trends: trendAnalysis,
                statistics: overallStatistics,
                compliance: complianceStatus,
                recommendations: this.generateRecommendations(trendAnalysis, complianceStatus),
                summaryOptions: summaryOptions,
                generationDuration: performance.now() - summaryStartTime
            };

            // Log summary generation for audit purposes
            logger.debug('Metrics summary generated successfully', {
                timeRange: queryTimeRange,
                totalDataPoints: overallStatistics.totalDataPoints,
                generationDuration: metricsSummary.generationDuration
            });

            return metricsSummary;
        } catch (error) {
            logger.error('Failed to generate metrics summary', {
                error: error.message,
                summaryOptions: summaryOptions,
                stack: error.stack
            });

            // Return basic error summary
            return {
                timestamp: performance.now(),
                error: error.message,
                currentMetrics: {},
                trends: {},
                statistics: {},
                summaryOptions: summaryOptions
            };
        }
    }

    /**
     * Calculate compliance status for performance and health thresholds
     * Analyzes current metrics against configured thresholds and SLAs
     * 
     * @param {Object} currentMetrics - Current metrics data for compliance analysis
     * @returns {Object} Compliance status with threshold violations and recommendations
     * @private
     */
    calculateComplianceStatus(currentMetrics) {
        try {
            const performanceMetrics = currentMetrics[METRICS_COLLECTION_TYPES.PERFORMANCE] || [];
            const healthMetrics = currentMetrics[METRICS_COLLECTION_TYPES.HEALTH] || [];
            const systemMetrics = currentMetrics[METRICS_COLLECTION_TYPES.SYSTEM] || [];

            const thresholds = serverConfig.performance || {};

            // Calculate performance compliance
            const performanceCompliance = {
                responseTime: {
                    threshold: thresholds.responseTimeThreshold || 100,
                    compliant: 0,
                    violations: 0,
                    complianceRate: 0
                },
                memory: {
                    threshold: thresholds.memoryThreshold || (50 * 1024 * 1024),
                    compliant: 0,
                    violations: 0,
                    complianceRate: 0
                }
            };

            // Analyze performance compliance
            performanceMetrics.forEach(metric => {
                const responseTime = metric.data?.http?.averageResponseTime || 0;
                if (responseTime <= performanceCompliance.responseTime.threshold) {
                    performanceCompliance.responseTime.compliant++;
                } else {
                    performanceCompliance.responseTime.violations++;
                }
            });

            // Calculate compliance rates
            const totalPerformanceMetrics = performanceMetrics.length;
            if (totalPerformanceMetrics > 0) {
                performanceCompliance.responseTime.complianceRate = 
                    (performanceCompliance.responseTime.compliant / totalPerformanceMetrics) * 100;
            }

            // Analyze health compliance
            const healthCompliance = {
                overallScore: {
                    threshold: 70,
                    compliant: 0,
                    violations: 0,
                    complianceRate: 0
                }
            };

            healthMetrics.forEach(metric => {
                const healthScore = metric.data?.overall?.overallScore || 0;
                if (healthScore >= healthCompliance.overallScore.threshold) {
                    healthCompliance.overallScore.compliant++;
                } else {
                    healthCompliance.overallScore.violations++;
                }
            });

            const totalHealthMetrics = healthMetrics.length;
            if (totalHealthMetrics > 0) {
                healthCompliance.overallScore.complianceRate = 
                    (healthCompliance.overallScore.compliant / totalHealthMetrics) * 100;
            }

            return {
                performance: performanceCompliance,
                health: healthCompliance,
                overall: {
                    compliant: performanceCompliance.responseTime.complianceRate >= 95 && 
                              healthCompliance.overallScore.complianceRate >= 95,
                    score: (performanceCompliance.responseTime.complianceRate + 
                           healthCompliance.overallScore.complianceRate) / 2
                }
            };
        } catch (error) {
            logger.warn('Error calculating compliance status', { error: error.message });
            return {
                performance: {},
                health: {},
                overall: { compliant: false, score: 0 },
                error: error.message
            };
        }
    }

    /**
     * Generate recommendations based on metrics trends and compliance status
     * Provides actionable insights for system optimization and issue resolution
     * 
     * @param {Object} trendAnalysis - Trend analysis data
     * @param {Object} complianceStatus - Compliance status analysis
     * @returns {Array} Array of recommendations with priorities and actions
     * @private
     */
    generateRecommendations(trendAnalysis, complianceStatus) {
        const recommendations = [];

        try {
            // Performance-based recommendations
            if (complianceStatus.performance?.responseTime?.complianceRate < 95) {
                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    title: 'Response Time Threshold Violations',
                    description: `Response time compliance is ${complianceStatus.performance.responseTime.complianceRate.toFixed(1)}%, below the 95% target`,
                    action: 'Review application performance, optimize slow endpoints, consider caching strategies',
                    timestamp: performance.now()
                });
            }

            // Health-based recommendations
            if (complianceStatus.health?.overallScore?.complianceRate < 90) {
                recommendations.push({
                    type: 'health',
                    priority: 'medium',
                    title: 'Health Score Below Target',
                    description: `Health compliance is ${complianceStatus.health.overallScore.complianceRate.toFixed(1)}%, below the 90% target`,
                    action: 'Investigate health check failures, monitor system resources, check for error patterns',
                    timestamp: performance.now()
                });
            }

            // Storage optimization recommendations
            if (this.storageStatistics.storageMegabytes > 8) { // 80% of 10MB limit
                recommendations.push({
                    type: 'storage',
                    priority: 'low',
                    title: 'High Metrics Storage Usage',
                    description: `Metrics storage is using ${this.storageStatistics.storageMegabytes.toFixed(1)}MB, approaching the 10MB limit`,
                    action: 'Consider reducing retention period or increasing cleanup frequency',
                    timestamp: performance.now()
                });
            }

            // Collection efficiency recommendations
            const avgCollectionTime = this.storageStatistics.performanceOverhead / Math.max(this.storageStatistics.collectionCount, 1);
            if (avgCollectionTime > 50) { // 50ms average collection time
                recommendations.push({
                    type: 'efficiency',
                    priority: 'low',
                    title: 'High Collection Overhead',
                    description: `Average metrics collection time is ${avgCollectionTime.toFixed(1)}ms, which may impact performance`,
                    action: 'Review collection intervals, optimize metrics collection logic, consider sampling',
                    timestamp: performance.now()
                });
            }
        } catch (error) {
            logger.warn('Error generating recommendations', { error: error.message });
            recommendations.push({
                type: 'system',
                priority: 'low',
                title: 'Recommendation Generation Error',
                description: `Unable to generate recommendations: ${error.message}`,
                action: 'Review metrics collection system logs for detailed error information',
                timestamp: performance.now()
            });
        }

        return recommendations;
    }

    /**
     * Provides flexible metrics querying interface with time range filtering, aggregation options, and export formatting
     * Enables comprehensive analysis and reporting with advanced filtering capabilities
     * 
     * @param {Object} query - Query specification including metrics types, time ranges, and filtering criteria
     * @returns {Object} Query results object with filtered metrics data and execution metadata
     */
    queryMetrics(query) {
        try {
            const queryStartTime = performance.now();

            // Parse and validate query specification and parameters
            const validatedQuery = this.validateQuery(query);
            if (!validatedQuery.isValid) {
                return {
                    success: false,
                    error: validatedQuery.errors,
                    timestamp: queryStartTime,
                    executionTime: performance.now() - queryStartTime
                };
            }

            // Apply time range filtering to metrics storage indexes
            const timeRange = query.timeRange || {
                start: queryStartTime - (3600 * 1000), // Default to last hour
                end: queryStartTime
            };

            const metricsTypes = query.metricsTypes || Object.values(METRICS_COLLECTION_TYPES);
            let queryResults = [];

            // Retrieve data for requested metrics types
            metricsTypes.forEach(metricsType => {
                const typeData = retrieveMetrics(metricsType, timeRange, {
                    correlationId: query.correlationId,
                    limit: query.limit,
                    aggregation: query.aggregation
                });
                queryResults = queryResults.concat(typeData);
            });

            // Apply additional filtering based on query criteria and conditions
            if (query.filters) {
                queryResults = this.applyQueryFilters(queryResults, query.filters);
            }

            // Perform data aggregation if specified in query options
            let processedResults = queryResults;
            if (query.aggregation) {
                const aggregatedData = aggregateMetrics(queryResults, {
                    interval: query.aggregationInterval || TIME_SERIES_BUCKETS.realTimeMs,
                    method: query.aggregation
                });
                processedResults = [aggregatedData];
            }

            // Apply statistical calculations and trend analysis if requested
            let statisticalAnalysis = {};
            if (query.includeStatistics) {
                statisticalAnalysis = calculateMetricsStatistics(queryResults, {
                    includeCorrelations: query.includeCorrelations,
                    includeTrends: query.includeTrends
                });
            }

            // Format query results according to output preferences
            const formattedResults = {
                success: true,
                query: validatedQuery.query,
                results: processedResults,
                statistics: statisticalAnalysis,
                metadata: {
                    queryTimestamp: queryStartTime,
                    executionTime: performance.now() - queryStartTime,
                    resultCount: processedResults.length,
                    originalDataPoints: queryResults.length,
                    timeRange: timeRange,
                    metricsTypes: metricsTypes
                }
            };

            // Log query execution for audit and performance monitoring
            logger.debug('Metrics query executed successfully', {
                executionTime: formattedResults.metadata.executionTime,
                resultCount: formattedResults.metadata.resultCount,
                metricsTypes: metricsTypes,
                timeRange: timeRange
            });

            return formattedResults;
        } catch (error) {
            logger.error('Failed to execute metrics query', {
                error: error.message,
                query: query,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message,
                query: query,
                results: [],
                timestamp: performance.now()
            };
        }
    }

    /**
     * Validate query parameters and structure
     * Ensures query is well-formed and contains valid parameters
     * 
     * @param {Object} query - Query object to validate
     * @returns {Object} Validation result with errors if any
     * @private
     */
    validateQuery(query) {
        const errors = [];
        
        try {
            // Validate time range
            if (query.timeRange) {
                if (!query.timeRange.start || !query.timeRange.end) {
                    errors.push('Time range must include both start and end timestamps');
                }
                if (query.timeRange.start >= query.timeRange.end) {
                    errors.push('Time range start must be before end');
                }
                if (query.timeRange.end - query.timeRange.start > (7 * 24 * 60 * 60 * 1000)) {
                    errors.push('Time range cannot exceed 7 days');
                }
            }

            // Validate metrics types
            if (query.metricsTypes) {
                const invalidTypes = query.metricsTypes.filter(type => 
                    !Object.values(METRICS_COLLECTION_TYPES).includes(type)
                );
                if (invalidTypes.length > 0) {
                    errors.push(`Invalid metrics types: ${invalidTypes.join(', ')}`);
                }
            }

            // Validate limits
            if (query.limit && (typeof query.limit !== 'number' || query.limit < 1 || query.limit > 10000)) {
                errors.push('Limit must be a number between 1 and 10000');
            }

            return {
                isValid: errors.length === 0,
                errors: errors,
                query: query
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Query validation error: ${error.message}`],
                query: query
            };
        }
    }

    /**
     * Apply additional filters to query results
     * Enables advanced filtering based on custom criteria
     * 
     * @param {Array} results - Query results to filter
     * @param {Object} filters - Filter criteria to apply
     * @returns {Array} Filtered results
     * @private
     */
    applyQueryFilters(results, filters) {
        try {
            let filteredResults = results;

            // Apply correlation ID filter
            if (filters.correlationId) {
                filteredResults = filteredResults.filter(result => 
                    result.correlationId === filters.correlationId
                );
            }

            // Apply value range filters
            if (filters.valueRange) {
                filteredResults = filteredResults.filter(result => {
                    const value = result.data?.value || result.data?.responseTime || 0;
                    return value >= (filters.valueRange.min || 0) && 
                           value <= (filters.valueRange.max || Number.MAX_VALUE);
                });
            }

            // Apply custom filter functions
            if (filters.customFilter && typeof filters.customFilter === 'function') {
                filteredResults = filteredResults.filter(filters.customFilter);
            }

            return filteredResults;
        } catch (error) {
            logger.warn('Error applying query filters', { 
                error: error.message,
                filtersCount: Object.keys(filters).length 
            });
            return results; // Return unfiltered results on error
        }
    }

    /**
     * Configures metrics data retention policies including time-based expiration and data consolidation rules
     * Updates internal retention configuration and applies policies to existing stored metrics data
     * 
     * @param {Object} retentionPolicy - Retention policy configuration with expiration rules and consolidation settings
     * @returns {void} No return value, updates internal retention configuration
     */
    configureRetentionPolicy(retentionPolicy) {
        try {
            // Validate retention policy configuration and time-based rules
            if (!retentionPolicy || typeof retentionPolicy !== 'object') {
                throw new Error('Invalid retention policy configuration');
            }

            const validatedPolicy = {
                retentionHours: retentionPolicy.retentionHours || this.config.storage.retentionHours,
                maxMemoryMb: retentionPolicy.maxMemoryMb || this.config.storage.maxMemoryMb,
                cleanupInterval: retentionPolicy.cleanupInterval || this.config.storage.cleanupInterval,
                consolidationRules: retentionPolicy.consolidationRules || {},
                autoCleanup: retentionPolicy.autoCleanup !== false
            };

            // Validate retention hours
            if (validatedPolicy.retentionHours < 1 || validatedPolicy.retentionHours > (7 * 24)) {
                throw new Error('Retention hours must be between 1 and 168 (7 days)');
            }

            // Update internal retention settings for different metrics types
            this.config.storage = {
                ...this.config.storage,
                ...validatedPolicy
            };

            // Update global storage configuration
            Object.assign(METRICS_STORAGE_CONFIG, {
                retentionHours: validatedPolicy.retentionHours,
                maxMemoryUsageMb: validatedPolicy.maxMemoryMb,
                cleanupIntervalMs: validatedPolicy.cleanupInterval
            });

            // Apply retention policies to existing stored metrics data
            if (validatedPolicy.applyImmediate !== false) {
                const cleanupResults = cleanupExpiredMetrics(true); // Force cleanup
                logger.info('Retention policy applied to existing data', cleanupResults);
            }

            // Log retention policy changes for audit and monitoring purposes
            logger.info('Retention policy updated successfully', {
                previousPolicy: this.config.storage,
                newPolicy: validatedPolicy,
                timestamp: performance.now()
            });

            // Emit retention policy updated event for monitoring integration
            this.emit('retention-policy-updated', {
                policy: validatedPolicy,
                timestamp: performance.now()
            });
        } catch (error) {
            logger.error('Failed to configure retention policy', {
                error: error.message,
                retentionPolicy: retentionPolicy,
                stack: error.stack
            });

            throw new Error(`Retention policy configuration failed: ${error.message}`);
        }
    }
}

// Create default metrics collector instance configured with server settings for immediate use
const metricsCollector = new MetricsCollector({
    performanceInterval: serverConfig.performance?.metricsInterval || 5000,
    healthInterval: serverConfig.health?.checkInterval || 30000,
    maxMemoryMb: METRICS_STORAGE_CONFIG.maxMemoryUsageMb,
    retentionHours: METRICS_STORAGE_CONFIG.retentionHours,
    defaultExportFormat: METRICS_EXPORT_FORMATS.JSON
});

// Export all functions and classes for external use and integration
module.exports = {
    // Main metrics collection orchestrator class
    MetricsCollector,
    
    // Standalone utility functions for metrics operations
    storeMetrics,
    retrieveMetrics,
    aggregateMetrics,
    cleanupExpiredMetrics,
    exportMetricsData,
    calculateMetricsStatistics,
    
    // Constants for metrics classification and configuration
    METRICS_COLLECTION_TYPES,
    METRICS_STORAGE_CONFIG,
    TIME_SERIES_BUCKETS,
    METRICS_EXPORT_FORMATS,
    
    // Pre-configured default instance for immediate use
    metricsCollector
};