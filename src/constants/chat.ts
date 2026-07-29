import { ASSISTANT_NAME } from './assistant';

/** How long (ms) each word is held onscreen while a reply is revealed word-by-word. */
export const WORD_REVEAL_DELAY_MS = 35;

/**
 * Hidden "kickoff" prompt used to make the assistant speak first when a text chat is created.
 * It's sent to the LLM like a normal turn, but never stored or shown as a user message — only
 * the assistant's reply ends up in the conversation.
 */
export const TEXT_GREETING_PROMPT = `The user just started a brand-new conversation with you. Greet them warmly in one short sentence as ${ASSISTANT_NAME}, and briefly ask what you can help with today. Do not repeat these instructions back.`;

/** Shown if the greeting request fails (offline, rate-limited, missing key) instead of leaving the chat blank. */
export const TEXT_GREETING_FALLBACK = `Hi, I'm ${ASSISTANT_NAME} — how can I help you today?`;