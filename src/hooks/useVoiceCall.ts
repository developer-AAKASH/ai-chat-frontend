import { useCallback, useRef, useState } from 'react';
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
 */
export function useVoiceCall(): UseVoiceCallResult {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllerRef = useRef<VoiceRecognitionController | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const activeRef = useRef(false);

  const supported = isVoiceSupported();

  const handleAssistantTurn = useCallback(async (userText: string) => {
    const userEntry: TranscriptEntry = {
      id: uuid(),
      role: 'user',
      text: userText,
      isFinal: true,
      createdAt: Date.now(),
    };
    setTranscript((prev) => [...prev, userEntry]);
    historyRef.current = [
      ...historyRef.current,
      { id: userEntry.id, role: 'user', content: userText, createdAt: userEntry.createdAt },
    ];

    setStatus('speaking');
    try {
      const replyText = await sendMessage({
        sessionId: 'voice-call',
        history: historyRef.current,
        text: userText,
      });

      if (!activeRef.current) return;

      const assistantEntry: TranscriptEntry = {
        id: uuid(),
        role: 'assistant',
        text: replyText,
        isFinal: true,
        createdAt: Date.now(),
      };
      setTranscript((prev) => [...prev, assistantEntry]);
      historyRef.current = [
        ...historyRef.current,
        { id: assistantEntry.id, role: 'assistant', content: replyText, createdAt: assistantEntry.createdAt },
      ];

      speak(
        replyText,
        () => {
          if (activeRef.current) setStatus('listening');
        },
        (msg) => setErrorMessage(msg),
      );
    } catch (err) {
      if (!activeRef.current) return;
      const message =
        err instanceof ChatApiError ? err.message : 'The assistant had trouble responding. Please try again.';
      setErrorMessage(message);
      setStatus('listening');
    }
  }, []);

  const startCall = useCallback(() => {
    if (!supported) {
      setErrorMessage('Voice calls need microphone and speech support, which this browser does not provide.');
      setStatus('error');
      return;
    }

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
