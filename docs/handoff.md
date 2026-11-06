# Bàn giao Hiflow

**Cập nhật 2026-11-06 (mới nhất):** web đã xong toàn bộ B7 và B8 (xem `docs/handoff-cloud-b7.md`, phiên 6 đến 11). Cổng B chưa đóng: các việc còn mở và bằng chứng nằm ở `docs/gate-b-audit.md`. Cổng A vẫn còn `throttle-redis` (cần Redis thật trên máy người dùng, mục 2 bên dưới). Phần dưới đây là trạng thái ngày 2026-11-04, giữ để tham khảo.

Cập nhật 2026-11-04, nhánh `claude/jolly-hawking-58ad29` (đã push, cây làm việc sạch; `develop` chưa có các commit B0 và B6). Tài liệu này chỉ ghi trạng thái và việc kế tiếp; quy tắc làm việc nằm ở `CLAUDE.md`, nghiệp vụ ở `docs/business-flow.md`.

## 0. Phiên sau làm gì đầu tiên

1. **Đóng Cổng A**: chỉ còn mục 1.3 (Redis thật). Container cloud không tới được cổng TCP 6379, nên người dùng chạy `npm run test:e2e -w @hiflow/api -- throttle-redis --verbose` trên máy mình (mục 2). Mục 1.1 (Supabase) đã PASS ngày 2026-11-04.
2. **Web giai đoạn B**: 8 câu đã chốt theo đề xuất (2026-11-04). **B0 và B6 đã xong** (nhánh `claude/jolly-hawking-58ad29`, chưa vào `develop`). Bước kế tiếp:
   - Người dùng merge nhánh đó vào `develop`, rồi chạy phiên **local** làm B1 đến B3 (phần port), theo prompt `docs/handoff-local-web.md`.
   - Sau đó cloud làm B4, rồi local làm B5, rồi cloud làm B7 và B8 (`docs/web-plan-detail.md` mục 4).
3. Việc ngoài repo còn lại: sửa mục 1.1.2.1 trong danh sách chức năng, đặt lịch `retention:run` (mục 4).

Credit cloud của người dùng hết hạn **2026-11-05**: ưu tiên việc cần cloud trước hạn đó.

## 1. Đang ở đâu

| Hạng mục                               | Trạng thái                                                                                                                                              | Bằng chứng                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Backend (NestJS)                       | Hoàn tất về chức năng và kiểm thử cục bộ; **Cổng A chưa đóng**: 17 PASS, 0 FAIL, **2 SKIPPED** (mục 1.1 và 1.3)                                         | `docs/gate-a-audit.md` (2026-11-03): 344 unit, 638 e2e pass, 5 bỏ qua     |
| Cổng công khai (tin và form nộp hồ sơ) | Xong ở backend                                                                                                                                          | `modules/public`, `business-flow.md` mục 6                                |
| Nhật ký kiểm toán v2                   | Đã cài đặt (2026-11-02), thay hẳn `activity_logs`                                                                                                       | `docs/audit-trail-spec.md`, `modules/audit`, `test/audit-*.e2e-spec.ts`   |
| Phụ thuộc                              | Đã vá lỗ hổng mức cao của API (2026-11-03); phần còn lại cần bản major và không tới được từ phía khách                                                  | `CLAUDE.md` mục Known gaps, `npm audit --omit=dev`                        |
| Web (`apps/web`)                       | **B0 xong** (Vitest, Playwright, `typecheck`, biến môi trường) và **B6 xong** (view, nhãn, `Jsonified` ở `shared-types`). Chưa có giao diện (B1 trở đi) | `docs/web-plan.md`, `docs/web-plan-detail.md`, `docs/web-api-contract.md` |
| UX giai đoạn 1, 2, 4                   | Có (giai đoạn 4 là prototype bấm được)                                                                                                                  | `docs/ux/*`, artifact ở mục 5                                             |
| UX giai đoạn 3 và 5                    | Chưa làm (không có người dùng thật)                                                                                                                     |                                                                           |

Mọi kết quả kiểm thử trên là **Postgres 16 cục bộ trong container cloud** với role giới hạn `hiflow_app`. **Chưa chạy trên Neon thật** (cần thiết lập ở mục 4).

## 2. Đóng Cổng A: chạy hai spec dịch vụ thật ở cloud

**Kết quả 2026-11-04:** Supabase (1.1) đã PASS ở cloud (3/3, exit 0); Redis (1.3) không chạy được vì container không phân giải DNS và chỉ ra ngoài qua proxy HTTP/HTTPS (`ENOTFOUND`), nên cần chạy trên máy người dùng. Phần còn lại của mục này là quy trình gốc.

Mục 1.1 (Supabase) và 1.3 (Redis) của cổng từng SKIPPED vì container không có khóa. Cả hai từng xanh ngày 2026-09-24 trên máy người dùng; cần chạy lại sau các thay đổi từ đó.

### 2.1 Người dùng chuẩn bị (tôi không làm được)

Trong cài đặt môi trường cloud (https://claude.ai/code, ô chọn môi trường ở màn hình phiên mới, rê chuột lên môi trường rồi bấm biểu tượng cài đặt, hoặc **New environment**):

1. **Name:** bắt buộc có, nếu không nút lưu bị xám (ví dụ `hiflow-test`).
2. **Environment variables** (định dạng `.env`, mỗi dòng `TÊN=giá_trị`, khóa một dòng thì **không bọc dấu nháy**):
   ```
   SUPABASE_URL=https://<mã-project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<khóa service_role>
   REDIS_URL=rediss://default:<mật khẩu>@<host>.upstash.io:6379
   ```
   `SUPABASE_BUCKET` tùy chọn (mặc định đọc từ code); bucket phải **tồn tại và là riêng tư**.
3. **Network access:** đổi sang **Custom**, thêm hai host (Supabase và Upstash) vào **Allowed domains**, giữ ô "Also include default list of common package managers". Hoặc chọn **Full** để thử nhanh.
4. **Không dùng "Network secrets":** cơ chế đó chỉ chèn header HTTP ở proxy, **không** tạo biến `process.env`, nên spec không thấy khóa.
5. Mở **phiên mới** chọn môi trường đó. Phiên đang chạy chỉ đọc biến mới sau khi máy ảo được khôi phục.

Cảnh báo cho người dùng: biến môi trường hiển thị với **mọi người dùng chung môi trường**, và `service_role` có toàn quyền trên project. Chỉ dùng project Supabase và instance Upstash **tạo riêng để thử, không có dữ liệu thật**, và xoay hoặc xóa khóa sau khi chạy xong. Không bao giờ nhờ người dùng dán khóa vào chat.

### 2.2 Phiên sau làm

1. **Kiểm tra biến đã tới phiên, không in giá trị:**
   ```
   for v in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY REDIS_URL; do [ -n "${!v}" ] && echo "$v: có" || echo "$v: KHÔNG có"; done
   ```
   Nếu thiếu thì dừng và nói người dùng kiểm tra mục 2.1 (đặc biệt là có mở phiên mới chưa, và tên môi trường).
2. **Dựng lại Postgres cục bộ** (máy ảo mới không còn gì từ phiên trước):
   ```
   pg_ctlcluster 16 main start
   su postgres -c "psql -c \"CREATE ROLE hiflow LOGIN PASSWORD 'hiflow_local' SUPERUSER\" -c 'CREATE DATABASE hiflow_local OWNER hiflow'"
   psql postgresql://hiflow:hiflow_local@127.0.0.1:5432/hiflow_local -c "CREATE ROLE hiflow_app LOGIN PASSWORD 'hiflow_app_local' NOSUPERUSER NOCREATEDB NOCREATEROLE"
   ```
3. **Tạo `apps/api/.env` bằng công cụ Write**, không bằng `cat` hay `echo` (hook `guard.mjs` chặn mọi lệnh có vẻ in tệp `.env`). Nội dung chỉ cần 3 dòng, vì biến của môi trường cloud đã có sẵn trong tiến trình và `dotenv` không ghi đè:
   ```
   DATABASE_URL=postgresql://hiflow_app:hiflow_app_local@127.0.0.1:5432/hiflow_local
   DATABASE_OWNER_URL=postgresql://hiflow:hiflow_local@127.0.0.1:5432/hiflow_local
   JWT_SECRET=local-test-secret-not-for-production
   ```
4. `npm ci` (nếu cần), rồi `npm run migration:run -w @hiflow/api` và `npm run seed:base -w @hiflow/api` (10 migration).
5. Chạy hai spec và đọc **exit code thật** (suite phải **chạy**, không bỏ qua):
   ```
   npm run test:e2e -w @hiflow/api -- supabase-storage --verbose
   npm run test:e2e -w @hiflow/api -- throttle-redis --verbose
   ```
   Kỳ vọng của Supabase: tải lên, tải qua Signed URL (đúng nội dung), địa chỉ công khai của cùng đối tượng bị từ chối, xóa rồi tải trả 404. Kỳ vọng của Redis: hai kết nối dùng chung một bộ đếm (lần thứ 3 bị chặn với giới hạn 2), và ứng dụng chọn kho Redis khi có `REDIS_URL`.
6. **Redis có thể không chạy được ở cloud.** Tài liệu của môi trường mô tả mọi lưu lượng đi qua proxy HTTP/HTTPS với danh sách cho phép theo tên host, và không nói gì về cổng TCP 6379 hay 6380. Nếu kết nối Redis bị chặn: ghi đúng thông báo lỗi, **không** đánh PASS, và nhờ người dùng chạy riêng spec Redis trên máy của họ.
7. Nếu cả hai xanh: cập nhật mục 1.1 và 1.3 trong `docs/gate-a-audit.md` bằng kết quả thật (lệnh, exit code, số test), đổi kết luận thành **CỔNG ĐÃ ĐÓNG** (19 PASS), sửa lại đoạn "Current state" trong `CLAUDE.md`, rồi commit và push. Nếu chỉ một xanh: ghi mục còn lại là SKIPPED kèm lý do.
8. Nhắc người dùng xoay hoặc xóa khóa thử.

## 3. Web giai đoạn B

Kế hoạch đầy đủ: `docs/web-plan.md` (kiến trúc, mốc B0 đến B8, Cổng B, rủi ro), `docs/web-plan-detail.md` (từng nhiệm vụ, quy ước chung, 12 module, 14 kịch bản Playwright, lịch 11 phiên) và `docs/web-api-contract.md` (79 thao tác API, quyền theo vai trò, trường form; ảnh chụp 2026-11-03, sẽ được thay bằng kiểu dùng chung ở B6).

**Đã chốt (2026-11-04):** cả 8 câu theo đề xuất; G1 là port ở máy người dùng (B1 đến B3 phần port, và B5).

**Phiên 1 (cloud) đã xong:**

- B0: `transpilePackages` cho `@hiflow/shared-types`, `strict` và script `typecheck`, Vitest + Testing Library, Playwright, biến môi trường phía máy chủ (`API_ORIGIN`, `PROXY_SECRET`), README web.
- B6: chuyển 9 giao diện `*-view.ts` và các bản đồ `*_LABEL` vào `packages/shared-types`, thêm `Jsonified<T>`, API dùng lại, test kiểu.

**Ghi chú từ phiên 1 (cloud, 2026-11-04):**

- Cổng chất lượng mỗi commit: `format:check`, `lint`, `typecheck`, `test`, `build` (đều exit 0); e2e API đầy đủ exit 0 (648 test pass, spec Redis bỏ qua vì không tới được Redis). Kiểm thử trình duyệt: `npm run test:e2e -w @hiflow/web` (Playwright tự dựng web ở cổng 3100, `E2E_API_URL` trỏ tới API).
- Test khói Playwright mở `/` chứ không phải `/login` (trang đăng nhập chưa có); B4.8 thay bằng luồng đăng nhập thật.
- Vitest 3 dùng Vite 7, nên không thêm `@vitejs/plugin-react` (bản 6 cần Vite 8); JSX tự động qua esbuild trong `vitest.config.ts`.
- Mới ở `shared-types`: `Jsonified<T>`, `views/` (mọi kiểu phản hồi, gồm `DashboardOverview`, `Report`, `ReportType`, `AuthUser`) và `labels.ts` (thêm `OFFER_STATUS_LABEL` và `USER_ROLE_LABEL`, chữ lấy từ `business-flow.md` và bảng menu, **người dùng chưa xác nhận lại**). `test/view-contract.e2e-spec.ts` khóa phản hồi thật với kiểu chung.
- Một test của API (`storage.module.spec.ts`) từng phụ thuộc vào biến môi trường thật (fail khi có `SUPABASE_URL`); đã sửa cho độc lập với môi trường.
- Kiểu dòng của báo cáo (`RequisitionProgressRow`, `JobResultRow`, `CandidateSourceRow`) vẫn ở API; web hiện dùng `Report.rows` dạng lỏng. Chuyển khi B7 cần.

Trước khi viết bất cứ gì dùng API của Next 16, đọc `node_modules/next/dist/docs/` (`apps/web/AGENTS.md`): ví dụ `middleware` đã đổi thành `proxy.ts`.

**Hai điểm dễ sai đã được ghi trong kế hoạch:** (1) API tính giới hạn tốc độ theo IP, nên Route Handler và các lời gọi lúc dựng trang phải chuyển `X-Forwarded-For` của khách, nếu không mọi khách dùng chung một ngưỡng; (2) sitemap UX còn ghi `/activity-log`, cần đổi thành `/audit-events`, và HR cùng Trưởng bộ phận nay có mục Lịch phỏng vấn.

## 4. Việc còn nợ ngoài web

- **Chạy e2e trên Neon thật** (cloud không có Neon). Thiết lập một lần, máy nào chạy API hoặc e2e cũng phải làm:
  1. Tạo role hạn chế: `neon roles create --name hiflow_app` rồi đặt mật khẩu.
  2. Trong `apps/api/.env`: `DATABASE_URL` trỏ tới **hiflow_app** (API chạy bằng role này), thêm `DATABASE_OWNER_URL` trỏ tới role chủ sở hữu hiện tại (migration, seed, bảo trì e2e). Biến mẫu nằm ở `.env.example`.
  3. `npm run migration:run -w @hiflow/api`.
  4. API từ chối khởi động nếu role đang dùng có quyền UPDATE, DELETE hoặc TRUNCATE trên bảng audit; thông báo lỗi nói cách sửa.
- **Đặt lịch** `npm run retention:run -w @hiflow/api` định kỳ (mã nguồn không tự lên lịch). Lệnh ẩn danh hồ sơ ứng viên quá `CANDIDATE_RETENTION_MONTHS` (12), xóa bản sao giá trị thật của ứng viên đã ẩn danh trong nhật ký, và xóa IP cũ hơn `AUDIT_IP_RETENTION_MONTHS` (12). Có `-- --dry-run`.
- **Sửa tệp ngoài repo:** mục 1.1.2.1 trong `D:\Hiflow\docs\danh-sach-chuc-nang.txt` thành "chuyển tới trang đích theo vai trò".
- **Quyền dùng lại bộ admin cũ** chưa được ghi lại ở đâu; cần người dùng xác nhận trước B1.
- **Quyết định UX 10 đến 19** do người thực hiện tự chốt ngày 2026-10-02 theo ủy quyền; điểm 11, 13, 18, 20 đã cài, điểm 11 được xác nhận 2026-11-02, phần còn lại **chưa ai xác nhận lại** (báo cáo cần ghi rõ như vậy).
- **Khoảng trống backend đã biết** (chi tiết ở `CLAUDE.md` mục Known gaps): văn bản nhân viên viết tay (ghi chú lịch sử trạng thái, nhận xét phỏng vấn, ghi chú offer) chưa được ẩn danh; chưa có danh sách phòng ban công khai; Swagger chưa mô tả phản hồi thành công; chỉ có email xác nhận cho ứng viên và Resend chưa từng gửi thật; `CacheService` dùng bộ nhớ trong; con số 12 tháng là chính sách của dự án, chưa đối chiếu nguyên văn Nghị định 356/2025.

## 5. Tài liệu và tài nguyên nằm ngoài repo

Các thứ dưới đây nằm trên máy của người dùng hoặc trên claude.ai, không có trong git:

- Kế hoạch giai đoạn B v2 cũ đã **mất** (đường dẫn không còn tồn tại; hai file plan còn lại ở thư mục đó thuộc dự án khác, không được chép vào đây). Đã thay bằng `docs/web-plan.md` và `docs/web-plan-detail.md`.
- Prototype giao diện (bản 2, sáng và tối, 5 vai trò, 4 trạng thái bảng): https://claude.ai/artifact/G8sqf8DyGAkdWV1VQ6bk5k
- Danh sách chức năng gốc (12 nhóm): `D:\Hiflow\docs\danh-sach-chuc-nang.txt`.
- Công cụ quét rò rỉ: `D:\Hiflow\tools\leak-scan.sh`, chạy trong pre-commit. **Không có trong cloud**, nên ở cloud pre-commit bỏ qua bước này: tự kiểm tra không đưa tên, miền hay dữ liệu của dự án khác vào repo.
- Bộ admin cũ để port, chỉ đọc: đường dẫn nằm trong `.claude/settings.local.json` (không commit). Không ghi tên hay đường dẫn của nó vào repo.

## 6. Quy tắc dễ vấp (đã gặp thật)

- **Hook `guard.mjs`:** một lệnh `git commit` mỗi lệnh Bash, chỉ một `-m` (header). Khi hook chặn thì **cả lệnh bị hủy**, kể cả phần sửa tệp đi kèm trong cùng lệnh: tách ra và kiểm tra lại tệp đã được sửa chưa. Không nối các bước kiểm tra bằng `;` trước khi commit: dùng `&&` để lint lỗi thì dừng. Push thường (không force, không đụng `main` hoặc `master`) đã được phê duyệt; merge hay push vào `main` cần người dùng xác nhận từng lần.
- **Không in `apps/api/.env`.** Tạo tệp bằng công cụ Write. Mọi biến được mô tả ở `.env.example`.
- **Heredoc không có dấu nháy** (`<<EOF`) để shell chạy mọi đoạn trong dấu backtick của nội dung. Dùng `<<'EOF'`, hoặc ghi tệp bằng công cụ Write.
- **Postgres cục bộ tắt giữa các lượt** (container khởi động lại). Chạy `pg_ctlcluster 16 main start` trước mỗi lượt e2e. Chạy khi DB tắt sẽ hỏng, và có thể để sót dữ liệu `E2E-`.
- **Không chạy hai bộ e2e cùng lúc:** chúng tranh khung giờ phỏng vấn và lỗi 409. Dữ liệu `E2E-` sót từ lượt hỏng cũng gây 409 ở các suite chạy sớm; kiểm tra và dọn bằng role owner.
- **e2e ở cloud:** hai suite captcha cần `NODE_USE_ENV_PROXY=1` (Node 22 không tự đi qua proxy của sandbox; dự án chuẩn là Node 20). Chạy nền, ghi log ra tệp kèm dòng `EXIT=` và chờ bằng cách đọc tệp đó. **Không** chờ bằng `pgrep -f "jest --config"`: lệnh chờ tự khớp chính nó.
- **Test ghi dữ liệu trực tiếp** dùng `ctx.maintenance` (owner, capture tắt), không bao giờ `ctx.dataSource` (role giới hạn bị chặn `HF001`). Test ẩn danh phải dọn theo id và tiêu đề tin, không theo tiền tố email `e2e-`.
- **Báo cáo trung thực:** test bỏ qua là bỏ qua, không phải pass; không thay thế bằng dữ liệu giả; ghi exit code thật.
- Nói chuyện với người dùng bằng tiếng Việt; mã, comment và commit bằng tiếng Anh, commit chỉ có header.

## 7. Giới hạn đã biết của phần UX

- Persona là **proto-persona** dựng từ nghiệp vụ và nghiên cứu tại bàn, vì không tiếp cận được người dùng thật.
- Số liệu thị trường phần lớn là của Mỹ và toàn cầu, lấy qua trang tổng hợp, chưa đối chiếu bản gốc; báo cáo thị trường Việt Nam của TopCV chỉ dành cho người đăng ký nên chưa có số liệu tương ứng.
- Điểm cảm xúc trong journey map là giả định.
- Chưa có email nào cho ứng viên ngoài thư xác nhận nhận hồ sơ, và chưa gửi thử qua Resend thật.
