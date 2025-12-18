const logger = require('./logger');

/**
 * Global error handler for the application
 */
class ErrorHandler {
  /**
   * Handle application errors
   */
  handle(error, context = '') {
    const errorMessage = context ? `${context}: ${error.message}` : error.message;
    
    logger.error(errorMessage, {
      stack: error.stack,
      name: error.name,
    });
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(reason, promise) {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
  }

  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException(error) {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    
    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }

  /**
   * Register global error handlers
   */
  register() {
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    
    logger.info('Global error handlers registered');
  }
}

// Export singleton instance
module.exports = new ErrorHandler();
