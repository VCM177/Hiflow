# Kế hoạch web giai đoạn B

Bản chi tiết từng nhiệm vụ nằm ở `docs/web-plan-detail.md`; hợp đồng API đầy đủ ở `docs/web-api-contract.md`. Viết ngày 2026-11-02, thay cho kế hoạch v2 đã mất (xem `docs/handoff.md` mục 5). Các câu ở mục 8 đã được chốt ngày 2026-11-04 (theo đề xuất), nên việc viết code web được phép bắt đầu. Mọi khẳng định về hiện trạng đã đối chiếu với repo ngày viết.

## 1. Đầu vào và hiện trạng

| Có sẵn                                                                                                                                  | Chưa có                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Backend xong: 16 module, gần 80 route, hợp đồng lỗi `{ statusCode, message }`, phân trang `{ items, meta }`, phiên bằng cookie HttpOnly | `apps/web` mới là scaffold của Next 16.3 (React 19, Tailwind 4): `layout.tsx`, `page.tsx`, `globals.css` |
| UX giai đoạn 1 và 2: hành trình, luồng, sitemap, ma trận vai trò × màn hình (`docs/ux/02-define.md`)                                    | Không có thư viện nào ngoài Next, React, Tailwind: chưa có test, chưa có kiểm tra kiểu riêng             |
| Design guide (`admin-design-guide`): token `--hf-*`, vai trò bán kính, trạng thái, bảng, form, dialog, truy cập                         | `docs/port-manifest.md` còn rỗng; bộ admin cũ **không nằm trong môi trường cloud** này                   |
| Prototype bấm được (artifact, 5 vai trò, sáng và tối)                                                                                   | Kiểu dữ liệu của API cho web (Swagger chỉ mô tả lỗi, không mô tả phản hồi thành công)                    |

Ràng buộc đã có trong `CLAUDE.md`: không port tính năng, logic, ảnh, test hay cấu hình; chỉ port tầng chung (`components/ui`, `layout`, `shared`, `lib`, `hooks`, `providers`) từng tệp một, ghi vào manifest; không bao giờ ghi tên nguồn vào repo; thêm phụ thuộc cùng commit với nơi dùng đầu tiên; **xong B5 mới được làm module**.

**Lưu ý của Next 16 (`apps/web/AGENTS.md`):** API khác dữ liệu huấn luyện. Mỗi mốc phải đọc tài liệu trong `node_modules/next/dist/docs/` trước khi viết. Đã xác nhận ngay trong kế hoạch này: `middleware` đổi tên thành `proxy.ts`, và cách chuyển tiếp tới backend là Route Handler hoặc `proxy.ts`.

## 2. Nguyên tắc

1. **Dọc trước, rộng sau.** Mốc B7 bắt đầu bằng một lát cắt dọc nhỏ nhất đi hết ngăn xếp (cổng công khai) để kiểm chứng hạ tầng thật, rồi mới làm các module quản trị.
2. **Hợp đồng là nguồn duy nhất.** Web không khai báo lại enum, quyền, bản đồ chuyển trạng thái; mọi thứ lấy từ `@hiflow/shared-types`.
3. **Một mốc, một thứ kiểm chứng được.** Mỗi mốc có định nghĩa xong (DoD) đo được, và đi qua `/tl-review` trước commit (tiêu chuẩn W-01 đến W-10).
4. **Trung thực về những gì chưa kiểm.** Giao diện chạy trên trình duyệt thật (Playwright có sẵn trong cloud) trước khi tuyên bố xong; không có người dùng thật nên giai đoạn UX 5 vẫn là việc sau.

## 3. Kiến trúc đề xuất

### 3.1 Cấu trúc thư mục

```
apps/web/src/
  app/
    (public)/careers/...          # cổng công khai, không đăng nhập
    (auth)/login/                 # đăng nhập
    (app)/...                     # khung quản trị: layout có menu, kiểm tra phiên
    api/[...path]/route.ts        # chuyển tiếp tới backend (mục 3.2)
    not-found.tsx, error.tsx
  components/ui/                  # primitive (nút, ô nhập, dialog, tab, tooltip, badge, skeleton...)
  components/layout/              # khung: sidebar, topbar, PageHeader
  components/shared/              # DataTable, FilterToolbar, StatusBadge, ConfirmDialog...
  features/<module>/              # api.ts, hooks.ts, schemas.ts, constants.ts, components/
  lib/                            # api client, định dạng vi-VN, validations, permissions
  hooks/  providers/  styles/tokens.css
```

`features/*` là viết mới cho Hiflow, không port. Quy tắc tl-review còn áp dụng: tối đa 8 prop mỗi component, một concern dùng `useReducer` thay nhiều `useState`, không dùng `useEffect` để phản chiếu state.

### 3.2 Phiên, chuyển tiếp và bảo vệ

- Trình duyệt chỉ nói chuyện với **chính origin của web** (`/api/*`). Route Handler `app/api/[...path]/route.ts` chuyển tiếp tới backend, **thêm header `x-hiflow-proxy-secret`** (backend trả 404 nếu thiếu khi `PROXY_SECRET` được đặt) và chuyển nguyên cookie và `Set-Cookie`. Bí mật chỉ nằm ở phía máy chủ của web, không có tiền tố `NEXT_PUBLIC_`; biến `NEXT_PUBLIC_API_BASE_URL` của `.env.example` hiện tại sẽ được thay bằng `API_ORIGIN` và `PROXY_SECRET` phía máy chủ.
- Cookie `hf_access_token` là HttpOnly, Secure, SameSite=Strict: chạy được vì web và `/api` cùng origin. **Web không bao giờ lưu hay đọc token.** Trạng thái phiên lấy từ `GET /auth/me` (trả người dùng và `permissions`).
- `proxy.ts` chỉ làm kiểm tra lạc quan (có cookie thì cho qua, không có thì chuyển tới `/login?next=`). Quyền thật luôn do backend quyết; 401 từ API đưa về đăng nhập, 403 hiện trang "không có quyền", 404 hiện trang "không tồn tại".
- Lưu ý môi trường: cookie `Secure` trên `http://localhost` chạy ở Chrome và Firefox nhưng **không chạy ở Safari**; phát triển dùng Chrome hoặc Firefox, hoặc `next dev --experimental-https`.
- 429 đọc `Retry-After` và báo thời gian chờ (đăng nhập, form công khai).

### 3.3 Dữ liệu và biểu mẫu

- Dữ liệu máy chủ qua một thư viện cache truy vấn (đề xuất TanStack Query); mỗi feature có `hooks.ts` bọc truy vấn và biến đổi, không gọi `fetch` trực tiếp trong component.
- Biểu mẫu: React Hook Form + Zod, quy tắc dùng lại nằm ở `lib/validations.ts`, khớp với DTO của API (mật khẩu mạnh, email chuẩn hóa chữ thường, độ dài). Biểu mẫu có dữ liệu truy vấn chỉ dựng sau khi dữ liệu có (`defaultValues`).
- Trạng thái danh sách (tìm kiếm, lọc, sắp xếp, trang) nằm trên URL để chia sẻ và giữ khi tải lại.
- Định dạng ngày, tiền theo vi-VN qua `formatDate`, `formatDateTime`, `formatCurrency`; không định dạng rời rạc trong component.
- Mô tả tin tuyển dụng là HTML do nhân viên soạn: **bắt buộc làm sạch trước khi hiển thị** (cổng công khai và trang chi tiết tin).

### 3.4 Kiểu dữ liệu của API

Đề xuất (xem câu 3 ở mục 8): chuyển các giao diện `*-view.ts` (9 tệp) vào `packages/shared-types`, API nhập từ đó, web dùng chung, với tiện ích kiểu `Jsonified<T>` cho trường `Date` (JSON trả chuỗi). Lợi ích: trình biên dịch bắt lệch giữa API và web, và hợp đồng thôi là "đọc file view". Nhãn tiếng Việt của trạng thái (hiện nằm trong `apps/api/.../*.constants.ts`) cũng chuyển sang `shared-types`, vì web cần đúng các nhãn đó cho `StatusBadge`.

## 4. Các mốc

Cỡ: S (dưới nửa ngày), M (khoảng một ngày), L (vài ngày). Chỉ là thứ tự độ lớn, không phải cam kết.

| Mốc                         | Nội dung                                                                                                                                                                                                                                                          | Cỡ      | Xong khi                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B0** Chuẩn bị             | Chốt các câu ở mục 8; đọc tài liệu Next 16 cho phần dùng; cấu hình web: `transpilePackages` cho `@hiflow/shared-types`, script `typecheck` và `test` (Vitest + Testing Library), Playwright, alias; cập nhật `.env.example`; điền hàng đầu của `port-manifest.md` | S       | `npm run lint`, `typecheck`, `test`, `build` đều chạy ở gốc repo; trang trống dựng được; quyết định đã ghi vào tài liệu                                        |
| **B1** Token                | `styles/tokens.css` (`--hf-*` theo design guide), ánh xạ vào Tailwind 4, phông, nền, bán kính theo vai trò, màu trạng thái và biểu đồ; trang xem mẫu token                                                                                                        | S       | Không còn mã hex, px lẻ nào ngoài file token; kiểm tra tương phản AA cho cặp chữ-nền                                                                           |
| **B2** Primitive            | Nút (kích thước, `icon-sm`), ô nhập, vùng văn bản, chọn, hộp kiểm, công tắc, dialog, tab, tooltip, popover/menu, badge, skeleton, toast, tách dòng                                                                                                                | M       | Mỗi primitive có trạng thái focus, vô hiệu, lỗi; thao tác bàn phím và nhãn đọc màn hình; test thành phần                                                       |
| **B3** Thư viện lõi         | API client (lỗi có kiểu, 401/403/429), định dạng vi-VN, `validations.ts`, `permissions.ts` (`useCan`, dùng `PERMISSIONS`), hằng số trạng thái → `{label, variant}`, truy vấn cache, `parseQuery` cho URL                                                          | M       | Test đơn vị cho client (mô phỏng 401/403/404/409/429), định dạng, quyền; không có chuỗi quyền viết cứng                                                        |
| **B4** Phiên và khung       | Route Handler chuyển tiếp, `proxy.ts`, đăng nhập (`?next=`), `SessionProvider`, khung (sidebar thu gọn, topbar, menu theo vai trò đúng ma trận UX 3.2, `PageHeader`), trang 403/404/lỗi, trang hồ sơ cá nhân tối thiểu                                            | M       | Đăng nhập, đăng xuất, đổi vai trò thấy đúng menu; truy cập trực tiếp trang không có quyền hiện đúng trang; Playwright chạy luồng đăng nhập thật với API cục bộ |
| **B5** Component dùng chung | `DataTable`, `FilterToolbar` (tìm kiếm debounce 300 ms), `ListPagination`, `PageSizeSelector`, `EmptyState`, `StatusBadge`, `SectionCard`, `VerticalTimeline`, `NotesSection`, `ConfirmDialog`, `UnsavedChangesGuard`, trường RHF dùng chung, `FormDialog`        | L       | Mỗi component có ba trạng thái (tải, rỗng, lỗi), bàn phím, test; một trang mẫu dùng đủ chúng với dữ liệu thật. **Cổng: xong B5 mới làm B7**                    |
| **B6** Backend nhỏ          | Đã xong: `GET /users/options`. Còn lại tùy câu 3 và 4 ở mục 8: chuyển view và nhãn sang `shared-types`                                                                                                                                                            | S đến M | Swagger và test API xanh; không còn bản sao kiểu                                                                                                               |
| **B7** Module               | Mục 5                                                                                                                                                                                                                                                             | L       | Mỗi module đạt DoD ở mục 6                                                                                                                                     |
| **B8** Hoàn thiện           | Rà soát khả năng truy cập (WCAG AA) toàn bộ, đáp ứng điện thoại, hiệu năng (khung chờ, tải lười biểu đồ và trình soạn thảo), ranh giới lỗi, metadata và JSON-LD cho tin, danh sách kiểm sản xuất, **kiểm định Cổng B** (`/gate-audit`)                            | M       | Cổng B đóng (mục 7)                                                                                                                                            |

## 5. Mốc B7: các module theo thứ tự

Thứ tự theo phụ thuộc dữ liệu và độ rủi ro. Bản bàn giao nói "mười một module"; đếm theo sitemap hiện tại (`docs/ux/02-define.md` mục 3.1) có **12 phần** gồm cổng công khai, nên kế hoạch dùng 12.

| #   | Module                                                                  | Phụ thuộc                      | Điểm cần chú ý                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Cổng công khai** (`/careers`, chi tiết, form, cảm ơn, 404 thân thiện) | B5 (form), không cần đăng nhập | Lát cắt dọc đầu tiên: tải CV 5 MB (PDF/DOCX), captcha Turnstile, đồng ý xử lý dữ liệu, 202 luôn cùng nội dung, 429, đường dẫn `/careers/<slug>-<id>`, làm sạch HTML, thiết kế cho điện thoại trước                                   |
| 2   | **Danh mục** (phòng ban, vị trí)                                        | B5                             | Admin quản trị; vai trò khác đọc ngầm cho ô chọn nên truy vấn tra cứu dùng chung (`useDepartments`, `usePositions`)                                                                                                                  |
| 3   | **Người dùng**                                                          | 2                              | Quy tắc khóa, đổi vai trò, không ai tự khóa hay đổi vai trò mình, HR không thao tác trên Admin; `GET /users/options` cho ô chọn                                                                                                      |
| 4   | **Yêu cầu tuyển dụng**                                                  | 2                              | Vòng đời đầy đủ, lý do từ chối nổi bật, timeline, 409 khi người khác xử lý trước; form toàn trang có bảo vệ rời trang                                                                                                                |
| 5   | **Tin tuyển dụng**                                                      | 4                              | Tạo từ yêu cầu đã duyệt (điền sẵn), kiểm tra tổng số lượng, đăng và ngừng đăng; trình soạn mô tả (câu 6)                                                                                                                             |
| 6   | **Ứng viên**                                                            | 2                              | CV riêng tư (tải qua đường có kiểm tra quyền), ẩn danh theo yêu cầu (HR, Admin), ứng viên đã ẩn danh chỉ đọc                                                                                                                         |
| 7   | **Hồ sơ ứng tuyển**                                                     | 5, 6                           | Nút chuyển bậc chỉ hiện bậc hợp lệ từ `APPLICATION_TRANSITIONS`, lý do từ chối bắt buộc, tab Tiến trình, Phỏng vấn, **Offer** (chỉ mở ở bậc Đề nghị), Ghi chú; CV rơi về CV ứng viên; Trưởng bộ phận không có liên kết sang ứng viên |
| 8   | **Lịch phỏng vấn**                                                      | 7                              | Dialog đặt lịch báo trùng 60 phút ngay tại chỗ, trang chi tiết ba tab trên điện thoại (Kết quả, CV, Tin), Phỏng vấn viên vào thẳng đây; phạm vi "chỉ lịch của mình" cho Trưởng bộ phận và Phỏng vấn viên                             |
| 9   | **Tổng quan**                                                           | 4 đến 8                        | Hộp việc cần xử lý: mỗi việc dẫn tới danh sách đã lọc sẵn (`href` do API trả), phễu cộng dồn, thẻ số liệu theo phạm vi phòng ban                                                                                                     |
| 10  | **Báo cáo**                                                             | 2                              | Ba báo cáo, lọc theo kỳ, xuất CSV (mỗi lần xuất được ghi nhật ký); biểu đồ tải lười, dùng skill `dataviz`                                                                                                                            |
| 11  | **Nhật ký kiểm toán** (Admin)                                           | 3                              | Danh sách có lọc, chi tiết sự kiện kèm thay đổi dòng, xuất CSV; nhãn tiếng Việt lấy từ `shared-types`. Sitemap UX còn ghi `/activity-log`, **cần đổi thành `/audit-events`**                                                         |
| 12  | **Hồ sơ cá nhân**                                                       | B4                             | Đổi tên, đổi mật khẩu (mật khẩu mạnh)                                                                                                                                                                                                |

Việc 1 làm đầu tiên cho mục đích kiểm chứng hạ tầng; các việc còn lại làm lần lượt, mỗi module một nhánh commit nhỏ theo lớp: kiểu, hằng số, schema, mapper, API, hook truy vấn, component.

## 6. Định nghĩa xong cho mỗi module

1. Tải, rỗng, lỗi có đủ; không còn bảng, badge, dialog tự dựng ngoài component chung.
2. Quyền lấy từ `PERMISSIONS`; mục bị ẩn hay vô hiệu hóa được chọn **một cách** và nhất quán, có lý do trong tooltip khi vô hiệu hóa.
3. Mọi `mutateAsync` nằm trong `try/catch`; lỗi theo quy tắc: toàn trang và hành động dòng dùng toast, dialog hiện lỗi cạnh nút xác nhận, lỗi tải trang hiện tại chỗ.
4. Thao tác phá hủy qua `ConfirmDialog`; từ chối và không đạt hỏi lý do API yêu cầu.
5. Test thành phần cho logic có điều kiện (nút theo trạng thái, quyền), và **một luồng Playwright** chạy qua API thật trên cơ sở dữ liệu cục bộ cho đường chính, gồm cả đường lỗi quan trọng (409, 403, 404).
6. Chữ tiếng Việt, định dạng vi-VN, bàn phím và focus kiểm tra, màu không là tín hiệu duy nhất.
7. Đi qua `/tl-review` (W-01 đến W-10) và danh sách kiểm thiết kế trước commit.

## 7. Cổng B (đề xuất)

Kiểm định bằng `/gate-audit` mở rộng, ghi vào `docs/gate-b-audit.md`, mỗi mục PASS/FAIL kèm bằng chứng:

- Phiên: không có token trong JS hay lưu trữ trình duyệt; cookie đúng thuộc tính; bí mật chuyển tiếp không lộ ra gói gửi tới trình duyệt.
- Quyền: với từng vai trò, menu đúng ma trận UX 3.2, và truy cập trực tiếp trang không có quyền cho 403 hoặc 404 đúng.
- Luồng trọn vẹn bằng Playwright: yêu cầu → duyệt → tin → ứng viên nộp qua cổng → sàng lọc → phỏng vấn → offer → nhận việc, và vết trong nhật ký kiểm toán.
- Cổng công khai: đạt mục "bảo vệ" của `business-flow.md` mục 6 ở phía giao diện (captcha, giới hạn, tệp sai định dạng).
- Khả năng truy cập AA (kiểm bằng công cụ và bằng tay cho luồng chính), không còn cảnh báo lint, `npm run build` sạch.
- Không có chuỗi quyền, trạng thái hay màu viết cứng; không còn bản sao kiểu của API.

## 8. Đã chốt

Ngày 2026-11-04 chủ dự án trả lời "theo đề xuất" cho cả 8 câu: cột Đề xuất dưới đây là quyết định đã chốt. Với câu 1, hướng là port ở máy chủ dự án (B1 đến B3 phần port, và B5), phần còn lại làm ở cloud.

| #   | Câu hỏi                                                                                                                         | Đề xuất                                                                                                                                                              | Hệ quả nếu khác                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | **Nguồn các primitive và component dùng chung.** Bộ admin cũ không có trong cloud, và không thể đưa vào repo (quy tắc cách ly). | **Chạy B1 đến B5 trên máy của bạn** (nơi có bộ cũ), mỗi tệp port một commit và ghi manifest. Phương án B: viết mới từ Radix + Tailwind ngay trong cloud, không port. | Phương án B nhanh hơn trong cloud nhưng bỏ phần bạn đã có; chỉ B0 và B7 làm được trong cloud nếu chọn port. |
| 2   | **Thư viện.**                                                                                                                   | TanStack Query (dữ liệu), React Hook Form + Zod (biểu mẫu), Radix UI (dialog, tab, tooltip, menu), một thư viện toast, Vitest + Testing Library, Playwright.         | Thêm hay bớt thư viện đổi B2 đến B5. Mỗi thư viện được thêm cùng commit dùng đầu tiên.                      |
| 3   | **Kiểu dữ liệu API cho web.**                                                                                                   | Chuyển 9 tệp `*-view.ts` vào `shared-types` + `Jsonified<T>` (mục 3.4).                                                                                              | Nếu giữ nguyên, web phải chép tay kiểu và sẽ lệch theo thời gian.                                           |
| 4   | **Nhãn trạng thái.**                                                                                                            | Chuyển các `*_LABEL` sang `shared-types`.                                                                                                                            | Nếu không, web nhân đôi nhãn, vi phạm "một nguồn duy nhất".                                                 |
| 5   | **Nơi triển khai và tên miền web.**                                                                                             | Web trên Vercel hoặc tương đương, API trên Cloud Run (đã có `PUBLIC_API_URL`); Route Handler chuyển tiếp thêm bí mật.                                                | Quyết định `API_ORIGIN`, `WEB_ORIGIN`, `TRUST_PROXY`; cần trước B8.                                         |
| 6   | **Trình soạn mô tả tin.** API lưu HTML.                                                                                         | Tiptap tải lười + làm sạch HTML ở cả hai đầu (cổng công khai chỉ hiển thị phần đã làm sạch).                                                                         | Nếu dùng ô văn bản thường thì nhập HTML tay: rẻ nhưng dở với người dùng.                                    |
| 7   | **Chế độ tối.** Prototype có sáng và tối, design guide chỉ định nghĩa một bộ token.                                             | **Ngoài phạm vi** giai đoạn B, thêm sau nếu báo cáo cần.                                                                                                             | Thêm tối nhân đôi kiểm tra tương phản ở mọi mốc.                                                            |
| 8   | **Thứ tự B7.**                                                                                                                  | Cổng công khai đầu tiên (mục 5).                                                                                                                                     | Nếu muốn quản trị trước, vẫn nên có ít nhất một lát cắt đi hết ngăn xếp sớm.                                |

## 9. Rủi ro đã biết

- **Môi trường cloud và ngân sách.** Credit cloud còn hạn đến 2026-11-05; kế hoạch này dài hơn thế. Việc làm được trong hạn mà không phụ thuộc quyết định 1: B0, B6 và phần kiểu.
- **Safari và cookie `Secure` trên localhost** (mục 3.2).
- **Mô tả tin là HTML của nhân viên:** quên làm sạch ở một chỗ là lỗ hổng. Dùng một hàm duy nhất và có test.
- **Số liệu UX là giả định** (persona dựng bằng nghiên cứu tại bàn, không có người dùng thật): kết quả giai đoạn B không thay thế kiểm thử người dùng (giai đoạn UX 5).
- **Quyết định UX 10 đến 19 mới được xác nhận một phần** (`business-flow.md` mục 7); giao diện bám theo chúng nên có thể phải sửa nếu người dùng đổi ý.
- **Next 16 khác dữ liệu quen thuộc:** mọi API Next phải đọc từ tài liệu đi kèm trước khi dùng, kể cả `proxy.ts`, Route Handler, biến môi trường và lưu đệm.
