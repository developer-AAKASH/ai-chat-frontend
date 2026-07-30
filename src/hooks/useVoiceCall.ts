import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { cancelSpeech, isVoiceSupported, speak, VoiceRecognitionController } from '../api/voiceEngine';
import { ChatApiError, sendMessage } from '../api/chatApi';
import type { CallStatus, ChatMessage, TranscriptEntry } from '../types';
import {
  CALL_CONNECT_DELAY_MS,
  FALLBACK_VOICE_SESSION_ID,
  VOICE_GREETING_FALLBACK,
  VOICE_GREETING_PROMPT,
} from '../constants/voice';

interface UseVoiceCallResult {
  status: CallStatus;
  transcript: TranscriptEntry[];
  errorMessage: string | null;
  isSupported: boolean;
  startCall: () => void;
  endCall: () => void;
  /** Cuts off the assistant mid-reply and starts listening again immediately — real conversations allow this. */
  interrupt: () => void;
}

/**
 * Drives the voice call state machine:
 * idle -> connecting -> connected -> listening <-> speaking -> disconnected
 *
 * The mic/STT and TTS are real (Web Speech API); the assistant's reply text
 * is produced by the same mock chat backend used for text chat, so voice and
 * text share one "brain" even though only voice has audio I/O.
 *
 * Each turn is also emitted via `onMessage` (tagged `channel: 'voice'`) so the
 * call becomes part of the same persisted conversation shown in the Chat tab
 * — voice and text end up as one continuous history, not two disconnected
 * experiences.
 */
export function useVoiceCall(
    sessionId: string | null,
    onMessage?: (sessionId: string, message: ChatMessage) => void,
): UseVoiceCallResult {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllerRef = useRef<VoiceRecognitionController | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const activeRef = useRef(false);
  // Holds the "connecting…" timeout id so it can be cancelled if the call is torn
  // down (end call, or the component unmounts) before it has a chance to fire.
  const connectTimeoutRef = useRef<number | null>(null);
  // Aborts any in-flight sendMessage (greeting or a turn) when the call ends, so a
  // stray network response can't trigger a reply after the call is already over.
  const abortControllerRef = useRef<AbortController | null>(null);
  // The session this call is writing to, pinned for the whole call so switching
  // chats mid-call (in another tab/panel) doesn't split one call across two sessions.
  const callSessionIdRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);
  const sessionIdRef = useRef(sessionId);
  // Bumped on every new turn and on interrupt, so a reply that arrives after the
  // user has already interrupted/moved on gets silently discarded instead of
  // suddenly speaking over them.
  const turnIdRef = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const supported = isVoiceSupported();

  const handleAssistantTurn = useCallback(async (userText: string) => {
    const myTurn = ++turnIdRef.current;
    const userTurnId = uuid();
    const userCreatedAt = Date.now();
    const userEntry: TranscriptEntry = {
      id: userTurnId,
      role: 'user',
      text: userText,
      isFinal: true,
      createdAt: userCreatedAt,
    };
    setTranscript((prev) => [...prev, userEntry]);

    const userChatMessage: ChatMessage = {
      id: userTurnId,
      role: 'user',
      content: userText,
      createdAt: userCreatedAt,
      status: 'sent',
      channel: 'voice',
    };
    historyRef.current = [...historyRef.current, userChatMessage];
    if (callSessionIdRef.current) {
      onMessageRef.current?.(callSessionIdRef.current, userChatMessage);
    }

    // Mute the mic now, before we even call the LLM — otherwise the assistant's
    // own voice (played back through speakers) gets picked up as new input,
    // which is what was causing the hang/feedback loop.
    controllerRef.current?.pause();
    // "Thinking" (waiting on the network) is visually distinct from "Speaking" (audio
    // actually playing) — without this, there's a stretch of silence right after the
    // badge already says "Speaking…", which reads as broken rather than natural.
    setStatus('thinking');

    // Placeholder transcript entry, filled in word-by-word as the reply streams in —
    // same streaming behavior as text chat, just rendered in the transcript panel.
    const assistantTurnId = uuid();
    const assistantCreatedAt = Date.now();
    setTranscript((prev) => [
      ...prev,
      { id: assistantTurnId, role: 'assistant', text: '', isFinal: true, createdAt: assistantCreatedAt },
    ]);

    try {
      const replyText = await sendMessage({
        sessionId: callSessionIdRef.current ?? FALLBACK_VOICE_SESSION_ID,
        history: historyRef.current,
        text: userText,
        mode: 'voice',
        signal: abortControllerRef.current?.signal,
        onDelta: (_delta, fullTextSoFar) => {
          // Ignore stray updates from a turn the user has already interrupted/moved past.
          if (myTurn !== turnIdRef.current) return;
          setTranscript((prev) => prev.map((e) => (e.id === assistantTurnId ? { ...e, text: fullTextSoFar } : e)));
        },
      });

      if (!activeRef.current || myTurn !== turnIdRef.current) return;

      // Make sure the transcript reflects the final text exactly, even if the last
      // delta and the resolved value differ for any reason.
      setTranscript((prev) => prev.map((e) => (e.id === assistantTurnId ? { ...e, text: replyText } : e)));

      const assistantChatMessage: ChatMessage = {
        id: assistantTurnId,
        role: 'assistant',
        content: replyText,
        createdAt: assistantCreatedAt,
        status: 'sent',
        channel: 'voice',
      };
      historyRef.current = [...historyRef.current, assistantChatMessage];
      if (callSessionIdRef.current) {
        onMessageRef.current?.(callSessionIdRef.current, assistantChatMessage);
      }

      setStatus('speaking');
      speak(
          replyText,
          () => {
            if (activeRef.current && myTurn === turnIdRef.current) {
              controllerRef.current?.resume();
              setStatus('listening');
            }
          },
          (msg) => setErrorMessage(msg),
      );
    } catch (err) {
      if (!activeRef.current || myTurn !== turnIdRef.current) return;
      // Drop the empty/partial placeholder — there's no complete reply to show.
      setTranscript((prev) => prev.filter((e) => e.id !== assistantTurnId));
      const message =
          err instanceof ChatApiError ? err.message : 'The assistant had trouble responding. Please try again.';
      setErrorMessage(message);
      controllerRef.current?.resume();
      setStatus('listening');
    }
  }, []);

  /**
   * Makes FRIDAY speak first the moment a call connects, instead of sitting silently
   * waiting for the user to say something — a live call that just goes quiet after
   * "Connected" feels broken, not natural. The mic stays muted until this finishes.
   */
  const playGreeting = useCallback(() => {
    const myTurn = ++turnIdRef.current;
    const assistantTurnId = uuid();
    const assistantCreatedAt = Date.now();
    setTranscript((prev) => [
      ...prev,
      { id: assistantTurnId, role: 'assistant', text: '', isFinal: true, createdAt: assistantCreatedAt },
    ]);

    const finishTurn = (finalText: string) => {
      if (!activeRef.current || myTurn !== turnIdRef.current) return;
      setTranscript((prev) => prev.map((e) => (e.id === assistantTurnId ? { ...e, text: finalText } : e)));

      const assistantChatMessage: ChatMessage = {
        id: assistantTurnId,
        role: 'assistant',
        content: finalText,
        createdAt: assistantCreatedAt,
        status: 'sent',
        channel: 'voice',
      };
      historyRef.current = [...historyRef.current, assistantChatMessage];
      if (callSessionIdRef.current) {
        onMessageRef.current?.(callSessionIdRef.current, assistantChatMessage);
      }

      setStatus('speaking');
      speak(
          finalText,
          () => {
            if (activeRef.current && myTurn === turnIdRef.current) {
              controllerRef.current?.resume();
              setStatus('listening');
            }
          },
          (msg) => setErrorMessage(msg),
      );
    };

    const kickoffMessage: ChatMessage = { id: 'kickoff', role: 'user', content: VOICE_GREETING_PROMPT, createdAt: Date.now() };

    sendMessage({
      sessionId: callSessionIdRef.current ?? FALLBACK_VOICE_SESSION_ID,
      history: [kickoffMessage],
      text: VOICE_GREETING_PROMPT,
      mode: 'voice',
      signal: abortControllerRef.current?.signal,
      onDelta: (_delta, fullTextSoFar) => {
        if (myTurn !== turnIdRef.current) return;
        setTranscript((prev) => prev.map((e) => (e.id === assistantTurnId ? { ...e, text: fullTextSoFar } : e)));
      },
    })
        .then(finishTurn)
        .catch(() => {
          // Never let a failed greeting block the call — fall back to a short local line.
          finishTurn(VOICE_GREETING_FALLBACK);
        });
  }, []);

  const startCall = useCallback(() => {
    if (!supported) {
      setErrorMessage('Voice calls need microphone and speech support, which this browser does not provide.');
      setStatus('error');
      return;
    }

    // Pin the session for the whole call up front.
    callSessionIdRef.current = sessionIdRef.current;

    setErrorMessage(null);
    setTranscript([]);
    historyRef.current = [];
    turnIdRef.current = 0;
    activeRef.current = true;
    abortControllerRef.current = new AbortController();
    setStatus('connecting');

    // Simulate a brief connection handshake before the mic goes live.
    connectTimeoutRef.current = window.setTimeout(() => {
      connectTimeoutRef.current = null;
      if (!activeRef.current) return;
      setStatus('connected');

      const controller = new VoiceRecognitionController({
        onInterimResult: (text) => {
          setTranscript((prev) => {
            const withoutInterim = prev.filter((entry) => entry.isFinal);
            return [
              ...withoutInterim,
              { id: 'interim', role: 'user', text, isFinal: false, createdAt: Date.now() },
            ];
          });
        },
        onFinalResult: (text) => {
          setTranscript((prev) => prev.filter((entry) => entry.isFinal));
          void handleAssistantTurn(text);
        },
        onError: (message) => {
          if (activeRef.current) setErrorMessage(message);
        },
        onEnd: () => {
          if (activeRef.current) {
            activeRef.current = false;
            setStatus('disconnected');
          }
        },
      });

      controllerRef.current = controller;
      controller.start();
      // Get mic permission and get recognition running now, but keep it muted until
      // FRIDAY's greeting finishes speaking — otherwise the greeting audio gets
      // picked back up as input, the same feedback issue as any other reply.
      controller.pause();
      setStatus('thinking');
      playGreeting();
    }, CALL_CONNECT_DELAY_MS);
  }, [supported, handleAssistantTurn, playGreeting]);

  /**
   * Fully tears down whatever the call is doing right now: cancels the pending
   * "connecting…" timeout (if it hasn't fired yet), aborts any in-flight request
   * (greeting or a turn), stops the mic, and stops any audio that's playing.
   * Shared by the explicit "End call" button and by the unmount cleanup below,
   * so navigating away mid-call tears down exactly the same way hanging up does.
   */
  const stopCall = useCallback(() => {
    activeRef.current = false;
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    controllerRef.current?.stop();
    controllerRef.current = null;
    cancelSpeech();
  }, []);

  const endCall = useCallback(() => {
    stopCall();
    setStatus('disconnected');
  }, [stopCall]);

  // Ends the call whenever this component unmounts — e.g. the user switches from
  // the Voice tab back to Chat mid-call. Without this, the mic keeps listening and
  // the greeting/reply request keeps running in the background, so coming back to
  // the Voice tab later can show a call that's still connecting or land you in the
  // middle of an orphaned turn instead of a fresh, idle call.
  useEffect(() => {
    return () => {
      stopCall();
    };
  }, [stopCall]);

  /** Lets the user cut in while the assistant is thinking or talking — normal conversations allow this. */
  const interrupt = useCallback(() => {
    if (status !== 'thinking' && status !== 'speaking') return;
    // Invalidate any in-flight reply so it doesn't suddenly start speaking after the user has moved on.
    turnIdRef.current += 1;
    cancelSpeech();
    controllerRef.current?.resume();
    setStatus('listening');
  }, [status]);

  return {
    status,
    transcript,
    errorMessage,
    isSupported: supported,
    startCall,
    endCall,
    interrupt,
  };
}