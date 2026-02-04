import { useRef, useCallback } from 'react';

/**
 * Hook para gerenciar notificações sonoras de novos pedidos
 * Usa a Web Audio API para gerar som sem dependência de arquivos externos
 */
export function useNotificationSound() {
  const audioContextRef = useRef(null);
  const lastPlayedRef = useRef(0);
  
  // Cria o contexto de áudio na primeira vez
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Toca um som de notificação usando Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      // Evita tocar sons muito frequentes (mínimo 2s entre toques)
      const now = Date.now();
      if (now - lastPlayedRef.current < 2000) {
        return;
      }
      lastPlayedRef.current = now;

      const audioContext = getAudioContext();
      
      // Resume o contexto se estiver suspenso (política de autoplay)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Cria oscilador para gerar o som
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configuração do som - tom agradável de notificação
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      oscillator.type = 'sine';
      
      // Envelope de volume
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
    } catch (error) {
      console.warn('Não foi possível tocar som de notificação:', error);
    }
  }, [getAudioContext]);

  // Toca som de notificação com vibração (se disponível)
  const playNewOrderSound = useCallback(() => {
    playNotificationSound();
    
    // Vibração em dispositivos móveis
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [playNotificationSound]);

  return {
    playNotificationSound,
    playNewOrderSound
  };
}

export default useNotificationSound;
