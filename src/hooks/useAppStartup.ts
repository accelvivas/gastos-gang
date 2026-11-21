import { useCallback, useRef, useState } from 'react';

export type StartupPhase =
  | 'initializing'
  | 'ready'
  | 'animating'
  | 'completed'
  | 'error';

let launchStarted = false;

export function useAppStartup() {
  const [phase, setPhase] = useState<StartupPhase>(() => launchStarted ? 'completed' : 'initializing');
  const phaseRef = useRef(phase);
  const transition = useCallback((from: StartupPhase, nextPhase: StartupPhase) => {
    if (phaseRef.current !== from) return;
    phaseRef.current = nextPhase;
    if (nextPhase === 'animating') launchStarted = true;
    setPhase(nextPhase);
  }, []);

  return {
    phase,
    markReady: useCallback(() => transition('initializing', 'ready'), [transition]),
    markAnimating: useCallback(() => transition('ready', 'animating'), [transition]),
    markCompleted: useCallback(() => transition('animating', 'completed'), [transition]),
    markError: useCallback(() => {
      phaseRef.current = 'error';
      setPhase('error');
    }, []),
  };
}
