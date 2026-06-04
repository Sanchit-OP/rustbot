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
    // ProtocolError = protobufjs failed to decode a Rust+ message because a
    // server omitted a field marked `required` in the proto schema.
    // This is non-fatal — log it and keep running. The proto patch should
    // prevent this, but this is the safety net if a new field is ever added.
    if (error.name === 'ProtocolError' || (error.message && error.message.includes('missing required'))) {
      logger.warn('Non-fatal Rust+ proto decode error — a server message was missing a required field', {
        message: error.message,
      });
      return;
    }

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
