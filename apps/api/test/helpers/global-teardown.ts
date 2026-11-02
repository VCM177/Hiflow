import { openMaintenance } from './maintenance';

/**
 * Wipes the audit rows a test run wrote. Only rows tagged `e2e` go, so
 * activity from a developer using the app at the same time is untouched; a run
 * that was interrupted is cleaned up by the next one.
 */
export default async function globalTeardown(): Promise<void> {
  const owner = await openMaintenance();

  try {
    await owner.transaction(async (manager) => {
      await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
      await manager.query(`DELETE FROM audit_row_changes WHERE origin = 'e2e'`);
      await manager.query(`DELETE FROM audit_events WHERE origin = 'e2e'`);
    });
  } finally {
    await owner.destroy();
  }
}
