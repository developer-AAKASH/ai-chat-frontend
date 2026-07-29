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

// Slightly faster than 1x and a hair higher pitch reads as noticeably more energetic/human
// than the flat robotic default — small values, big difference.
export const SPEECH_RATE = 1.05;
export const SPEECH_PITCH = 1.02;

/**
 * Browsers ship a mix of low-quality robotic voices and much better neural/"natural"
 * ones, but expose no quality metadata — only names. We rank by name patterns known
 * to be higher quality (Chrome's "Google" voices, Edge's "Natural" voices, macOS's
 * better system voices) and fall back to whatever's available.
 */
export const PREFERRED_VOICE_PATTERNS = [
    /Google US English/i,
    /Microsoft.*Online.*Natural/i,
    /Natural/i,
    /Samantha/i,
    /Aria/i,
    /Jenny/i,
];