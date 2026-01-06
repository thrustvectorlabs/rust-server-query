export type NotificationTone = 'online' | 'offline';

let notificationAudioContext: AudioContext | null = null;

const DING_NOTES: Record<NotificationTone, number[]> = {
  online: [587.33, 783.99],
  offline: [783.99, 587.33],
};

export function playNotificationSound(tone: NotificationTone) {
  if (typeof window === 'undefined') {
    return;
  }
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }
  try {
    if (!notificationAudioContext) {
      notificationAudioContext = new AudioContextConstructor();
    }
    const audioContext = notificationAudioContext;
    if (!audioContext) {
      return;
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {
        // Ignore autoplay blocks.
      });
    }
    const now = audioContext.currentTime;
    const [first, second] = DING_NOTES[tone];
    const scheduleNote = (startTime: number, frequency: number) => {
      const mainOsc = audioContext.createOscillator();
      const secondOsc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      mainOsc.type = 'sine';
      secondOsc.type = 'sine';
      mainOsc.frequency.value = frequency;
      secondOsc.frequency.value = frequency * 1.5;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);
      mainOsc.connect(gain);
      secondOsc.connect(gain);
      gain.connect(audioContext.destination);
      mainOsc.start(startTime);
      secondOsc.start(startTime);
      mainOsc.stop(startTime + 0.25);
      secondOsc.stop(startTime + 0.25);
    };
    scheduleNote(now, first);
    scheduleNote(now + 0.12, second);
  } catch {
    // Ignore audio playback errors.
  }
}
