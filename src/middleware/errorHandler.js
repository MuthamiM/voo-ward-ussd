/**
 * Enhanced Error Handling Middleware
 * Production-grade error management for VOO Ward Admin Dashboard
 * Part of comprehensive performance optimization strategy
 */

const logger = require('../lib/logger');
const redisCache = require('../services/redisCache');

class ErrorHandler {
  constructor() {
    this.errorPatterns = new Map();
    this.alertThresholds = {
      rate_limit: 10,      // errors per minute
      database: 5,         // database errors per minute
      authentication: 3,   // auth errors per minute
      validation: 15,      // validation errors per minute
      server: 2            // server errors per minute
    };
  }

  /**
   * Main error handling middleware
   */
  handle() {
    return (err, req, res, next) => {
      // Log error details
      this.logError(err, req);
      
      // Track error patterns
      this.trackErrorPattern(err, req);
      
      // Check if we need to send alerts
      this.checkAlertThresholds(err.type || 'server');
      
      // Generate appropriate response
      const errorResponse = this.generateErrorResponse(err, req);
      
      // Set appropriate status code
      const statusCode = this.getStatusCode(err);
      
      res.status(statusCode).json(errorResponse);
    };
  }

  /**
   * Log error with context
   */
  logError(err, req) {
    const errorContext = {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown'
    };

    // Log based on severity
    if (err.statusCode >= 500) {
      logger.error(errorContext, 'Server Error');
    } else if (err.statusCode >= 400) {
      logger.warn(errorContext, 'Client Error');
    } else {
      logger.info(errorContext, 'Application Error');
    }
  }

  /**
   * Track error patterns for monitoring
   */
  async trackErrorPattern(err, req) {
    const errorType = err.type || this.categorizeError(err);
    const key = `${errorType}_${Date.now()}`;
    
    try {
      // Increment error counter
      await redisCache.incr('error_tracking', errorType, 1, 3600);
      
      // Store error details for analysis
      const errorData = {
        type: errorType,
        message: err.message,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
      };
      
      await redisCache.set('error_details', key, errorData, 3600);
      
    } catch (cacheError) {
      logger.warn({ error: cacheError.message }, 'Failed to track error pattern');
    }
  }

  /**
   * Categorize errors for better tracking
   */
  categorizeError(err) {
    const message = err.message?.toLowerCase() || '';
    const stack = err.stack?.toLowerCase() || '';
    
    // Database errors
    if (message.includes('database') || message.includes('mongodb') || 
        message.includes('connection') || message.includes('timeout')) {
      return 'database';
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('forbidden') ||
        message.includes('token') || message.includes('authentication')) {
      return 'authentication';
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('required') ||
        message.includes('invalid') || err.statusCode === 422) {
      return 'validation';
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'rate_limit';
    }
    
    // File system errors
    if (message.includes('file') || message.includes('directory') ||
        message.includes('permission denied')) {
      return 'filesystem';
    }
    
    // Network errors
    if (message.includes('network') || message.includes('dns') ||
        message.includes('connection refused')) {
      return 'network';
    }
    
    return 'server';
  }

  /**
   * Check if error rate exceeds thresholds
   */
  async checkAlertThresholds(errorType) {
    try {
      const count = await redisCache.get('error_tracking', errorType) || 0;
      const threshold = this.alertThresholds[errorType] || this.alertThresholds.server;
      
      if (count > threshold) {
        logger.error({
          errorType,
          count,
          threshold,
          timeWindow: '1 minute'
        }, '🚨 Error rate threshold exceeded');
        
        // Here you would integrate with your alerting system
        // this.sendAlert(errorType, count, threshold);
      }
    } catch (cacheError) {
      logger.warn({ error: cacheError.message }, 'Failed to check alert thresholds');
    }
  }

  /**
   * Generate appropriate error response
   */
  generateErrorResponse(err, req) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Base response
    const response = {
      success: false,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    };

    // Add appropriate error information
    if (isDevelopment) {
      // Full error details in development
      response.error = {
        message: err.message,
        stack: err.stack,
        details: err.details || null,
        type: err.type || 'UnknownError'
      };
    } else {
      // Sanitized error for production
      response.error = {
        message: this.getSafeErrorMessage(err),
        code: err.code || 'INTERNAL_ERROR',
        type: err.type || 'ServerError'
      };
    }

    // Add request ID for tracking
    if (req.id) {
      response.requestId = req.id;
    }

    // Add retry information if applicable
    if (this.isRetryableError(err)) {
      response.retryable = true;
      response.retryAfter = this.getRetryAfter(err);
    }

    return response;
  }

  /**
   * Get safe error message for production
   */
  getSafeErrorMessage(err) {
    const statusCode = this.getStatusCode(err);
    
    // Safe messages for common status codes
    const safeMessages = {
      400: 'Bad Request - Please check your input',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Access denied',
      404: 'Resource not found',
      422: 'Validation failed - Please check your input',
      429: 'Too many requests - Please try again later',
      500: 'Internal server error - Please try again later',
      502: 'Service temporarily unavailable',
      503: 'Service unavailable - Please try again later',
      504: 'Request timeout - Please try again later'
    };

    return safeMessages[statusCode] || 'An unexpected error occurred';
  }

  /**
   * Determine HTTP status code from error
   */
  getStatusCode(err) {
    // Check if status code is already set
    if (err.statusCode) return err.statusCode;
    if (err.status) return err.status;
    
    // Determine from error type/message
    const message = err.message?.toLowerCase() || '';
    
    if (message.includes('unauthorized') || message.includes('token')) return 401;
    if (message.includes('forbidden') || message.includes('permission')) return 403;
    if (message.includes('not found')) return 404;
    if (message.includes('validation') || message.includes('required')) return 422;
    if (message.includes('rate limit') || message.includes('too many')) return 429;
    if (message.includes('timeout')) return 504;
    if (message.includes('unavailable')) return 503;
    
    // Default to 500 for server errors
    return 500;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(err) {
    const statusCode = this.getStatusCode(err);
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(statusCode);
  }

  /**
   * Get retry after time in seconds
   */
  getRetryAfter(err) {
    const statusCode = this.getStatusCode(err);
    
    switch (statusCode) {
      case 429: return 60;   // Rate limit - retry after 1 minute
      case 500: return 30;   // Server error - retry after 30 seconds
      case 502: return 10;   // Bad gateway - retry after 10 seconds
      case 503: return 120;  // Service unavailable - retry after 2 minutes
      case 504: return 60;   // Timeout - retry after 1 minute
      default: return 30;
    }
  }

  /**
   * Validation error handler
   */
  validationError(errors, field = null) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    error.type = 'validation';
    error.details = {
      field,
      errors: Array.isArray(errors) ? errors : [errors]
    };
    return error;
  }

  /**
   * Database error handler
   */
  databaseError(originalError, operation = 'database operation') {
    const error = new Error(`Database error during ${operation}`);
    error.statusCode = 500;
    error.type = 'database';
    error.details = {
      operation,
      originalMessage: originalError.message
    };
    return error;
  }

  /**
   * Authentication error handler
   */
  authenticationError(message = 'Authentication required') {
    const error = new Error(message);
    error.statusCode = 401;
    error.type = 'authentication';
    return error;
  }

  /**
   * Authorization error handler
   */
  authorizationError(message = 'Access denied') {
    const error = new Error(message);
    error.statusCode = 403;
    error.type = 'authorization';
    return error;
  }

  /**
   * Rate limit error handler
   */
  rateLimitError(retryAfter = 60) {
    const error = new Error('Too many requests');
    error.statusCode = 429;
    error.type = 'rate_limit';
    error.retryAfter = retryAfter;
    return error;
  }

  /**
   * Not found error handler
   */
  notFoundError(resource = 'Resource') {
    const error = new Error(`${resource} not found`);
    error.statusCode = 404;
    error.type = 'not_found';
    return error;
  }

  /**
   * Async handler wrapper
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Get error statistics
   */
  async getErrorStats() {
    try {
      const errorTypes = Object.keys(this.alertThresholds);
      const stats = {};

      for (const type of errorTypes) {
        const count = await redisCache.get('error_tracking', type) || 0;
        stats[type] = {
          count,
          threshold: this.alertThresholds[type],
          status: count > this.alertThresholds[type] ? 'critical' : 'normal'
        };
      }

      return {
        current_period: '1 hour',
        error_types: stats,
        total_errors: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0)
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get error statistics');
      return { error: 'Failed to retrieve error statistics' };
    }
  }
}

// Singleton instance
const errorHandler = new ErrorHandler();

module.exports = errorHandler;