// Runs before every e2e file. Every suite logs in from the same address, so
// rate limits are effectively off, and counting is always in memory so a test
// run never spends the Redis request budget. The throttle suite sets its own
// values before it boots an app.
process.env.THROTTLE_LIMIT_SCALE ??= '1000';
process.env.THROTTLE_STORAGE ??= 'memory';
