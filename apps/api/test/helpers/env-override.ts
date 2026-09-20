/**
 * Sets environment values and returns a function that puts the old ones back.
 *
 * ConfigModule snapshots process.env when AppModule is first imported, so a spec
 * that needs its own values must call this from a small module that it imports
 * BEFORE helpers/e2e-app (imports run in order; jest here is CommonJS, so there
 * is no dynamic import to defer the app).
 */
export function overrideEnv(values: Record<string, string>): () => void {
  const before = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  Object.assign(process.env, values);

  return () => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}
