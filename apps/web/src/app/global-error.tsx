'use client';

// The last net: it replaces the root layout when that layout itself fails, so it brings its
// own document and cannot lean on the app's styles or components.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          color: '#334155',
          background: '#f8fafc',
        }}
      >
        <main
          style={{
            maxWidth: 420,
            margin: '0 auto',
            padding: '4rem 1rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#0f172a', fontSize: '1.25rem' }}>
            Có lỗi xảy ra
          </h1>
          <p>Trang không hiển thị được. Vui lòng thử lại.</p>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 8,
              padding: '0.5rem 1rem',
              border: 0,
              borderRadius: 6,
              background: '#1d4ed8',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
