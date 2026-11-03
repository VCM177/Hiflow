# Kế hoạch chi tiết web giai đoạn B

Viết ngày 2026-11-03. Phần mở rộng của `docs/web-plan.md` (tổng quan, kiến trúc, 8 câu cần chốt). Tài liệu này chia từng mốc thành **nhiệm vụ nhỏ, mỗi nhiệm vụ một commit**, nêu tệp tạo ra, phụ thuộc, cách kiểm chứng, và người làm được ở đâu. Hợp đồng API đầy đủ nằm ở `docs/web-api-contract.md` (sinh từ bản build thật, 79 thao tác).

## 0. Giả định

8 câu ở `web-plan.md` mục 8 chưa được trả lời. Kế hoạch dưới đây **dùng đề xuất của tôi làm giả định**, ký hiệu `[G1]` đến `[G8]` ở chỗ nó ảnh hưởng. Nếu bạn đổi câu nào, chỉ các nhiệm vụ mang ký hiệu đó phải viết lại.

| Ký hiệu | Giả định                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| G1      | B1 đến B5 làm **trên máy của bạn** (port từng tệp từ bộ cũ, mỗi tệp một commit, ghi manifest). B0, B6, B7, B8 làm được ở cloud. |
| G2      | TanStack Query, React Hook Form + Zod, Radix UI, một thư viện toast, Vitest + Testing Library, Playwright.                      |
| G3      | Chuyển các giao diện `*-view.ts` vào `packages/shared-types` kèm `Jsonified<T>`.                                                |
| G4      | Chuyển các bản đồ `*_LABEL` sang `shared-types`.                                                                                |
| G5      | Web triển khai riêng với API; Route Handler chuyển tiếp thêm `x-hiflow-proxy-secret`.                                           |
| G6      | Trình soạn mô tả tin là Tiptap tải lười, làm sạch HTML cả hai đầu.                                                              |
| G7      | Không có chế độ tối trong giai đoạn B.                                                                                          |
| G8      | Cổng công khai làm đầu tiên trong B7.                                                                                           |

## 1. Quy ước chung

### 1.1 Một nhiệm vụ = một commit

Mã nhiệm vụ `Bx.y`. Header commit theo Conventional Commits, chỉ có header: `feat(web): ...`, `chore(web): ...`, `test(web): ...`, `refactor(types): ...`, `docs: ...`. Lớp theo thứ tự `CLAUDE.md`: kiểu, hằng số, schema, mapper, API, hook truy vấn, component. Phụ thuộc npm thêm cùng commit với nơi dùng đầu tiên.

### 1.2 Cổng chất lượng cho mỗi commit

```
npm run format
npm run lint
npm run typecheck        # có từ B0.2
npm test                 # unit (api) + web (Vitest), có từ B0.3
npm run build
```

Module có luồng Playwright thì chạy thêm `npm run test:e2e -w @hiflow/web` trên API và Postgres cục bộ. Trước mỗi commit chạy `/tl-review` (W-01 đến W-10), và `/tl-review plan` cho nhiệm vụ đầu tiên của mỗi mốc hoặc module. Trước khi viết bất cứ gì dùng API của Next, đọc trang tương ứng trong `node_modules/next/dist/docs/` (xem `apps/web/AGENTS.md`).

### 1.3 Ánh xạ lỗi HTTP sang giao diện

| Mã            | Ý nghĩa (API)                                              | Khi tải trang                        | Khi thao tác (nút, form)                                                                                                              |
| ------------- | ---------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 400           | Dữ liệu sai; `message` là chuỗi tiếng Việt hoặc mảng chuỗi | Trang lỗi chung                      | Lỗi ở trường tương ứng nếu xác định được, nếu không: dòng lỗi cạnh nút xác nhận (dialog) hoặc toast (form toàn trang, hành động dòng) |
| 401           | Chưa đăng nhập hoặc hết phiên                              | Chuyển tới `/login?next=<đường dẫn>` | Như bên trái, giữ `next`                                                                                                              |
| 403           | Thiếu quyền                                                | Trang "Không có quyền"               | Toast "Bạn không có quyền thực hiện thao tác này"                                                                                     |
| 404           | Không tồn tại **hoặc ngoài phạm vi** (không phân biệt)     | Trang "Không tồn tại"                | Toast, rồi làm mới danh sách                                                                                                          |
| 409           | Xung đột trạng thái hoặc luật nghiệp vụ; `message` nói rõ  | Không áp dụng                        | Hiện nguyên văn `message` của API; với các thông báo "vừa được xử lý bởi người khác" thêm nút **Tải lại**                             |
| 413           | Tệp quá lớn                                                | Không áp dụng                        | Lỗi ở ô tệp                                                                                                                           |
| 429           | Quá giới hạn; header `Retry-After` (giây)                  | Trang tạm chờ có đếm ngược           | "Thử lại sau N giây" cạnh nút                                                                                                         |
| 5xx, mất mạng | Lỗi máy chủ                                                | Trang lỗi có nút thử lại             | Toast "Có lỗi xảy ra, vui lòng thử lại", giữ nguyên dữ liệu đã nhập                                                                   |

Một hàm duy nhất `describeApiError(error, { field })` quyết định bảng này; component không tự phân tích mã lỗi.

### 1.4 Ẩn hay vô hiệu hóa

- **Ẩn** mục điều hướng và nút mà vai trò **không bao giờ** có quyền (không có chuỗi quyền).
- **Vô hiệu hóa kèm tooltip nêu lý do** nút mà vai trò có quyền nhưng **trạng thái dữ liệu** đang khóa (ví dụ "Đề nghị" khi chưa có vòng phỏng vấn Đạt).
- Quyết định này đặt trong một hàm theo từng module (`actionsFor(entity, can)`), có test; không rải điều kiện trong JSX.

### 1.5 Trạng thái danh sách trên URL

Mọi danh sách dùng cùng một lược đồ truy vấn: `page`, `limit` (mặc định 10, tối đa 100), `search` (tối đa 100, debounce 300 ms), `sortBy`, `sortDir`, cùng các bộ lọc riêng của module (xem hợp đồng). Hook `useListParams(schema)` đọc và ghi URL; bộ lọc không hợp lệ bị bỏ chứ không làm hỏng trang. Nút "Xóa bộ lọc" chỉ hiện khi có bộ lọc.

### 1.5b Khóa truy vấn

`[thực thể, 'list' | 'detail' | 'options', tham số]`. Sau mỗi thao tác ghi, vô hiệu hóa danh sách và chi tiết của chính thực thể đó, và các thực thể phụ thuộc đã biết (ví dụ chuyển trạng thái hồ sơ vô hiệu hóa cả chi tiết hồ sơ, danh sách hồ sơ và Tổng quan). Truy vấn không thử lại khi gặp 4xx.

### 1.6 Quy tắc kiểm tra mà form phải phản chiếu

Máy chủ luôn kiểm tra lại; form kiểm tra trước để báo sớm. Các quy tắc dưới đây lấy từ code hiện tại (OpenAPI không có chúng):

| Trường                                              | Quy tắc                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Mật khẩu mới                                        | 8 đến 72 ký tự, ít nhất một chữ cái và một chữ số                                        |
| Email                                               | định dạng email, tối đa 150, **chuẩn hóa về chữ thường** trước khi gửi                   |
| Số điện thoại                                       | bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc rồi khớp `^(?:\+84\|0)\d{9,10}$`            |
| Họ tên (form công khai)                             | 2 đến 100 ký tự, một dòng, không ký tự điều khiển hay định dạng ẩn                       |
| Họ tên (nội bộ)                                     | tối đa 100                                                                               |
| Đồng ý xử lý dữ liệu (form công khai)               | bắt buộc `true`                                                                          |
| CV                                                  | PDF hoặc DOCX, tối đa 5 MB; `.doc` cũ bị từ chối                                         |
| Ngày sinh ứng viên                                  | ngày hợp lệ; máy chủ từ chối dưới 16 tuổi                                                |
| Ngày giờ phỏng vấn                                  | ISO 8601 có giờ và múi giờ (ví dụ `2026-10-01T09:00:00+07:00`), ở tương lai              |
| Mã danh mục                                         | `^[A-Za-z0-9_]{2,30}$` (máy chủ viết hoa)                                                |
| Lương tin                                           | `salaryMin ≤ salaryMax`; offer: lương từ 1 đến 10.000.000.000                            |
| Offer                                               | ngày nhận việc không ở quá khứ; hạn phản hồi không ở quá khứ và không sau ngày nhận việc |
| Từ chối hồ sơ, không đạt phỏng vấn, từ chối yêu cầu | bắt buộc nhập lý do hoặc nhận xét                                                        |

### 1.7 Định dạng

Tiền VND không có phần thập phân (`formatCurrency`), ngày `dd/MM/yyyy`, ngày giờ `dd/MM/yyyy HH:mm` theo múi giờ Việt Nam (`formatDate`, `formatDateTime`, vi-VN). Ô nhập giờ phỏng vấn đọc giờ địa phương rồi gửi kèm độ lệch `+07:00`.

## 2. Các mốc

Cột "Ở đâu": **cloud** (làm được trong phiên này), **máy bạn** (cần bộ cũ để port, theo `[G1]`).

### B0 Chuẩn bị (cỡ S, cloud)

| Mã   | Nhiệm vụ                                                                                                                                                                            | Tệp chính                                        | Kiểm chứng                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| B0.1 | `docs:` ghi câu trả lời 8 câu vào `web-plan.md`, đổi tiêu đề mục 8 thành "Đã chốt"                                                                                                  | `docs/web-plan.md`                               | bạn xác nhận                                                                          |
| B0.2 | `chore(web):` cho web nhập được `@hiflow/shared-types` (`transpilePackages`), bật `strict`, thêm script `typecheck` ở web và ở gốc                                                  | `apps/web/next.config.ts`, `package.json`        | trang thử nhập `PERMISSIONS` ở component máy chủ và component máy khách đều dựng được |
| B0.3 | `chore(web):` Vitest + jsdom + Testing Library, một test khói; nối vào `npm test` ở gốc                                                                                             | `apps/web/vitest.config.ts`                      | `npm test` chạy cả hai gói                                                            |
| B0.4 | `chore(web):` Playwright: cấu hình, `webServer` cho web, đọc `E2E_API_URL`; hướng dẫn chạy với API cục bộ; script `test:e2e`                                                        | `apps/web/playwright.config.ts`, `apps/web/e2e/` | một test mở `/login` pass                                                             |
| B0.5 | `chore(web):` biến môi trường: thay `NEXT_PUBLIC_API_BASE_URL` bằng `API_ORIGIN`, `PROXY_SECRET` (chỉ phía máy chủ), thêm `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; cập nhật `.env.example` | `apps/web/.env.example`                          | không biến nào có tiền tố `NEXT_PUBLIC_` chứa bí mật                                  |
| B0.6 | `docs:` viết lại `apps/web/README.md`, cập nhật lệnh trong `CLAUDE.md`                                                                                                              |                                                  |                                                                                       |

Xong khi: `format`, `lint`, `typecheck`, `test`, `build` đều exit 0.

### B1 Token (cỡ S, máy bạn `[G1]`)

| Mã   | Nhiệm vụ                                                                                                                                                                                                                       | Ghi chú                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| B1.1 | `styles/tokens.css`: toàn bộ `--hf-*` theo design guide (nền trang, bề mặt, thẻ, tiêu đề, thân, viền, primary và hover, warning, success, destructive, neutral, năm màu biểu đồ, bốn bán kính theo vai trò, cỡ chữ nhỏ có tên) | không hex ngoài tệp này           |
| B1.2 | Ánh xạ vào Tailwind 4 (`@theme`) để lớp tiện ích dùng token                                                                                                                                                                    |                                   |
| B1.3 | Phông có tập con tiếng Việt qua `next/font` (ứng viên: Inter), nền, reset                                                                                                                                                      | cần xác nhận phông khi port       |
| B1.4 | Trang xem mẫu token chỉ có ở môi trường phát triển                                                                                                                                                                             | không đóng gói ra sản xuất        |
| B1.5 | Test tương phản AA cho mọi cặp chữ trên nền, **gồm chữ của trạng thái trung tính** (design guide yêu cầu token chữ đậm hơn)                                                                                                    | test đơn vị tính tỷ lệ tương phản |

### B2 Primitive (cỡ M, máy bạn `[G1]`)

Mỗi primitive: trạng thái mặc định, hover, focus (vòng focus thấy được), vô hiệu, lỗi (nếu có); nhãn đọc màn hình; test thành phần cho thao tác bàn phím.

| Nhóm      | Thành phần                                                                                        | Điểm bắt buộc                                                           |
| --------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Nút       | `Button` (primary, secondary, ghost, destructive; cỡ md, sm, `icon-sm`), trạng thái đang tải      | không dạng viên thuốc, bán kính 6px; `icon-sm` bắt buộc có `aria-label` |
| Nhập liệu | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `FileInput`                                  | nhãn luôn nằm trên ô, viền + biểu tượng + chữ cho lỗi                   |
| Lớp phủ   | `Dialog` (cỡ sm, md, lg), `Tooltip`, `Popover`, `DropdownMenu`                                    | bẫy focus, trả focus, đóng bằng Esc; bán kính 12px                      |
| Hiển thị  | `Badge` (primary, success, warning, destructive, neutral), `Skeleton`, `Spinner`, `Tabs`, `Toast` | bán kính badge 4px                                                      |

### B3 Thư viện lõi (cỡ M, máy bạn `[G1]` cho phần port, cloud cho phần viết mới)

| Mã   | Nhiệm vụ                                                                                                     | Tệp                              | Test                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| B3.1 | Client API: gốc `/api`, JSON, lỗi có kiểu `ApiError { status, messages[], retryAfter }`, hỗ trợ multipart    | `lib/api/client.ts`, `errors.ts` | mô phỏng 400, 401, 403, 404, 409, 413, 429 (có `Retry-After`), 5xx, mất mạng |
| B3.2 | `describeApiError` (bảng 1.3)                                                                                | `lib/api/describe-error.ts`      | mỗi dòng của bảng                                                            |
| B3.3 | Trình dựng chuỗi truy vấn, bỏ giá trị rỗng                                                                   | `lib/api/query-string.ts`        |                                                                              |
| B3.4 | Định dạng vi-VN                                                                                              | `lib/format.ts`                  | tiền, ngày, ngày giờ, múi giờ                                                |
| B3.5 | Quy tắc dùng lại (bảng 1.6)                                                                                  | `lib/validations.ts`             | từng quy tắc, gồm các ca biên                                                |
| B3.6 | Quyền: `useCan`, `can(permissions, permission)` dựa trên `hasPermission` của `shared-types`                  | `lib/permissions.ts`             | `*` của Admin, vai trò thiếu quyền                                           |
| B3.7 | `QueryClient` mặc định (không thử lại 4xx, xử lý 401 toàn cục) và khóa truy vấn                              | `lib/query/`                     |                                                                              |
| B3.8 | `useListParams`, `useDebouncedValue`                                                                         | `hooks/`                         | đọc và ghi URL, bỏ bộ lọc sai                                                |
| B3.9 | Mẫu `features/<module>/constants.ts`: ánh xạ `trạng thái -> { nhãn, biến thể }` theo enum của `shared-types` | `features/*/constants.ts`        | mọi giá trị enum đều có mục (test phủ)                                       |

### B4 Phiên và khung (cỡ M, cloud)

| Mã   | Nhiệm vụ                                                                                                     | Chi tiết cần chú ý                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B4.1 | Route Handler chuyển tiếp `app/api/[...path]/route.ts`                                                       | Chuyển mọi phương thức, thân (gồm multipart, không đệm toàn bộ), `Set-Cookie`, `Retry-After`, `Content-Disposition`; thêm `x-hiflow-proxy-secret`; bỏ các header đi kèm đường truyền; **chuyển địa chỉ IP của người truy cập qua `X-Forwarded-For`** (API tính giới hạn theo `req.ip` nên nếu không chuyển, mọi người dùng chung một ngưỡng) và đặt `TRUST_PROXY` của API cho đúng số lớp |
| B4.2 | `proxy.ts` kiểm tra lạc quan                                                                                 | Không có cookie phiên thì chuyển tới `/login?next=`; bỏ qua `/login`, `/careers/**`, tệp tĩnh. Quyền thật do API quyết                                                                                                                                                                                                                                                                    |
| B4.3 | Trang đăng nhập                                                                                              | Lỗi 401 chung, 403 "tài khoản bị khóa", 429 có đếm ngược; giữ email đã nhập; sau khi vào: về `next` hoặc trang đích theo vai trò                                                                                                                                                                                                                                                          |
| B4.4 | `SessionProvider`, `useSession` từ `GET /auth/me`                                                            | Chứa người dùng và `permissions`; đăng xuất gọi `POST /auth/logout` rồi xóa cache truy vấn                                                                                                                                                                                                                                                                                                |
| B4.5 | Trang đích theo vai trò                                                                                      | có `dashboard.overview.view` thì `/`, nếu không (Phỏng vấn viên) thì `/interviews?result=PENDING`                                                                                                                                                                                                                                                                                         |
| B4.6 | Khung: thanh bên thu gọn (lưu trong `localStorage`, bọc `try/catch`), thanh trên có menu hồ sơ, `PageHeader` | Menu cấu hình theo bảng 2.1                                                                                                                                                                                                                                                                                                                                                               |
| B4.7 | Trang 403, 404, lỗi chung, `loading`                                                                         |                                                                                                                                                                                                                                                                                                                                                                                           |
| B4.8 | Playwright: đăng nhập từng vai trò, kiểm tra menu và trang đích                                              | chạy với `seed:base`                                                                                                                                                                                                                                                                                                                                                                      |

**Bảng 2.1: mục menu và quyền cần có.** Menu đọc từ quyền, không từ tên vai trò.

| Mục                | Đường dẫn       | Quyền cần                               | Hiện cho                                                        |
| ------------------ | --------------- | --------------------------------------- | --------------------------------------------------------------- |
| Tổng quan          | `/`             | `dashboard.overview.view`               | Admin, HR, Trưởng bộ phận, Tuyển dụng                           |
| Yêu cầu tuyển dụng | `/requisitions` | `requisition.list.view`                 | Admin, HR, Trưởng bộ phận, Tuyển dụng                           |
| Tin tuyển dụng     | `/jobs`         | `job.list.view`                         | cùng nhóm trên                                                  |
| Ứng viên           | `/candidates`   | `candidate.list.view`                   | Admin, HR, Tuyển dụng, Phỏng vấn viên                           |
| Hồ sơ ứng tuyển    | `/applications` | `application.list.view`                 | tất cả                                                          |
| Lịch phỏng vấn     | `/interviews`   | `interview.list.view`                   | tất cả (từ khi Trưởng bộ phận được cấp quyền xem lịch của mình) |
| Báo cáo            | `/reports`      | `report.overview.view`                  | Admin, HR                                                       |
| Người dùng         | `/users`        | `user.list.view`                        | Admin, HR                                                       |
| Danh mục           | `/catalogs`     | `department.item.create` (chỉ Admin có) | Admin                                                           |
| Nhật ký kiểm toán  | `/audit-events` | `audit.event.view`                      | Admin                                                           |

Hai chỗ **lệch so với `docs/ux/02-define.md`** cần sửa tài liệu UX khi làm B4: Trưởng bộ phận và HR nay có mục Lịch phỏng vấn (quyết định 11, đã cài), và đường dẫn nhật ký là `/audit-events`, không còn `/activity-log`.

### B5 Component dùng chung (cỡ L, máy bạn `[G1]`)

| Thành phần                                        | Hợp đồng chính                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DataTable`                                       | cột khai báo, `getRowKey` bằng id thực thể, sắp xếp nhấn vào tiêu đề (ghi vào URL), hàng là `<Link>`, ba trạng thái (khung chờ, rỗng, lỗi có thử lại), số căn phải với chữ số đều |
| `FilterToolbar`                                   | tìm kiếm debounce 300 ms, bộ lọc nhẹ nằm trên dòng, bộ lọc phức tạp mở trong dialog, nút xóa chỉ khi có bộ lọc                                                                    |
| `ListPagination`, `PageSizeSelector`              | đọc và ghi `page`, `limit`; tổng từ `meta`                                                                                                                                        |
| `EmptyState`                                      | nêu lý do và hành động tiếp theo                                                                                                                                                  |
| `StatusBadge`                                     | nhận `status` và bản đồ của module, không bao giờ tự chọn màu                                                                                                                     |
| `SectionCard`, `VerticalTimeline`, `NotesSection` | khung trang chi tiết; ghi chú lưu bằng PUT, rỗng nghĩa là xóa                                                                                                                     |
| `ConfirmDialog`                                   | bắt buộc cho hành động phá hủy; tùy chọn ô lý do bắt buộc                                                                                                                         |
| `UnsavedChangesGuard`                             | cho form toàn trang                                                                                                                                                               |
| Trường RHF dùng chung                             | `RHFTextField`, `RHFSelectField`, `RHFDateField`, `RHFTextareaField`, `RHFFileField`; mỗi trường nhận lỗi từ Zod và từ `describeApiError`                                         |
| `FormDialog`                                      | lỗi hiện cạnh nút xác nhận; khóa nút khi đang gửi                                                                                                                                 |
| `PermissionGate`                                  | hiển thị, ẩn hoặc vô hiệu hóa theo 1.4                                                                                                                                            |

Xong B5 khi một trang mẫu (Danh mục) dùng đủ các thành phần trên với dữ liệu thật, và có test cho từng thành phần. **Không bắt đầu B7 module quản trị trước khi xong.**

### B6 Chia sẻ kiểu với API (cỡ S đến M, cloud, `[G3]` `[G4]`)

| Mã   | Nhiệm vụ                                                                                                                                                                                                                                            | Kiểm chứng                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| B6.1 | `refactor(types):` thêm `Jsonified<T>` (đổi `Date` thành `string`, kể cả khi trường có thể là `null`)                                                                                                                                               | test kiểu                   |
| B6.2 | `refactor(types):` chuyển 9 giao diện `*-view.ts` (ứng dụng, yêu cầu, tin, ứng viên, phỏng vấn, offer, người dùng, tin công khai, kiểm toán) và kiểu của `/dashboard/overview`, `/reports/:type`, `/auth/me` vào `packages/shared-types/src/views/` | API biên dịch, mọi e2e xanh |
| B6.3 | `refactor(api):` các hàm `toXView` trả đúng kiểu chung                                                                                                                                                                                              |                             |
| B6.4 | `refactor(types):` chuyển các bản đồ `*_LABEL` (trạng thái yêu cầu, tin, hồ sơ, phỏng vấn, offer, nguồn ứng viên, vai trò) sang `shared-types`                                                                                                      | web và API cùng nhập        |
| B6.5 | `test(api):` một test kiểm tra phản hồi thật của mỗi endpoint khớp kiểu chung ở các trường bắt buộc                                                                                                                                                 |                             |
| B6.6 | `docs:` bỏ dòng "web phải đọc các tệp view" khỏi `CLAUDE.md`, ghi nguồn mới                                                                                                                                                                         |                             |

Lưu ý: tham số truy vấn của danh sách và thân các DTO vẫn là hợp đồng của API; web dùng Zod riêng cho form (bảng 1.6).

### B7 Module

Mỗi module theo thứ tự lớp ở 1.1 và Định nghĩa xong ở `web-plan.md` mục 6. Ký hiệu quyền lấy từ `PERMISSIONS`. "TBP" là Trưởng bộ phận, "TD" là Tuyển dụng, "PV" là Phỏng vấn viên.

#### B7.1 Cổng công khai `[G8]`

| Mã  | Nhiệm vụ                                | Chi tiết                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Danh sách `/careers`                    | `GET /public/jobs`: thẻ gồm tiêu đề, phòng ban, địa điểm, **khoảng lương**, ngày đăng; tìm kiếm và sắp xếp (`publishedAt`, `title`). **Không có bộ lọc phòng ban** vì API công khai không trả danh sách phòng ban (chỉ nhận `departmentId`): ghi vào "khoảng trống đã biết", cân nhắc thêm endpoint sau          |
| 1.2 | Chi tiết `/careers/[slugId]`            | Tách id UUID ở cuối `slugId` (`<slug>-<uuid>`); slug sai hoặc cũ thì chuyển hướng vĩnh viễn về địa chỉ chuẩn; `GET /public/jobs/:id`; mô tả HTML **làm sạch bằng một hàm duy nhất** `sanitizeJobHtml` (có test với `<script>`, `onerror`, `javascript:`, `<iframe>`); `generateMetadata` và JSON-LD `JobPosting` |
| 1.3 | Form nộp hồ sơ                          | Họ tên, email, điện thoại, CV, đồng ý, Turnstile (bảng 1.6). Ghi "PDF hoặc DOCX, tối đa 5 MB" **trước** khi chọn tệp; kiểm tra tệp ở trình duyệt; nút gửi khóa khi đang gửi; gửi multipart qua `/api/public/jobs/:id/applications`                                                                               |
| 1.4 | Xử lý phản hồi                          | 202 chuyển tới `/thanks`; 400 báo lỗi tại ô tệp nếu `message` nhắc CV hoặc tệp, ngược lại ở trường tương ứng hoặc phía trên form; 413 tại ô tệp; 429 báo thời gian chờ theo `Retry-After`; 404 sang trang thân thiện; lỗi dịch vụ xác minh (5xx) báo "tạm thời không khả dụng, thử lại sau"                      |
| 1.5 | Trang cảm ơn `/careers/[slugId]/thanks` | Nội dung **cố định** (không lộ đã nộp trùng hay chưa): đã nhận, thời gian phản hồi dự kiến (hằng số cấu hình), nhắc để ý cuộc gọi hoặc email                                                                                                                                                                     |
| 1.6 | Trang 404 thân thiện                    | "Tin này không còn nhận hồ sơ", kèm các tin đang mở (tin nháp, đã đóng và không có cùng một 404)                                                                                                                                                                                                                 |
| 1.7 | Playwright                              | luồng nộp thành công, nộp tệp sai định dạng, nộp quá 5 MB, nộp thiếu đồng ý, tin đã đóng, giới hạn 429 (với `THROTTLE_LIMIT_SCALE` nhỏ)                                                                                                                                                                          |

**Rủi ro riêng:** khi trang chạy trên máy chủ Next và gọi API, địa chỉ IP mà API thấy là của máy chủ web, nên mọi khách chung ngưỡng 60 lượt mỗi phút cho đọc công khai. Cách xử lý: chuyển `X-Forwarded-For` của khách trong các lời gọi từ máy chủ (B4.1 làm cho đường `/api`; mục này làm cho lời gọi lúc dựng trang), hoặc đọc dữ liệu từ trình duyệt. Quyết định chốt trong `/tl-review plan` của B7.1, kèm bộ nhớ đệm đủ ngắn (vài chục giây) để tin vừa đóng không còn hiện.

#### B7.2 Danh mục (Admin)

- Màn hình: `/catalogs`, hai tab Phòng ban và Vị trí; bảng theo `CatalogListQueryDto` (tìm kiếm trên tên và mã; sắp xếp `name`, `code`, `createdAt`).
- Dialog thêm, sửa: tên (bắt buộc, tối đa 100), mã (`^[A-Za-z0-9_]{2,30}$`, hiển thị chữ hoa); trùng tên hoặc mã trả 409.
- Xóa qua `ConfirmDialog`; 409 "đang được sử dụng nên không thể xóa" hiện trong dialog.
- **Truy vấn tra cứu dùng chung** `useDepartmentOptions`, `usePositionOptions` (`GET /departments`, `GET /positions`, `limit=100`) cho mọi ô chọn của các module sau; chỉ vai trò có `department.list.view` và `position.list.view` gọi được (Phỏng vấn viên không).

#### B7.3 Người dùng (Admin, HR)

- Danh sách: lọc `role`, `departmentId`, `isActive`; tìm kiếm trên tên và email; sắp xếp `fullName`, `email`, `role`, `createdAt`; cột tên, email, vai trò, phòng ban, trạng thái (khóa hay hoạt động).
- Dialog: **tạo** (email, họ tên, vai trò, phòng ban, mật khẩu mạnh), **sửa** (họ tên, phòng ban), **đổi vai trò**, **khóa hoặc mở khóa**, **đặt lại mật khẩu**.
- Luật hiển thị: không ai tự đổi vai trò hay tự khóa chính mình (nút bị vô hiệu kèm lý do); HR không thấy lựa chọn vai trò Admin và không thao tác được trên tài khoản Admin (API trả 403, giao diện ẩn trước).
- Phiên của người bị khóa hay đổi vai trò mất hiệu lực ở lần gọi kế tiếp: 401 xử lý theo bảng 1.3.
- Test: bảng quyền theo vai trò, các ca tự khóa, HR với Admin.

#### B7.4 Yêu cầu tuyển dụng

- **Danh sách** `/requisitions`: lọc `status`, `departmentId`, `createdFrom`, `createdTo`; sắp xếp `code`, `title`, `quantity`, `status`, `createdAt`; cột mã, tiêu đề, phòng ban, vị trí, số lượng, trạng thái, ngày tạo. TBP chỉ thấy phòng mình (ngoài phạm vi trả 404).
- **Form toàn trang** `/requisitions/new` và sửa: tiêu đề (≤200), phòng ban (ẩn với TBP vì máy chủ luôn dùng phòng của họ), vị trí, số lượng (1 đến 1000), lý do (≤2000), ngày bắt đầu mong muốn, ngân sách tối thiểu và tối đa (≥0; tối đa không nhỏ hơn tối thiểu), có `UnsavedChangesGuard`. Hai nút: **Lưu nháp** và **Lưu và gửi duyệt**.
- **Chi tiết** `/requisitions/[id]`: thông tin, lý do từ chối **nổi bật ở đầu trang** khi bị từ chối, timeline từ `GET /requisitions/:id/history`, các tin sinh ra từ yêu cầu.
- **Hành động theo trạng thái và quyền** (hàm `actionsFor`):

| Trạng thái | Hành động           | Quyền                                                   | Ghi chú                                                                                                       |
| ---------- | ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Nháp       | Sửa, Xóa, Gửi duyệt | `requisition.item.update`, `.delete`, `.request.submit` | xóa qua xác nhận                                                                                              |
| Chờ duyệt  | Duyệt, Từ chối      | `requisition.request.approve`, `.reject`                | từ chối mở dialog lý do bắt buộc                                                                              |
| Từ chối    | Sửa, Gửi duyệt lại  | như trên                                                |                                                                                                               |
| Đã duyệt   | Tạo tin, Đóng       | `job.item.create`, `requisition.request.close`          | "Tạo tin" chuyển tới `/jobs/new?requisitionId=`; đóng qua xác nhận, ghi chú rằng sẽ tự đóng các tin liên quan |
| Đã đóng    | không có            |                                                         |                                                                                                               |

- 409 "vừa được xử lý bởi người khác": thông báo và nút **Tải lại**.

#### B7.5 Tin tuyển dụng

- **Danh sách** `/jobs`: lọc `status`, `departmentId`, `positionId`, `requisitionId`, `createdFrom`, `createdTo`; sắp xếp `title`, `status`, `quantity`, `createdAt`, `publishedAt`; cột có số hồ sơ (`applicationCount`).
- **Form** `/jobs/new?requisitionId=`: điền sẵn tiêu đề và số lượng từ yêu cầu, chỉ cho chọn yêu cầu đã duyệt; số lượng 1 đến 1000 và **tổng các tin còn sống không vượt số đã duyệt** (409 hiện ở trường số lượng); lương tối thiểu và tối đa (min ≤ max); địa điểm (≤200); mô tả (≤20000) bằng Tiptap tải lười `[G6]`, hiển thị lại luôn qua `sanitizeJobHtml`.
- **Chi tiết** `/jobs/[id]`: tab **Thông tin** và **Hồ sơ đã nộp** (bảng hồ sơ lọc theo `jobId`); hành động: Sửa (trừ tin đã đóng), Đăng (từ Nháp, xác nhận), Ngừng đăng (từ Đang tuyển, xác nhận; "cổng công khai sẽ trả trang không còn nhận hồ sơ"), Xóa (chỉ Nháp). Thông báo vì sao không đăng được khi yêu cầu không còn ở trạng thái Đã duyệt.

#### B7.6 Ứng viên

- **Danh sách** `/candidates`: lọc `source`, `createdFrom`, `createdTo`; tìm kiếm; cột họ tên, email, điện thoại, nguồn, có CV hay không. PV chỉ thấy ứng viên mình phỏng vấn.
- **Dialog** tạo và sửa: họ tên (≤100), email (≤150, chữ thường), điện thoại (VN), ngày sinh (hợp lệ, từ 16 tuổi), nguồn, ghi chú (≤2000). Email trùng trả 409 `Email ứng viên đã tồn tại`.
- **Chi tiết** `/candidates/[id]`: thông tin, **CV** (tải qua `/api/candidates/:id/cv` mở tab mới; tải lên và xóa với `candidate.cv.manage`, kiểm tra tệp ở trình duyệt), ghi chú, lịch sử ứng tuyển (liên kết sang hồ sơ).
- **Ẩn danh** (HR, Admin): `ConfirmDialog` nói rõ hậu quả không đảo ngược (xóa dữ liệu cá nhân và CV, giữ lại số liệu); 409 hiện nguyên văn khi còn hồ sơ đang xử lý hoặc đã nhận việc. Ứng viên đã ẩn danh hiện biểu ngữ "đã ẩn danh" và **mọi nút sửa bị ẩn** (API trả 409 nếu cố sửa).
- TBP **không có** màn Ứng viên (không có quyền); họ chỉ thấy thông tin liên hệ trong chi tiết hồ sơ (B7.7).

#### B7.7 Hồ sơ ứng tuyển

- **Danh sách** `/applications`: lọc `status`, `jobId`, `candidateId`, `assigneeId`, `departmentId`, `appliedFrom`, `appliedTo`; sắp xếp `appliedAt`, `status`, `candidateName`, `jobTitle`; cột ứng viên, tin, trạng thái (`StatusBadge`), ngày nộp, người phụ trách. Đích của các việc ở Tổng quan (`?status=NEW` chưa phân công, `?status=OFFER`).
- **Dialog tạo** (TD, Admin): chọn ứng viên, chọn tin **đang tuyển**, người phụ trách (`/users/options?purpose=ASSIGNEE`, mặc định người đang đăng nhập nếu là Tuyển dụng), ghi chú; trùng (đã nộp tin này) trả 409.
- **Chi tiết** `/applications/[id]` gồm bốn tab:
  1. **Tiến trình**: timeline lịch sử; các nút chuyển bậc **chỉ gồm các bậc có trong `APPLICATION_TRANSITIONS[status]`**; Từ chối (lý do bắt buộc) và Ứng viên rút (xác nhận) có ở mọi bậc đang xử lý; **không có nút Nhận việc** (chỉ đến qua offer). Nút Đề nghị bị vô hiệu kèm lý do khi chưa có vòng Đạt hoặc còn lịch chờ kết quả (tính từ `interviews` trong chi tiết; máy chủ vẫn kiểm tra lại).
  2. **Phỏng vấn**: danh sách vòng; nút **Đặt lịch** khi hồ sơ ở bậc Phỏng vấn, không còn lịch chờ kết quả, và người dùng có `interview.item.create`.
  3. **Offer**: chỉ mở khi hồ sơ ở bậc Đề nghị hoặc đã có offer; tạo, sửa (khi chờ phản hồi), ghi phản hồi (chấp nhận, từ chối); offer quá hạn thì ẩn Chấp nhận, chỉ còn Từ chối. **HR không có tab này** (không có `offer.item.view`).
  4. **Ghi chú**: `NotesSection`.
- **CV**: nút tải khi `hasCv` (đã gồm trường hợp rơi về CV ứng viên). TBP thấy tên, email, điện thoại, CV nhưng **tên không có liên kết sang `/candidates/:id`**.
- **Người phụ trách**: chọn lại qua `/users/options`.
- Test (đơn vị) cho `actionsFor` với từng trạng thái và vai trò; Playwright cho luồng sàng lọc → phỏng vấn → offer → nhận việc.

#### B7.8 Lịch phỏng vấn

- **Danh sách** `/interviews`: lọc `result` (PV vào đây với `PENDING` chọn sẵn), `interviewerId`, `applicationId`, `round`, `scheduledFrom`, `scheduledTo`; sắp xếp mặc định `scheduledAt` tăng dần; cột ứng viên, tin, vòng, giờ, người phỏng vấn, kết quả.
- **Dialog đặt hoặc sửa lịch** (TD, Admin): người phỏng vấn (`/users/options?purpose=INTERVIEWER`), ngày giờ (chuyển giờ địa phương sang ISO có `+07:00`; chặn quá khứ), vòng (mặc định kế tiếp). **409 trùng giờ trong 60 phút của người phỏng vấn hiện ngay trong dialog**, giữ nguyên form; 409 "hồ sơ đang có lịch chờ kết quả" tương tự.
- **Hủy lịch** qua xác nhận.
- **Chi tiết** `/interviews/[id]`: trên màn hình rộng hiện CV, tin và form kết quả cùng trang; **trên điện thoại chia ba tab theo thứ tự Kết quả (mặc định), CV, Tin**. Form kết quả: Đạt hoặc Không đạt (Không đạt bắt buộc nhận xét), chỉ hiện cho người được xếp lịch (`interviewer.id` trùng người đang đăng nhập) hoặc Admin; HR xem được mọi lịch nhưng chỉ có form ở lịch của mình (API trả 403 nếu cố ghi lịch người khác).
- Phạm vi: PV và TBP chỉ thấy lịch của mình (ngoài phạm vi trả 404).

#### B7.9 Tổng quan

- `GET /dashboard/overview?from&to&departmentId`; mặc định 30 ngày gần nhất; chọn kỳ; bộ lọc phòng ban ẩn với TBP (luôn phòng mình, API trả 403 nếu xin phòng khác).
- Năm thẻ số (yêu cầu chờ duyệt, tin đang tuyển, hồ sơ mới, phỏng vấn sắp tới, đã nhận việc trong kỳ), **phễu** năm bậc (cộng dồn "từng đạt bậc đó", không phải số đang ở bậc), kết quả từ chối và rút.
- **Hộp việc** (`todo`): mỗi việc là liên kết đến đúng danh sách đã lọc bằng `href` do API trả. Các loại việc theo vai trò: `REQUISITIONS_TO_APPROVE` (duyệt), `REQUISITIONS_TO_REVISE` và `DRAFT_REQUISITIONS` (sửa, gửi), `UNASSIGNED_APPLICATIONS`, `INTERVIEWS_TODAY`, `OFFERS_EXPIRING`. Danh sách rỗng hiển thị trạng thái "không có việc cần xử lý".
- Biểu đồ tải lười, dùng skill `dataviz`; màu theo thứ tự chuỗi của design guide.

#### B7.10 Báo cáo (Admin, HR)

- Ba tab: tiến độ yêu cầu, kết quả theo tin, nguồn ứng viên (`GET /reports/:type`, với `type` là `requisition-progress`, `job-results`, `candidate-sources`); lọc kỳ, phòng ban, vị trí; bảng theo `columns` và `rows` API trả.
- **Xuất CSV** (`/reports/:type/export`): tải về dưới dạng tệp, toast thành công; ghi chú rằng mỗi lần xuất được ghi vào nhật ký kiểm toán.

#### B7.11 Nhật ký kiểm toán (Admin)

- **Danh sách** `/audit-events`: lọc `event` (ô chọn dùng nhãn tiếng Việt từ `shared-types`), `entityType`, `entityId`, `actorId` (ô chọn người dùng), `origin`, `from`, `to`; tìm kiếm theo tên người thực hiện; sắp xếp theo thời gian (mới nhất trước).
- **Chi tiết sự kiện** (ngăn bên hoặc trang): nhãn, người thực hiện **như lúc đó** (tên, vai trò), đối tượng, nguồn, IP và user-agent, `data` của sự kiện; và **bảng thay đổi dòng** cùng giao dịch (`rowChanges`): thao tác I, U, D; U hiển thị từng cột `cũ → mới`, mật khẩu hiện `[REDACTED]`.
- **Xuất CSV** (`/audit-events/export`), có ghi chú về giới hạn 10.000 dòng; có dòng lưu ý "nhật ký chứa dữ liệu cá nhân, chỉ Admin được đọc".
- Test: giá trị dài hay chứa ký tự đặc biệt hiển thị an toàn (thoát HTML), diff cho từng loại thao tác.

#### B7.12 Hồ sơ cá nhân

- `GET /profile`; sửa họ tên; **đổi mật khẩu** (mật khẩu hiện tại, mật khẩu mới mạnh khác mật khẩu cũ; 400 "mật khẩu hiện tại không đúng" hiện ở ô tương ứng); thành công thì toast, phiên vẫn còn.

### B8 Hoàn thiện (cỡ M, cloud)

| Mã   | Nhiệm vụ                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| B8.1 | Rà soát khả năng truy cập toàn bộ (skill `design:accessibility-review`): bàn phím, focus, nhãn, tương phản, không dùng màu làm tín hiệu duy nhất |
| B8.2 | Đáp ứng điện thoại: cổng công khai và chi tiết lịch phỏng vấn kiểm tra ở chiều rộng nhỏ bằng Playwright                                          |
| B8.3 | Hiệu năng: khung chờ thay vì vòng quay ở mức trang, không dịch chuyển bố cục, tải lười biểu đồ và trình soạn thảo                                |
| B8.4 | Ranh giới lỗi và trang lỗi ở mọi nhóm đường dẫn                                                                                                  |
| B8.5 | Danh sách kiểm sản xuất của Next (`production-checklist`), biến môi trường, `TRUST_PROXY` đúng với số lớp thật                                   |
| B8.6 | Cập nhật `CLAUDE.md` (mục Current state, Known gaps), `docs/handoff.md`, UX (hai chỗ lệch ở B4)                                                  |
| B8.7 | Kiểm định Cổng B bằng `/gate-audit`, ghi `docs/gate-b-audit.md`                                                                                  |

## 3. Kịch bản Playwright

Chạy trên API và Postgres cục bộ (đã làm được ở cloud với `hiflow_local`). Mỗi kịch bản dựng dữ liệu bằng API (như `createFlow`), có tiền tố `E2E-` và tự dọn.

| #   | Kịch bản                                                                                                        | Vai trò     |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Đăng nhập thành công, sai mật khẩu, tài khoản khóa, chuyển về `next`                                            | tất cả      |
| 2   | Menu và trang đích đúng cho từng vai trò; mở trực tiếp trang không có quyền cho 403 hoặc 404 đúng               | 5 vai trò   |
| 3   | Ứng viên nộp qua cổng công khai: thành công, tệp sai, quá 5 MB, thiếu đồng ý, tin đã đóng                       | khách       |
| 4   | Yêu cầu: tạo, lưu nháp, gửi, bị từ chối với lý do, sửa, gửi lại, duyệt, tạo tin                                 | TBP, HR, TD |
| 5   | Hai người cùng duyệt: một thành công, một thấy thông báo "đã có thay đổi"                                       | HR, Admin   |
| 6   | Hồ sơ: sàng lọc → phỏng vấn (nút Đề nghị khóa kèm lý do) → đặt lịch → ghi kết quả → Đề nghị                     | TD, PV      |
| 7   | Đặt lịch trùng giờ hiện lỗi ngay trong dialog                                                                   | TD          |
| 8   | Offer: tạo, sửa, chấp nhận → hồ sơ Nhận việc; một ca từ chối → Ứng viên rút; một ca quá hạn không cho chấp nhận | TD          |
| 9   | Phạm vi: TBP không thấy hồ sơ phòng khác (404); PV chỉ thấy lịch của mình; HR không thấy tab Offer              | TBP, PV, HR |
| 10  | Ẩn danh ứng viên: bị chặn khi còn hồ sơ đang xử lý; thành công khi đã từ chối; nút sửa biến mất                 | HR          |
| 11  | Quản lý người dùng: tạo, đổi vai trò, khóa (phiên của họ hết hiệu lực), tự khóa bị chặn                         | Admin, HR   |
| 12  | Báo cáo và xuất CSV; nhật ký ghi sự kiện xuất                                                                   | HR, Admin   |
| 13  | Nhật ký kiểm toán: tìm một thao tác vừa làm, mở chi tiết, thấy thay đổi dòng                                    | Admin       |
| 14  | Điện thoại: chi tiết lịch phỏng vấn ba tab; form công khai dùng được ở màn hình hẹp                             | PV, khách   |

## 4. Lịch làm việc đề xuất

Cỡ so sánh, không phải cam kết. "Phiên" là một lượt làm việc liền mạch với một mục tiêu kiểm chứng được.

| Phiên | Nội dung                     | Ở đâu                                | Phụ thuộc           | Kết quả                                         |
| ----- | ---------------------------- | ------------------------------------ | ------------------- | ----------------------------------------------- |
| 1     | B0 trọn vẹn và B6.1 đến B6.6 | cloud                                | trả lời câu 2, 3, 4 | công cụ web, kiểu dùng chung, test xanh         |
| 2     | B1 đến B3                    | máy bạn (port) hoặc cloud (viết mới) | câu 1               | token, primitive, thư viện lõi                  |
| 3     | B4                           | cloud                                | B3                  | đăng nhập thật, khung, menu theo vai trò, proxy |
| 4     | B5                           | máy bạn hoặc cloud                   | B4                  | bộ component dùng chung và trang mẫu            |
| 5     | B7.1                         | cloud                                | B5, câu 6 và câu 5  | cổng công khai chạy trọn vẹn                    |
| 6     | B7.2, B7.3, B7.12            | cloud                                | B5                  | danh mục, người dùng, hồ sơ cá nhân             |
| 7     | B7.4, B7.5                   | cloud                                | 6                   | yêu cầu, tin                                    |
| 8     | B7.6, B7.7                   | cloud                                | 7                   | ứng viên, hồ sơ, offer                          |
| 9     | B7.8                         | cloud                                | 8                   | lịch phỏng vấn                                  |
| 10    | B7.9, B7.10, B7.11           | cloud                                | 9                   | tổng quan, báo cáo, nhật ký                     |
| 11    | B8 và Cổng B                 | cloud                                | 10                  | đóng Cổng B                                     |

**Trong hạn credit (đến 2026-11-05)** làm được phiên 1 mà không phụ thuộc câu 1. Phần còn lại cần các câu trả lời trên.

## 5. Điều kiện để bắt đầu mỗi mốc

- B0: bạn trả lời 8 câu (hoặc nói "theo đề xuất").
- B1 đến B5: xác nhận bản quyền dùng lại bộ cũ (chưa được ghi lại ở đâu, `docs/handoff.md` mục 3) và chọn nơi làm (câu 1).
- B7: B5 xong và Cổng của nó đạt.
- B8: mọi module xong; Cổng B chỉ đóng khi **toàn bộ** mục ở `web-plan.md` mục 7 có bằng chứng.

## 6. Việc cần cập nhật ngoài web

- `docs/ux/02-define.md` mục 3.1 và 3.2: đường dẫn `/audit-events`; HR và TBP có mục Lịch phỏng vấn; bỏ chú thích "chưa cài đặt" ở quyết định B.
- `docs/handoff.md`: trỏ đến tài liệu này.
- `CLAUDE.md`: mục "Next, in order" khi B0 xong.
- Khoảng trống API đã thấy khi lập kế hoạch: chưa có danh sách phòng ban công khai (bộ lọc phòng ban ở cổng công khai); phản hồi Swagger thành công chưa mô tả (B6 giải quyết bằng kiểu dùng chung).
