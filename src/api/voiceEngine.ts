/**
 * Thin wrapper around the browser's native Web Speech API.
 *
 * - Speech-to-text: SpeechRecognition (real mic input, real transcription)
 * - Text-to-speech: SpeechSynthesis (real audio output)
 *
 * The AI reply text comes from the real chat backend (see chatApi.ts / the
 * Gemini-backed server), same as text chat. Only the audio I/O — listening
 * via the mic and speaking the reply aloud — is handled by the browser's own
 * Web Speech API, since there's no separate voice-native LLM endpoint here.
 */

export function isVoiceSupported(): boolean {
  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Boolean(SpeechRecognitionCtor) && 'speechSynthesis' in window;
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
    recognition.lang = 'en-US';

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

export function speak(text: string, onDone: () => void, onError?: (msg: string) => void): void {
  if (!('speechSynthesis' in window)) {
    onError?.('Speech synthesis is not supported in this browser.');
    onDone();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => onDone();
  utterance.onerror = () => {
    onError?.('Failed to play voice response.');
    onDone();
  };
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}