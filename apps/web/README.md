# Hiflow web (`@hiflow/web`)

Giao diện quản trị và cổng tuyển dụng công khai của Hiflow, viết bằng Next.js 16 (App Router), React 19 và Tailwind 4. Kế hoạch: `docs/web-plan.md` và `docs/web-plan-detail.md`. Hợp đồng API: `docs/web-api-contract.md`. Quy tắc làm việc: `CLAUDE.md` ở gốc repo.

Next 16 khác bản bạn quen. Trước khi dùng một API của Next, đọc trang tương ứng trong `node_modules/next/dist/docs/` (xem `AGENTS.md`).

## Chạy

Từ gốc repo:

```bash
npm run dev          # API :4000 và web :3000
```

Chỉ web: `npm run dev -w @hiflow/web`. Web cần API chạy ở `API_ORIGIN`.

## Biến môi trường

Sao `.env.example` thành `.env.local` khi cần đổi giá trị. Không có biến nào có tiền tố `NEXT_PUBLIC_` chứa bí mật.

| Biến                             | Phía      | Ý nghĩa                                                                                      |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `API_ORIGIN`                     | máy chủ   | Địa chỉ gốc của API. Trình duyệt không gọi thẳng API, chỉ gọi `/api/*` của web.              |
| `PROXY_SECRET`                   | máy chủ   | Cùng giá trị với `PROXY_SECRET` của API; route chuyển tiếp thêm vào `x-hiflow-proxy-secret`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | công khai | Khóa site của Cloudflare Turnstile (không phải khóa bí mật).                                 |

## Kiểm tra chất lượng

Mỗi commit chạy, từ gốc repo:

```bash
npm run format
npm run lint
npm run typecheck    # API và web
npm test             # unit của API và web (Vitest + Testing Library)
npm run build
```

### Kiểm thử trình duyệt (Playwright)

Cần API và Postgres cục bộ đang chạy (xem `CLAUDE.md`, mục Commands). Playwright tự khởi động web ở cổng 3100 và chuyển `/api` tới `E2E_API_URL` (mặc định `http://localhost:4000`):

```bash
npm run test:e2e -w @hiflow/web
```

Ở môi trường cloud, Chromium đã có sẵn: không chạy `playwright install`, và đặt `NODE_USE_ENV_PROXY=1` nếu cần ra ngoài qua proxy.

## Quy ước

- Kiểu, nhãn trạng thái và quyền lấy từ `@hiflow/shared-types`; không khai báo lại enum ở web.
- Tầng giao diện dùng chung (`components/ui`, `components/layout`, `components/shared`, `lib`, `hooks`, `providers`) chỉ được port theo `docs/port-manifest.md`.
- Phụ thuộc npm được thêm trong cùng commit với nơi dùng đầu tiên.
