import { notFound } from 'next/navigation';

// Development only: a token preview that must never be served in production.
const SURFACES = [
  { name: 'bg-page', cls: 'bg-hf-bg-page' },
  { name: 'bg-surface', cls: 'bg-hf-bg-surface' },
  { name: 'bg-card', cls: 'bg-hf-bg-card' },
];

const TEXT = [
  { name: 'text-heading', cls: 'text-hf-text-heading' },
  { name: 'text-body', cls: 'text-hf-text-body' },
  { name: 'text-muted', cls: 'text-hf-text-muted' },
];

const STATUS = [
  { name: 'warning', fill: 'bg-hf-warning', text: 'text-hf-warning-text' },
  { name: 'success', fill: 'bg-hf-success', text: 'text-hf-success-text' },
  {
    name: 'destructive',
    fill: 'bg-hf-destructive',
    text: 'text-hf-destructive',
  },
  { name: 'neutral', fill: 'bg-hf-neutral', text: 'text-hf-neutral-text' },
];

const CHARTS = [
  'bg-hf-chart-1',
  'bg-hf-chart-2',
  'bg-hf-chart-3',
  'bg-hf-chart-4',
  'bg-hf-chart-5',
];

const RADII = [
  { name: 'badge (4px)', cls: 'rounded-hf-badge' },
  { name: 'control (6px)', cls: 'rounded-hf-control' },
  { name: 'container (8px)', cls: 'rounded-hf-container' },
  { name: 'overlay (12px)', cls: 'rounded-hf-overlay' },
];

export default function DevTokensPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-hf-text-heading">
          Token Hiflow
        </h1>
        <p className="text-hf-text-muted">
          Trang này chỉ có trong môi trường phát triển.
        </p>
      </header>

      <section aria-labelledby="surfaces" className="flex flex-col gap-3">
        <h2 id="surfaces" className="font-semibold text-hf-text-heading">
          Nền
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {SURFACES.map((s) => (
            <div
              key={s.name}
              className={`${s.cls} rounded-hf-container border border-hf-border p-4 text-sm text-hf-text-body`}
            >
              {s.name}
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="text"
        className="flex flex-col gap-2 rounded-hf-container bg-hf-bg-card p-4 shadow-hf-card"
      >
        <h2 id="text" className="font-semibold text-hf-text-heading">
          Chữ trên nền trắng
        </h2>
        {TEXT.map((t) => (
          <p key={t.name} className={t.cls}>
            {t.name}: Chữ tiếng Việt có dấu, ví dụ “Ứng viên đang chờ phỏng
            vấn”.
          </p>
        ))}
      </section>

      <section aria-labelledby="status" className="flex flex-col gap-3">
        <h2 id="status" className="font-semibold text-hf-text-heading">
          Trạng thái
        </h2>
        <div className="flex flex-wrap gap-3">
          {STATUS.map((s) => (
            <div key={s.name} className="flex flex-col gap-1">
              <span
                className={`${s.fill} h-6 w-24 rounded-hf-badge`}
                aria-hidden="true"
              />
              <span className={`${s.text} text-sm font-medium`}>{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="chart" className="flex flex-col gap-3">
        <h2 id="chart" className="font-semibold text-hf-text-heading">
          Biểu đồ (thứ tự: chính, thành công, cảnh báo, đỏ, trung tính)
        </h2>
        <div className="flex gap-2">
          {CHARTS.map((c) => (
            <span
              key={c}
              className={`${c} h-8 w-16 rounded-hf-badge`}
              aria-hidden="true"
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="radius" className="flex flex-col gap-3">
        <h2 id="radius" className="font-semibold text-hf-text-heading">
          Bán kính theo vai trò
        </h2>
        <div className="flex flex-wrap gap-3">
          {RADII.map((r) => (
            <div
              key={r.name}
              className={`${r.cls} h-16 w-32 border border-hf-border-control bg-hf-bg-surface p-2 text-xs text-hf-text-body`}
            >
              {r.name}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
