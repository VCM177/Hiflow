# Handoff: web giai đoạn B, B5 xong phần mã (phiên máy local, tiếp theo)

Viết ngày 2026-11-06. Dành cho phiên khác làm tiếp. Đọc hết trước khi chạy lệnh nào. Thay cho `docs/handoff-local-web-2.md` về trạng thái; các lưu ý ở mục 5 và 6 của tệp đó vẫn đúng.

## 0. Cập nhật 2026-11-06: B5 đã đóng

Chủ dự án tạo một **nhánh Neon riêng cho integration test** (thông tin kết nối nằm trong `apps/api/.env.integration`, được git bỏ qua). Trên nhánh đó:

- 3 migration đã chạy (`AddCandidateAnonymizedAt`, `CreateAuditTrail`, `EnforceAuditCapture`), role `hiflow_app` đã được tạo, `seed:base` chạy không thêm dòng nào (nhánh copy dữ liệu từ DB gốc).
- Playwright: 19 test pass (14 của `session.spec.ts` cũ, 5 của `catalogs.spec.ts` mới): tạo, tìm, sửa, xóa qua hộp xác nhận; mã quá ngắn bị chặn ở form; tab Vị trí; địa chỉ danh mục lạ trả 404; recruiter thấy "Không có quyền truy cập".
- e2e của API: 649 pass, 1 hỏng. Chỗ hỏng là `throttle-redis.e2e-spec.ts` (không kết nối được Redis từ máy này, `MaxRetriesPerRequestError`), đúng mục SKIPPED còn mở ở Gate A. Cả bộ chạy 1703 s trên Neon.
- Sau khi chạy: không còn bản ghi `E2E-`/`e2e-` nào, 5 tài khoản demo còn nguyên, 3 phòng ban và 8 vị trí như seed, không còn dòng audit gắn thẻ `e2e`.

**DB gốc cũng đã được nâng cấp (2026-11-06, theo yêu cầu của chủ dự án).** Trước khi chạy: chỉ có 6 tài khoản demo, bảng `activity_logs` có 741 dòng log dev (20 đến 23/9). Đã sao lưu bảng đó ra một tệp JSON ngoài repo, tạo role `hiflow_app`, tách `apps/api/.env` thành `DATABASE_OWNER_URL` (owner) và `DATABASE_URL` (`hiflow_app`; bản `.env` cũ giữ ở `.env.before-audit-split`, git bỏ qua), rồi chạy 3 migration (exit 0). API khởi động bằng role giới hạn, `/health` 200, đăng nhập admin và `GET /departments` đều 200. Bảng `activity_logs` đã bị xóa theo thiết kế của `EnforceAuditCapture`.

Cách chạy lại trên nhánh: nạp `DATABASE_URL` và `DATABASE_OWNER_URL` từ `apps/api/.env.integration` vào môi trường của tiến trình rồi chạy lệnh. **Không dùng `source` của bash**: chuỗi kết nối Neon có ký tự `&` nên bash cắt mất biến. Dùng một script Node (dotenv + `spawn`) hoặc `$env:` của PowerShell. Cài trình duyệt một lần bằng `npx playwright install chromium` trong `apps/web`.

## 1. Việc đã chặn B5 (đã gỡ, giữ lại để tham khảo)

B5 từng chưa đóng vì **chưa chạy trang Danh mục với API thật trong trình duyệt**. API không khởi động được trên DB gốc:

- `npm run migration:show -w @hiflow/api` báo 3 migration chưa chạy: `AddCandidateAnonymizedAt`, `CreateAuditTrail`, `EnforceAuditCapture`. API chết khi khởi động với `relation "audit_events" does not exist`.
- `EnforceAuditCapture.up()` chạy `DROP TABLE "activity_logs"`. Migration ghi rằng bảng đó chỉ chứa dữ liệu mẫu và dữ liệu test, nhưng chưa ai kiểm tra DB mà `apps/api/.env` trỏ tới. Vì vậy phiên này **không chạy `migration:run`**. Chủ dự án cần xác nhận: đây là DB nào, có mất `activity_logs` được không.
- `EnforceAuditCapture` còn cần vai trò `hiflow_app` đã tạo (xem `CLAUDE.md`, mục Environment).

Khi được phép:

1. `npm run migration:run -w @hiflow/api`, rồi `npm run seed:base -w @hiflow/api` nếu thiếu tài khoản mẫu.
2. Khởi động API: `THROTTLE_LIMIT_SCALE=100 npm run start -w @hiflow/api` (chạy nền, chờ `GET /health` trả 200).
3. Viết `apps/web/e2e/catalogs.spec.ts` (theo `session.spec.ts`): đăng nhập admin, mở `/catalogs`, thấy phòng ban mẫu; tạo mục `E2E-...` bằng giao diện, tìm, sửa, xóa qua hộp xác nhận; dọn bằng API nếu test hỏng giữa chừng. Chỉ động vào dữ liệu có tiền tố `E2E-` / `e2e-`.
4. `npm run test:e2e -w @hiflow/web`. Không chạy hai lượt e2e cùng lúc.

## 2. Trạng thái repo

- Nhánh `feat/web-ui-port`, chưa merge vào `develop`, chưa mở PR. Từ `9c96302` có 40 commit mới: 11 commit B4 của phiên cloud và 29 commit của phiên này.
- Thay đổi chưa commit: chỉ `.claude/settings.json` (cấu hình quyền của chủ dự án, không đưa vào commit).
- Cổng gần nhất, tất cả exit 0: `format:check`, `lint`, `typecheck`, `build`, `npm test` (API 344 test; web 505 test, 76 tệp). `/dev/components` và `/dev/tokens` trả 404 khi chạy `next start` (production).
- Phải chạy `npm install` sau khi pull nếu thiếu `react-hook-form` (nó nằm lồng trong `apps/web/node_modules`). Nếu `typecheck` báo `.next/dev/types/validator.ts` trỏ tới `src/app/page.js`, xóa `apps/web/.next/dev` (thư mục sinh ra, git bỏ qua).

## 3. Đã xong trong B5

Thành phần trong `apps/web/src/components/shared/` (mỗi cái có test, một dòng trong `docs/port-manifest.md`, trạng thái `mới` vì không port từ nguồn nào):

| Thành phần                                                                                                             | Ghi chú chính                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `data-table`                                                                                                           | không tự tải dữ liệu; props gom thành `sort` và `state`; hàng là `<Link>` phủ cả hàng; cột `interactive` nổi lên |
| `filter-toolbar`                                                                                                       | tìm kiếm debounce 300 ms; giá trị ban đầu của ô chỉ đọc lúc hiện lần đầu                                         |
| `list-pagination`, `page-size-selector`                                                                                | nhận `meta`; người gọi ghi URL                                                                                   |
| `empty-state`, `status-badge`, `section-card`, `vertical-timeline`, `notes-section`                                    | `status-badge` nhận bản đồ của module                                                                            |
| `confirm-dialog`, `form-dialog`                                                                                        | lỗi API hiện cạnh nút xác nhận; khóa nút và chặn Esc khi đang gửi                                                |
| `unsaved-changes-guard`                                                                                                | nghe `click` pha capture + `beforeunload`; **không chặn được nút Back** (App Router không cho)                   |
| `permission-gate`, `icon-button`                                                                                       | luật 1.4: ẩn nếu không có quyền; khóa kèm lý do nếu dữ liệu khóa                                                 |
| `form/` (`form-field`, `rhf-text-field`, `rhf-textarea-field`, `rhf-select-field`, `rhf-date-field`, `rhf-file-field`) | `inputProps` / `selectProps` cho thuộc tính phụ                                                                  |

Ngoài ra: `lib/forms/apply-api-error.ts` (đưa lỗi 400/413 lên đúng trường); `useListParams` trả `params` đúng kiểu (`ParsedListParams`); `FileInput` gộp `aria-describedby` của người gọi; `src/test/form-harness.tsx` (form thật để test trường).

`packages/shared-types`: thêm `PageMeta`, `Paginated<T>` (API `paginate.ts` import lại từ đây) và `CatalogItemView`.

Trang mẫu Danh mục: `features/catalogs/` + route `/catalogs` (chuyển về `/catalogs/department`) và `/catalogs/[kind]` (`department`, `position`). Dùng DataTable, FilterToolbar, ListPagination, PageSizeSelector, EmptyState, SectionCard, ConfirmDialog, FormDialog, RHFTextField, PermissionGate, IconButton. 38 test (có 23 test tích hợp mock lớp API).

Trang xem thử `/dev/components` (chỉ dev) dùng dữ liệu mẫu cho phần còn lại: StatusBadge, VerticalTimeline, NotesSection, UnsavedChangesGuard, RHFSelect/Date/Textarea/File, applyApiError.

## 4. Lệch so với kế hoạch và quyết định tự chọn

- **Mọi thành phần B5 viết mới, không port.** Handoff trước cho phép port từ bộ cũ nhưng không có đường dẫn nguồn; viết mới là cách `docs/port-manifest.md` đã có (`mới`). Nếu chủ dự án muốn port, hỏi đường dẫn.
- **Trang mẫu không dùng đủ mọi thành phần** như `docs/web-plan-detail.md` mục B5 ghi: Danh mục không có trạng thái, lịch sử, ghi chú, tệp hay ngày. Phần thiếu được xem ở `/dev/components`. Cần chủ dự án chấp nhận hoặc chỉ ra trang thật.
- Danh mục chỉ mở cho ai có `department.item.create` (Admin), khớp menu; ai khác vào thẳng địa chỉ thấy trang "Không có quyền". Nút sửa và xóa dùng `PermissionGate` theo quyền `update` / `delete`.
- Tab Danh mục là hai route riêng (`/catalogs/department`, `/catalogs/position`) vì `useListParams` chỉ ghi các khóa của schema; một tham số `tab` sẽ bị xóa khi đổi sắp xếp.
- `ConfirmDialog` không có tùy chọn `destructive` (không ai dùng); nút xác nhận luôn đỏ.
- `applyApiError` chưa có nơi dùng ngoài trang xem thử: form toàn trang (B7) sẽ dùng. `FormDialog` hiện mọi lỗi API ở cạnh nút vì API không nói trường nào gây lỗi 400.
- Form đăng nhập của B4 còn tự vẽ nhãn và lỗi; có thể chuyển sang `FormField` ở một commit riêng.
- Design guide cấm viên thuốc cho nút và badge; chấm tròn của `VerticalTimeline` là `rounded-full` (không phải nút hay badge). Cần xác nhận cùng với công tắc đã nêu ở handoff trước.

## 5. Việc tiếp theo

1. ~~Đóng B5 bằng e2e thật~~ (xong, xem mục 0). 3 migration đã chạy trên cả nhánh test lẫn DB gốc.
2. ~~Merge `feat/web-ui-port` vào `develop`~~ (xong, fast-forward).
3. B7 (module quản trị) do phiên cloud làm khi B5 đóng.
