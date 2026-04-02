const logger = require('../../core/logger');

const IGNORABLE_INTERACTION_ERROR_CODES = new Set([10062, 40060]);

function getErrorCode(error) {
  if (!error) return null;
  if (typeof error.code !== 'undefined') return error.code;
  if (typeof error.rawError?.code !== 'undefined') return error.rawError.code;
  return null;
}

function isIgnorableInteractionError(error) {
  const code = getErrorCode(error);
  return IGNORABLE_INTERACTION_ERROR_CODES.has(code);
}

function buildContext(context) {
  return context ? ` (${context})` : '';
}

async function safeDeferReply(interaction, payload, context = '') {
  try {
    return await interaction.deferReply(payload);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      logger.warn(`Ignoring interaction defer error${buildContext(context)}`, {
        code: getErrorCode(error),
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}

async function safeReply(interaction, payload, context = '') {
  try {
    return await interaction.reply(payload);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      logger.warn(`Ignoring interaction reply error${buildContext(context)}`, {
        code: getErrorCode(error),
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}

async function safeEditReply(interaction, payload, context = '') {
  try {
    return await interaction.editReply(payload);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      logger.warn(`Ignoring interaction editReply error${buildContext(context)}`, {
        code: getErrorCode(error),
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}

async function safeFollowUp(interaction, payload, context = '') {
  try {
    return await interaction.followUp(payload);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      logger.warn(`Ignoring interaction followUp error${buildContext(context)}`, {
        code: getErrorCode(error),
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}

module.exports = {
  safeDeferReply,
  safeReply,
  safeEditReply,
  safeFollowUp,
  isIgnorableInteractionError,
  getErrorCode,
};
