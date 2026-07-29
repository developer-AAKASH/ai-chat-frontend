import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { cancelSpeech, isVoiceSupported, speak, VoiceRecognitionController } from '../api/voiceEngine';
import { ChatApiError, sendMessage } from '../api/chatApi';
import type { CallStatus, ChatMessage, TranscriptEntry } from '../types';

interface UseVoiceCallResult {
  status: CallStatus;
  transcript: TranscriptEntry[];
  errorMessage: string | null;
  isSupported: boolean;
  startCall: () => void;
  endCall: () => void;
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
  // The session this call is writing to, pinned for the whole call so switching
  // chats mid-call (in another tab/panel) doesn't split one call across two sessions.
  const callSessionIdRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const supported = isVoiceSupported();

  const handleAssistantTurn = useCallback(async (userText: string) => {
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
    setStatus('speaking');
    try {
      const replyText = await sendMessage({
        sessionId: callSessionIdRef.current ?? 'voice-call',
        history: historyRef.current,
        text: userText,
      });

      if (!activeRef.current) return;

      const assistantTurnId = uuid();
      const assistantCreatedAt = Date.now();
      const assistantEntry: TranscriptEntry = {
        id: assistantTurnId,
        role: 'assistant',
        text: replyText,
        isFinal: true,
        createdAt: assistantCreatedAt,
      };
      setTranscript((prev) => [...prev, assistantEntry]);

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

      speak(
          replyText,
          () => {
            if (activeRef.current) {
              controllerRef.current?.resume();
              setStatus('listening');
            }
          },
          (msg) => setErrorMessage(msg),
      );
    } catch (err) {
      if (!activeRef.current) return;
      const message =
          err instanceof ChatApiError ? err.message : 'The assistant had trouble responding. Please try again.';
      setErrorMessage(message);
      controllerRef.current?.resume();
      setStatus('listening');
    }
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
    activeRef.current = true;
    setStatus('connecting');

    // Simulate a brief connection handshake before the mic goes live.
    window.setTimeout(() => {
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
      setStatus('listening');
    }, 700);
  }, [supported, handleAssistantTurn]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    controllerRef.current?.stop();
    controllerRef.current = null;
    cancelSpeech();
    setStatus('disconnected');
  }, []);

  return {
    status,
    transcript,
    errorMessage,
    isSupported: supported,
    startCall,
    endCall,
  };
}