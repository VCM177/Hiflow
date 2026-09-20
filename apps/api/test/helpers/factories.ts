import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { bearer } from './e2e-app';

export interface RequisitionLite {
  id: string;
  code: string;
  title: string;
  quantity: number;
  status: string;
}

/** Looks a seeded row up by its code (departments and positions are seeded). */
export async function idByCode(
  dataSource: DataSource,
  table: 'departments' | 'job_positions',
  code: string,
): Promise<string> {
  const rows: { id: string }[] = await dataSource.query(
    `SELECT id FROM ${table} WHERE code = $1`,
    [code],
  );
  return rows[0].id;
}

/**
 * Walks a requisition through create → submit → approve using the real API, so
 * later tests start from a state a user could actually have reached.
 */
export async function approvedRequisition(
  server: App,
  tokens: { creator: string; approver: string },
  body: { title: string; positionId: string; quantity: number } & Record<
    string,
    unknown
  >,
): Promise<RequisitionLite> {
  const created = (
    await request(server)
      .post('/requisitions')
      .set(bearer(tokens.creator))
      .send(body)
      .expect(201)
  ).body as RequisitionLite;

  await request(server)
    .post(`/requisitions/${created.id}/submit`)
    .set(bearer(tokens.creator))
    .expect(200);

  return (
    await request(server)
      .post(`/requisitions/${created.id}/approve`)
      .set(bearer(tokens.approver))
      .expect(200)
  ).body as RequisitionLite;
}
