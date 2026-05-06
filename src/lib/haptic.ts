export function triggerHaptic(type: 'success' | 'warn' | 'light') {
  if (typeof window === 'undefined' || !window.navigator?.vibrate) return;
  
  switch (type) {
    case 'success':
      window.navigator.vibrate([10, 30, 20]); // Double tap feel
      break;
    case 'warn':
      window.navigator.vibrate([50, 50, 50]); // Heavy pulse
      break;
    case 'light':
      window.navigator.vibrate([10]); // Single light tap
      break;
  }
}
