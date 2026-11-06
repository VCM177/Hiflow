# Handoff: web giai đoạn B, B7.1 đến B7.5 và B7.12 (phiên cloud)

Viết ngày 2026-11-06. Thay cho mục "B7" trong `docs/handoff-local-web-3.md` về trạng thái.

## Đã xong (B7.1)

- `/careers` (danh sách, tìm kiếm, sắp xếp, phân trang bằng liên kết, không cần JS), `/careers/[slugId]` (chi tiết, form nộp hồ sơ, JSON-LD `JobPosting`), `/careers/[slugId]/thanks` (nội dung cố định), `careers/not-found.tsx` (một trang 404 cho tin nháp, đã đóng, không tồn tại, kèm 5 tin đang mở).
- Slug sai hoặc cũ chuyển vĩnh viễn (308) về địa chỉ chuẩn `<slug>-<uuid>`.
- Mô tả tin đi qua một hàm duy nhất `sanitizeJobHtml` (`sanitize-html`, danh sách tag cho phép). **API chưa làm sạch mô tả** (đã thử: `<script>` được lưu nguyên), nên đầu web là lớp bảo vệ duy nhất hiện nay; thêm lớp ở API khi làm B7.5.
- Quyết định về giới hạn tốc độ: các trang gọi API từ máy chủ Next, chuyển `X-Forwarded-For` của khách (`src/server/forwarded-for.ts`), không dùng bộ nhớ đệm (`cache: 'no-store'`) nên tin vừa đóng biến mất ở lần xem kế tiếp. Cần `TRUST_PROXY` của API đúng số lớp khi triển khai.
- Form: RHF + Zod (`application-schema.ts`), kiểm tra CV ở trình duyệt (PDF/DOCX, 5 MB), Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`; không đặt thì không hiện, API không có secret thì bỏ qua), ánh xạ lỗi theo `application-error.ts` (400 nhắc CV → ô CV, 413 → ô CV, 429 → đếm ngược, 404 → thông báo đã đóng, 5xx → "tạm thời không khả dụng").
- Hằng số cần chủ dự án xác nhận: `EXPECTED_RESPONSE_TIME` ("trong vòng 5 ngày làm việc") và `CONSENT_LABEL` ở `features/careers/constants.ts`; `ORGANIZATION_NAME` ở `job-posting-json-ld.ts`.

## Kiểm chứng (2026-11-06, Postgres cục bộ, API `THROTTLE_LIMIT_SCALE=100`)

`format:check`, `lint`, `typecheck`, `build` đều exit 0; `npm test` API 344, web 83 tệp. Playwright `careers.spec.ts` 8 test pass: danh sách + tìm + trang không có script/`onerror`, slug cũ chuyển hướng, nộp thành công, tệp sai định dạng, tệp quá 5 MB, thiếu đồng ý, 429 (giả lập bằng `page.route`, không dùng ngưỡng thật), tin đã dừng/id lạ/địa chỉ sai cùng một trang 404 với mã 404.

Dọn dẹp của spec: xóa hồ sơ và ứng viên `e2e-careers-*`; tin đã đăng và yêu cầu đã duyệt không xóa được qua API (chỉ xóa được bản nháp), nên được dừng/đóng và còn lại với tiêu đề `E2E-Ke toan <run>`. Xóa bằng role owner nếu cần DB sạch.

## Chưa làm

- Danh sách chưa có bộ lọc phòng ban (API công khai không trả danh sách phòng ban; vẫn là khoảng trống đã biết).
- Spec Playwright chưa chạy ở chế độ có Turnstile thật; khóa kiểm thử của Cloudflare (`1x00000000000000000000AA`) luôn qua.
- Chưa kiểm tra trên điện thoại thật (bố cục một cột, `max-w-3xl`).
- B7.2 trở đi (Danh mục đã có trang mẫu B5; còn Người dùng, Hồ sơ cá nhân, Yêu cầu, Tin, Ứng viên, Hồ sơ ứng tuyển, Lịch phỏng vấn, Tổng quan, Báo cáo, Nhật ký). Theo `docs/web-plan-detail.md` mục 4, phiên 6 là B7.2, B7.3, B7.12.

## Phiên 6: B7.2, B7.3, B7.12 (2026-11-06)

**B7.2 Danh mục.** Trang đã có từ B5; thêm truy vấn tra cứu dùng chung `useDepartmentOptions` và `usePositionOptions` (`features/catalogs/options.ts`): `limit=100`, giữ 5 phút, **không gọi API** nếu vai trò thiếu `department.list.view` hoặc `position.list.view` (Phỏng vấn viên). `usePositionOptions` chưa có nơi dùng; B7.4 dùng.

**B7.3 Người dùng** (`/users`, `features/users/`). Lọc vai trò, phòng ban, trạng thái; tìm theo tên và email; sắp xếp 4 cột; tạo, sửa, đổi vai trò, khóa/mở khóa (qua `ConfirmDialog`), đặt lại mật khẩu. Luật hiển thị gom ở `user-rules.ts`: không ai tự đổi vai trò hay tự khóa (nút khóa kèm lý do), HR không thấy nút nào trên tài khoản Admin và không có lựa chọn vai trò Admin. Phòng ban "không thuộc phòng ban nào" dùng giá trị chọn `none` (`NO_DEPARTMENT`), gửi `null` khi sửa và bỏ trường khi tạo.

**B7.12 Hồ sơ cá nhân** (`/profile`, `features/profile/`). Sửa họ tên (cập nhật luôn tên ở thanh trên qua cache phiên), đổi mật khẩu: "mật khẩu hiện tại không đúng" hiện ở ô hiện tại và đưa focus về đó, mọi 400 khác hiện ở ô mật khẩu mới; mật khẩu mới trùng mật khẩu cũ bị chặn ở form. Thanh trên có mục "Hồ sơ cá nhân" (mục đầu của menu tài khoản; test bàn phím của thanh trên đã đổi theo).

**Kiểm chứng.** `format:check`, `lint`, `typecheck`, `build` exit 0; `npm test` web 89 tệp, API 344 test. Playwright toàn bộ 32 test pass (session, catalogs, careers, users): `users.spec.ts` kiểm tra Admin sửa, đổi vai trò, khóa, mở khóa; không ai tự đổi vai trò hay tự khóa; HR với tài khoản Admin; recruiter không có trang; hồ sơ cá nhân đổi tên và mật khẩu rồi đăng nhập bằng mật khẩu mới ở trình duyệt khác.

**Dữ liệu spec để lại.** API không xóa được tài khoản, nên `users.spec.ts` sở hữu đúng một tài khoản `e2e-users@example.com`: tạo nếu thiếu, đưa về trạng thái biết trước đầu mỗi lần chạy, và **khóa** sau khi chạy (nên chạy lại không sinh thêm tài khoản). Xóa bằng role owner nếu cần DB sạch.

**Chưa làm / cần xác nhận.**

- Đổi vai trò hay khóa người khác: giao diện chưa báo trước "người đó mất quyền ở lần gọi kế tiếp" ngoài câu trong hộp thoại; phía người bị tác động chỉ nhận 401 theo bảng 1.3.
- Danh sách người dùng chưa lọc theo nhiều vai trò cùng lúc (API chỉ nhận một).
- B7.4 trở đi chưa làm; phiên kế tiếp theo kế hoạch là B7.4, B7.5 (yêu cầu, tin tuyển dụng; B7.5 cần trình soạn mô tả Tiptap và làm sạch ở API).

## Phiên 7: B7.4 và B7.5 (2026-11-06)

**B7.4 Yêu cầu tuyển dụng** (`features/requisitions/`). `/requisitions` (lọc trạng thái, phòng ban, khoảng ngày tạo trong hộp "Lọc theo ngày tạo"; tìm theo mã hoặc tiêu đề; 5 cột sắp xếp), `/requisitions/new`, `/requisitions/[id]`, `/requisitions/[id]/edit`. Hành động theo trạng thái nằm ở `actionsFor` (`constants.ts`, có test đối chiếu với `REQUISITION_TRANSITIONS`), quyền ở `REQUISITION_ACTION_PERMISSION`. Form toàn trang có `UnsavedChangesGuard`, hai nút Lưu nháp (khi sửa: Lưu thay đổi) và Lưu và gửi duyệt; nếu lưu được nhưng gửi duyệt lỗi thì toast báo rõ và vẫn mở bản ghi đã lưu. Trưởng bộ phận không thấy ô phòng ban. Lý do từ chối nổi bật ở đầu trang chi tiết, timeline mới nhất trước, danh sách tin sinh ra từ yêu cầu (chỉ khi có `job.list.view`). Phòng ban của yêu cầu không sửa được (API không nhận), nên form sửa chỉ hiển thị.

**B7.5 Tin tuyển dụng** (`features/jobs/`). `/jobs` (lọc trạng thái, phòng ban, vị trí, ngày tạo; cột số hồ sơ), `/jobs/new?requisitionId=`, `/jobs/[id]` (tab Thông tin và Hồ sơ đã nộp), `/jobs/[id]/edit` (tin đã đóng không sửa). Chọn yêu cầu khác trong form tạo thì điền lại tiêu đề và số lượng, trừ khi người dùng đã tự đổi. 409 "vượt quá số lượng đã duyệt" hiện ở ô số lượng và đưa focus về đó. Mô tả soạn bằng Tiptap (`components/shared/rich-text-editor.tsx`, tải lười bằng `next/dynamic`), chỉ có các thẻ trong `JOB_HTML_ALLOWED_TAGS`; hiển thị lại luôn qua `sanitizeJobHtml` (đã chuyển sang `lib/sanitize-job-html.ts`). Nút trên thanh công cụ "Tiêu đề mục" (không phải "Tiêu đề") để không trùng nhãn ô tiêu đề.

**Thay đổi ở API** (phát hiện khi chạy thật):

- Chính sách làm sạch mô tả nằm ở `shared-types` (`job-html.ts`); API làm sạch khi lưu (`sanitizeJobHtmlTransform` trên `description` của `CreateJobDto`), có unit test và e2e. `sanitize-html` ghim 2.13.1 ở cả hai ứng dụng (bản mới kéo `htmlparser2` chỉ có ESM, Jest và Node 20 không `require` được).
- `PATCH /requisitions/:id` trả 500 khi gửi `expectedStartDate: null`; đã sửa, và e2e kiểm tra `null` xóa được lý do, ngày bắt đầu, ngân sách (yêu cầu) và lương, địa điểm, mô tả (tin).

**Kiểm chứng.** `format:check`, `lint`, `typecheck`, `build` exit 0; `npm test` API 348, web 97 tệp. Playwright toàn bộ 37 test pass, gồm `requisitions-jobs.spec.ts` (5 test): TBP tạo và gửi, HR từ chối cần lý do, TBP sửa và gửi lại, HR duyệt, lịch sử đủ hai quyết định; TD tạo tin (số lượng quá lớn bị từ chối ở ô số lượng), tin nháp chưa công khai, đăng thì cổng công khai hiện mô tả in đậm, ngừng đăng thì cổng trả 404, HR đóng yêu cầu; xóa bản nháp qua xác nhận; recruiter không tạo được yêu cầu, interviewer không có trang tin. e2e API đầy đủ: 652 pass, 1 hỏng là `throttle-redis` (không tới được Redis, mục SKIPPED còn mở của Cổng A).

**Dữ liệu spec để lại.** Tin đã đăng và yêu cầu đã duyệt không xóa được qua API (chỉ xóa được bản nháp), nên mỗi lần chạy `requisitions-jobs.spec.ts` còn lại một yêu cầu đã đóng và một tin đã đóng tiêu đề `E2E-Yeu cau <mã>` / `E2E-Tin <mã>`. Xóa bằng role owner nếu cần DB sạch.

**Chưa làm / cần xác nhận.**

- Tab Hồ sơ đã nộp của tin chưa có liên kết sang chi tiết hồ sơ (trang đó thuộc B7.7).
- Danh sách chưa lọc nhiều trạng thái cùng lúc (API nhận một).
- Chưa thử Tiptap trên điện thoại thật; thanh công cụ xuống dòng khi hẹp.
- Phiên kế tiếp theo kế hoạch: B7.6, B7.7 (Ứng viên, Hồ sơ ứng tuyển, Offer).
