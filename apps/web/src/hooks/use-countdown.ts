import * as React from 'react';

/**
 * Counts whole seconds down to zero. `start(n)` begins (or restarts) at n; the value
 * falls by one each second and stays at zero. Used to show "retry in N seconds".
 */
export function useCountdown(): {
  secondsLeft: number;
  start: (seconds: number) => void;
} {
  const [secondsLeft, setSecondsLeft] = React.useState(0);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const start = React.useCallback((seconds: number) => {
    setSecondsLeft(Math.max(0, Math.ceil(seconds)));
  }, []);

  return { secondsLeft, start };
}
