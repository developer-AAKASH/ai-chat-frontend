/**
 * Voice I/O for calls.
 *
 * - Speech-to-text: still the browser's native SpeechRecognition (real mic input,
 *   real transcription) — no backend involved for this half.
 * - Text-to-speech: ElevenLabs, via our own backend (POST /api/tts in
 *   backend/index.js), which holds the ElevenLabs API key and proxies the
 *   request — same reasoning as the chat backend: never expose an API key
 *   to the browser.
 *
 * The AI reply text still comes from the real chat backend (see chatApi.ts);
 * only how that reply gets spoken changed from the browser's robotic
 * SpeechSynthesis voices to ElevenLabs' natural-sounding audio.
 */

import { RECOGNITION_LANG } from '../constants/voice';
import { API_URL } from '../constants/common';

export function isVoiceSupported(): boolean {
  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  // Audio playback (for the ElevenLabs response) is supported everywhere modern
  // browsers run — the only real constraint left is whether the browser can listen.
  return Boolean(SpeechRecognitionCtor);
}

export interface RecognitionHandlers {
  onInterimResult: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export class VoiceRecognitionController {
  private recognition: SpeechRecognition | null = null;
  private manuallyStopped = false;
  /** True while intentionally muted (e.g. the assistant is speaking) — distinct from a full stop. */
  private paused = false;

  constructor(private handlers: RecognitionHandlers) {}

  start(): void {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.handlers.onError('Speech recognition is not supported in this browser.');
      return;
    }

    this.manuallyStopped = false;
    this.paused = false;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = RECOGNITION_LANG;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Ignore anything picked up while we're intentionally muted (e.g. the
      // assistant's own voice bleeding into the mic through the speakers).
      if (this.paused) return;

      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      if (final.trim()) this.handlers.onFinalResult(final.trim());
      if (interim.trim()) this.handlers.onInterimResult(interim.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (this.paused) return;
      // "no-speech" and "aborted" are routine (e.g. brief silence) — don't surface as hard errors.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.handlers.onError(`Microphone error: ${event.error}`);
    };

    recognition.onend = () => {
      // If we stopped the mic on purpose (assistant is speaking), stay
      // stopped until resume() is called — don't auto-restart and don't
      // treat this as the call ending.
      if (this.paused) return;

      // Browsers auto-stop recognition after a period of silence. If the user
      // hasn't manually ended the call, restart listening automatically.
      if (!this.manuallyStopped) {
        try {
          recognition.start();
        } catch {
          // Ignore races where recognition is already starting.
        }
      } else {
        this.handlers.onEnd();
      }
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch (err) {
      this.handlers.onError(err instanceof Error ? err.message : 'Failed to start microphone.');
    }
  }

  /** Temporarily mute the mic (e.g. while the assistant is generating/speaking a reply). */
  pause(): void {
    if (this.paused || !this.recognition) return;
    this.paused = true;
    this.recognition.stop();
  }

  /** Resume listening after pause(). */
  resume(): void {
    if (!this.paused) return;
    this.start();
  }

  stop(): void {
    this.manuallyStopped = true;
    this.paused = false;
    this.recognition?.stop();
    this.recognition = null;
  }
}

// ---- Text-to-speech (ElevenLabs, via our backend) ----

interface ActivePlayback {
  audio: HTMLAudioElement;
  objectUrl: string;
}

/** The audio currently playing (if any), so cancelSpeech() can stop it. */
let activePlayback: ActivePlayback | null = null;
/** Aborts an in-flight /api/tts fetch, so interrupting mid-request doesn't still
 *  start playing a reply after the user has already moved on. */
let activeAbortController: AbortController | null = null;

function stopActivePlayback(): void {
  if (!activePlayback) return;
  const { audio, objectUrl } = activePlayback;
  activePlayback = null;
  // Detach handlers first — otherwise calling pause() here can itself fire
  // onerror/onended and re-run the finish logic a second time.
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Fetches ElevenLabs-generated speech audio for `text` from our backend and plays it.
 * Fire-and-forget, same shape as the old SpeechSynthesis version: `onDone` always fires
 * once (finished, cancelled, or failed); `onError` only fires on a genuine failure.
 */
export function speak(text: string, onDone: () => void, onError?: (msg: string) => void): void {
  // Cancel anything already speaking/loading before starting this line — mirrors
  // `window.speechSynthesis.cancel()` in the old implementation.
  cancelSpeech();

  const controller = new AbortController();
  activeAbortController = controller;

  (async () => {
    try {
      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to generate voice response.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      activePlayback = { audio, objectUrl };

      audio.onended = () => {
        if (activePlayback?.audio === audio) activePlayback = null;
        URL.revokeObjectURL(objectUrl);
        onDone();
      };
      audio.onerror = () => {
        if (activePlayback?.audio === audio) activePlayback = null;
        URL.revokeObjectURL(objectUrl);
        onError?.('Failed to play voice response.');
        onDone();
      };

      await audio.play();
    } catch (err) {
      // Cancelled on purpose (interrupt, a new line starting, or the call ending) —
      // both the fetch abort and a play() interrupted by pause() surface as this.
      if (err instanceof DOMException && err.name === 'AbortError') {
        onDone();
        return;
      }
      onError?.(err instanceof Error ? err.message : 'Failed to generate voice response.');
      onDone();
    } finally {
      if (activeAbortController === controller) activeAbortController = null;
    }
  })();
}

export function cancelSpeech(): void {
  activeAbortController?.abort();
  activeAbortController = null;
  stopActivePlayback();
}