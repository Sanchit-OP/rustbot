const env = require('../config/env');

/**
 * Log levels
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Simple logger with color-coded output
 */
class Logger {
  constructor() {
    this.level = LogLevel[env.LOG_LEVEL.toUpperCase()] || LogLevel.INFO;
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  format(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    if (this.level >= LogLevel.ERROR) {
      console.error('\x1b[31m%s\x1b[0m', this.format('ERROR', message, meta));
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (this.level >= LogLevel.WARN) {
      console.warn('\x1b[33m%s\x1b[0m', this.format('WARN', message, meta));
    }
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (this.level >= LogLevel.INFO) {
      console.log('\x1b[36m%s\x1b[0m', this.format('INFO', message, meta));
    }
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (this.level >= LogLevel.DEBUG) {
      console.log('\x1b[90m%s\x1b[0m', this.format('DEBUG', message, meta));
    }
  }

  /**
   * Log success message
   */
  success(message, meta = {}) {
    if (this.level >= LogLevel.INFO) {
      console.log('\x1b[32m%s\x1b[0m', this.format('SUCCESS', message, meta));
    }
  }
}

// Export singleton instance
module.exports = new Logger();
