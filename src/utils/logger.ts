/**
 * rapideTicketLog — centralised logger
 * Mirrors Flutter rapide_ticket_logger.dart
 *
 * Levels: 0=verbose, 500=info, 800=warning, 1000=error
 * Only logs when debug mode is on OR level >= warning.
 */

let _debugEnabled = false;
let _externalLogger: ((level: number, message: string, error?: unknown) => void) | null = null;

export function configureRapideTicketLogger(opts: {
  debug?: boolean;
  logger?: (level: number, message: string, error?: unknown) => void;
}): void {
  _debugEnabled = opts.debug ?? false;
  _externalLogger = opts.logger ?? null;
}

export function rapideTicketLog(
  message: string,
  opts: { error?: unknown; level?: number } = {},
): void {
  const level = opts.level ?? 500;
  const prefix = '[RapideTicket]';

  if (_externalLogger) {
    _externalLogger(level, message, opts.error);
    return;
  }

  if (!_debugEnabled && level < 800) return;

  if (level >= 1000) {
    console.error(`${prefix} ${message}`, opts.error ?? '');
  } else if (level >= 800) {
    console.warn(`${prefix} ${message}`, opts.error ?? '');
  } else if (_debugEnabled) {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * deriveFeedbackTitle — auto-title from description text
 * Mirrors Flutter derive_feedback_title.dart
 * Takes the first sentence / first 80 chars of user input.
 */
export function deriveFeedbackTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'User feedback';

  // First sentence (split on . ! ?)
  const sentenceMatch = trimmed.match(/^([^.!?\n]{3,80})[.!?\n]/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim().substring(0, 80);
  }

  // Fallback: first 80 chars
  return trimmed.length <= 80 ? trimmed : `${trimmed.substring(0, 77)}…`;
}
