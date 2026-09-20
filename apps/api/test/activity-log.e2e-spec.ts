import { Controller, Get, INestApplication, Param, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Public } from './../src/common/decorators/public.decorator';

// Test-only routes; "probe" is not a mapped resource so it is logged as "Probe".
@Controller('probe')
class ProbeController {
  @Public()
  @Post(':id')
  write(@Param('id') id: string) {
    return { id };
  }

  @Public()
  @Get(':id')
  read(@Param('id') id: string) {
    return { id };
  }
}

interface LogRow {
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  payload: { route: string; body: Record<string, unknown> };
}

describe('Activity log (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const probeRows = () =>
    dataSource.query<LogRow[]>(
      `SELECT action, entity_type, entity_id, actor_id, payload
         FROM activity_logs WHERE entity_type = 'Probe'`,
    );

  // The audit write is fire-and-forget, so poll instead of assuming timing.
  const waitForRows = async (count: number): Promise<LogRow[]> => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const rows = await probeRows();
      if (rows.length >= count) return rows;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return probeRows();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query(
      `DELETE FROM activity_logs WHERE entity_type = 'Probe'`,
    );
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM activity_logs WHERE entity_type = 'Probe'`,
    );
    await app.close();
  });

  it('does not record a GET', async () => {
    await request(app.getHttpServer()).get('/probe/read-only').expect(200);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await probeRows()).toHaveLength(0);
  });

  it('records a write with the route pattern, entity id and a redacted body', async () => {
    await request(app.getHttpServer())
      .post('/probe/abc-123')
      .send({ note: 'hello', password: 'hunter2' })
      .expect(201);

    const rows = await waitForRows(1);

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('POST');
    expect(rows[0].entity_id).toBe('abc-123');
    expect(rows[0].actor_id).toBeNull();
    expect(rows[0].payload.route).toBe('/probe/:id');
    expect(rows[0].payload.body).toEqual({
      note: 'hello',
      password: '[REDACTED]',
    });
    expect(JSON.stringify(rows[0].payload)).not.toContain('hunter2');
  });
});
