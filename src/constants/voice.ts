import { ASSISTANT_NAME } from './assistant';

/** BCP-47 language tag used for speech recognition. */
export const RECOGNITION_LANG = 'en-US';

/** Simulated connection handshake delay (ms) before the mic goes live. */
export const CALL_CONNECT_DELAY_MS = 700;

/** Placeholder session id used for a voice call that isn't tied to a saved chat session yet. */
export const FALLBACK_VOICE_SESSION_ID = 'voice-call';

/**
 * Hidden "kickoff" prompt used to make the assistant speak first the moment a call connects.
 * Sent to the LLM like a normal turn, but never stored or shown as a transcript entry — only
 * the assistant's reply is.
 */
export const VOICE_GREETING_PROMPT = `The user just started this call with you. Greet them warmly in one short sentence as ${ASSISTANT_NAME} and ask how you can help. This is spoken aloud, so keep it very brief.`;

/** Shown/spoken if the greeting request fails, so a call never opens in dead silence. */
export const VOICE_GREETING_FALLBACK = `Hi, I'm ${ASSISTANT_NAME}. How can I help?`;