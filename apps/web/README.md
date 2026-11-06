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

| Biến                             | Phía      | Ý nghĩa                                                                                                                           |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN`                     | máy chủ   | Địa chỉ gốc của API. Trình duyệt không gọi thẳng API, chỉ gọi `/api/*` của web.                                                   |
| `PROXY_SECRET`                   | máy chủ   | Cùng giá trị với `PROXY_SECRET` của API; route chuyển tiếp thêm vào `x-hiflow-proxy-secret`.                                      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | công khai | Khóa site của Cloudflare Turnstile (không phải khóa bí mật).                                                                      |
| `SITE_URL`                       | máy chủ   | Địa chỉ công khai của web, không có dấu `/` cuối. Dùng cho sitemap, địa chỉ chuẩn và dữ liệu `JobPosting`; bắt buộc ở production. |

## Phiên đăng nhập và proxy

- Trình duyệt chỉ gọi `/api/*` của web. `src/app/api/[...path]/route.ts` chuyển tiếp tới `API_ORIGIN`, thêm `x-hiflow-proxy-secret`, giữ nguyên cookie, `Retry-After` và `Content-Disposition`, truyền thân yêu cầu dạng luồng (tệp CV không nằm trọn trong bộ nhớ) và bỏ `accessToken` khỏi thân phản hồi `POST /auth/login` (token chỉ còn ở cookie HttpOnly).
- `src/proxy.ts` chỉ kiểm tra lạc quan: không có cookie `hf_access_token` thì chuyển tới `/login?next=`. Quyền thật do API quyết.
- **`X-Forwarded-For` và `TRUST_PROXY`.** Route chuyển tiếp giữ nguyên `X-Forwarded-For` mà nền tảng đứng trước web (ví dụ Vercel) đặt, để API tính giới hạn theo địa chỉ của khách. Hãy đặt `TRUST_PROXY` của API bằng số lớp proxy nằm giữa khách và API **kể cả web**: web gọi thẳng API thì là `1`. Web phải chạy sau một nền tảng tự đặt lại `X-Forwarded-For`; nếu nhận kết nối trực tiếp từ Internet, khách giả được header này và né giới hạn tốc độ.

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

Cần API và Postgres cục bộ đang chạy với dữ liệu `seed:base` (xem `CLAUDE.md`, mục Commands). Khởi động API với `THROTTLE_LIMIT_SCALE=100`: mỗi lượt kiểm thử đăng nhập nhiều lần, mà giới hạn đăng nhập mặc định là 10 lần mỗi phút cho mỗi IP. Mật khẩu của tài khoản mẫu là mật khẩu seed mặc định; đặt `E2E_PASSWORD` nếu bạn đã đổi `SEED_DEFAULT_PASSWORD`. Playwright tự khởi động web ở cổng 3100 và chuyển `/api` tới `E2E_API_URL` (mặc định `http://localhost:4000`):

```bash
npm run test:e2e -w @hiflow/web
```

Ở môi trường cloud, Chromium đã có sẵn: không chạy `playwright install`, và đặt `NODE_USE_ENV_PROXY=1` nếu cần ra ngoài qua proxy.

## Quy ước

- Kiểu, nhãn trạng thái và quyền lấy từ `@hiflow/shared-types`; không khai báo lại enum ở web.
- Tầng giao diện dùng chung (`components/ui`, `components/layout`, `components/shared`, `lib`, `hooks`, `providers`) chỉ được port theo `docs/port-manifest.md`.
- Phụ thuộc npm được thêm trong cùng commit với nơi dùng đầu tiên.

## Triển khai

Danh sách kiểm trước khi đưa lên production (đối chiếu `node_modules/next/dist/docs/01-app/02-guides/production-checklist.md`):

| Hạng mục             | Việc cần làm                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biến môi trường      | Đặt `API_ORIGIN`, `PROXY_SECRET` (cùng giá trị với API), `SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Khóa Turnstile bí mật chỉ nằm ở API (`TURNSTILE_SECRET`). `.env*` đã được git bỏ qua.                                                                                              |
| API                  | `NODE_ENV=production`, `WEB_ORIGIN` là địa chỉ web (danh sách đúng từng origin, không `*`), `PROXY_SECRET`, `TRUST_PROXY`, `REDIS_URL`, `TURNSTILE_SECRET`, `STORAGE_DRIVER=supabase`, `MAIL_DRIVER=resend` (xem `CLAUDE.md`, mục Environment).                                           |
| `TRUST_PROXY`        | Bằng số lớp proxy giữa khách và API, **kể cả web**. Web gọi thẳng API thì là `1`; nếu có thêm CDN hay bộ cân bằng tải trước web thì cộng thêm. Sai số này thì giới hạn tốc độ tính nhầm địa chỉ (mọi khách chung một ngưỡng, hoặc khách giả được `X-Forwarded-For`).                      |
| Nền tảng đứng trước  | Phải tự đặt lại `X-Forwarded-For` (Vercel và các nền tảng tương tự làm việc này). Web không được nhận kết nối trực tiếp từ Internet.                                                                                                                                                      |
| HTTPS                | Bắt buộc. Web gửi `Strict-Transport-Security` khi `NODE_ENV=production`; cookie phiên có `Secure`.                                                                                                                                                                                        |
| Tiêu đề bảo mật      | `next.config.ts` gửi `X-Frame-Options`, `Content-Security-Policy` (chỉ `frame-ancestors`, `base-uri`, `form-action`, `object-src`: không có `script-src` vì cần nonce cho từng yêu cầu, ghi ở `docs/gate-b-audit.md`), `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`. |
| Công cụ tìm kiếm     | `/robots.txt` chỉ cho đọc `/careers`; `/sitemap.xml` liệt kê tin đang tuyển (đọc từ API lúc yêu cầu). Cần `SITE_URL` để địa chỉ là tuyệt đối.                                                                                                                                             |
| Kiểm tra sau khi lên | `npm run build`, rồi mở `/careers`, một tin, `/login`, và chạy `npm run test:e2e -w @hiflow/web` trên môi trường thử (API và Postgres riêng, không phải dữ liệu thật).                                                                                                                    |
