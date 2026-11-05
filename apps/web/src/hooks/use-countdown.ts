import * as React from 'react';

/**
 * Counts whole seconds down to zero. It begins at `initialSeconds` (default none);
 * `start(n)` begins again at n. The value falls by one each second and stays at zero.
 * Used to show "retry in N seconds".
 */
export function useCountdown(initialSeconds = 0): {
  secondsLeft: number;
  start: (seconds: number) => void;
} {
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    Math.max(0, Math.ceil(initialSeconds)),
  );

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
