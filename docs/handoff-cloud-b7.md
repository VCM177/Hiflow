# Handoff: web giai đoạn B, toàn bộ B7 (phiên cloud)

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

## Phiên 8: B7.6 và B7.7 (2026-11-06)

**B7.6 Ứng viên** (`features/candidates/`). `/candidates` (lọc nguồn, khoảng ngày tạo; tìm theo tên hoặc email; cột có CV; ứng viên đã ẩn danh có nhãn), hộp thoại tạo, `/candidates/[id]` (thông tin, CV, ghi chú, lịch sử ứng tuyển có liên kết sang hồ sơ). CV: tải bằng liên kết `/api/candidates/:id/cv` mở tab mới với `prefetch={false}` (nếu để Link prefetch thì mỗi lần hiện trang đã ghi một sự kiện tải CV); tải lên kiểm tra PDF/DOCX và 5 MB ở trình duyệt; xóa qua xác nhận. Sửa ghi chú dùng `NotesSection` (quyền `candidate.note.create`, API có endpoint riêng), nên hộp thoại sửa không có ô ghi chú. Ẩn danh (HR, Admin) có hộp thoại nói rõ hậu quả; 409 của API hiện nguyên văn trong hộp thoại. Ứng viên đã ẩn danh: biểu ngữ, ẩn mọi nút sửa, tải lên, xóa CV, ghi chú. Trưởng bộ phận không có trang; Phỏng vấn viên thấy danh sách (API tự giới hạn).

**B7.7 Hồ sơ ứng tuyển** (`features/applications/`). `/applications` (lọc trạng thái, phòng ban, người phụ trách, khoảng ngày nộp; đọc `?status=` từ địa chỉ nên các liên kết của Tổng quan dùng được), hộp thoại thêm hồ sơ (tìm ứng viên bằng ô gõ, chỉ tin đang tuyển, người phụ trách mặc định là Tuyển dụng đang đăng nhập, trùng thì 409 trong hộp thoại), `/applications/[id]` bốn tab:

- **Tiến trình**: nút chuyển bậc là `statusActionsFor` (đúng `APPLICATION_TRANSITIONS`, bỏ Nhận việc; Đề nghị khóa kèm lý do khi chưa có vòng Đạt hoặc còn vòng chờ; Từ chối cần lý do; Ứng viên rút cần xác nhận), timeline lịch sử.
- **Phỏng vấn**: các vòng và nút Đặt lịch (chỉ ở bậc Phỏng vấn, không còn vòng chờ, có `interview.item.create`). Hộp thoại đặt lịch nằm ở `features/interviews/` để B7.8 dùng lại (giờ nhập là giờ Việt Nam, gửi kèm `+07:00`, chặn quá khứ).
- **Offer**: chỉ hiện ở bậc Đề nghị hoặc khi đã có offer, và chỉ với ai có `offer.item.view` (HR không có). Tạo, sửa khi chờ phản hồi, ghi nhận chấp nhận (hồ sơ thành Nhận việc) hoặc từ chối (hồ sơ thành Ứng viên rút; hộp thoại nói rõ). Quá hạn thì ẩn Chấp nhận.
- **Ghi chú**: `NotesSection`.
  Nút tải CV theo `hasCv`; tên ứng viên chỉ là liên kết với ai có `candidate.list.view` (Trưởng bộ phận vẫn thấy tên, email, điện thoại, CV). Đổi người phụ trách qua hộp thoại. Thêm `useUserOptions` (`/users/options`, 100 người, không gọi nếu thiếu `user.options.view`) và `FilterSelect` đã dùng chung.

**Kiểm chứng.** `format:check`, `lint`, `typecheck`, `build` exit 0; `npm test` API 348, web 103 tệp. Playwright toàn bộ 45 test pass, thêm `candidates.spec.ts` (4) và `applications.spec.ts` (4): thêm ứng viên và email trùng, sửa, CV (sai định dạng bị chặn, tải lên, tải về, xóa), ghi chú, HR ẩn danh; thêm hồ sơ và trùng, Sàng lọc → Phỏng vấn → đặt lịch (giờ quá khứ bị từ chối) → Đề nghị bị khóa đến khi Phỏng vấn viên ghi Đạt (qua API, vì màn ghi kết quả thuộc B7.8) → tạo offer (lương 0 và hạn phản hồi sau ngày nhận việc bị chặn) → chấp nhận → Nhận việc; hồ sơ B: HR không có tab Offer, Trưởng bộ phận không có liên kết sang ứng viên, ứng viên từ chối → Ứng viên rút; lọc danh sách; ẩn danh ứng viên A bị chặn (đã nhận việc), B thì được.

**Dữ liệu spec để lại.** Hồ sơ đã chuyển bậc, tin đã đăng và yêu cầu đã duyệt không xóa được qua API: mỗi lần chạy `applications.spec.ts` còn lại một yêu cầu đã duyệt, một tin, hai hồ sơ và hai ứng viên tên `E2E-...` (B đã ẩn danh). `candidates.spec.ts` để lại một ứng viên đã ẩn danh. Xóa bằng role owner nếu cần DB sạch.

**Chưa làm / cần xác nhận.**

- Màn ghi kết quả phỏng vấn, sửa và hủy lịch, danh sách và chi tiết lịch phỏng vấn: B7.8. Trong tab Phỏng vấn của hồ sơ hiện chỉ có xem và đặt lịch.
- Hộp thoại thêm hồ sơ chỉ tìm tối đa 20 ứng viên mỗi lần gõ; chưa có nút "Thêm hồ sơ" ngay trên trang ứng viên (hộp thoại đã nhận `candidateId` sẵn).
- Phiên kế tiếp theo kế hoạch: B7.8 (Lịch phỏng vấn), rồi B7.9 đến B7.11 (Tổng quan, Báo cáo, Nhật ký kiểm toán).

## Phiên 9: B7.8 (2026-11-06)

**Lịch phỏng vấn** (`features/interviews/`). `/interviews`: lọc kết quả, vòng, người phỏng vấn, khoảng ngày phỏng vấn; tìm theo ứng viên hoặc tin; mặc định sớm nhất trước (`sortDir=asc`); đọc `?result=PENDING` từ địa chỉ (trang đích của Phỏng vấn viên). `/interviews/[id]`: lịch, kết quả, CV và liên hệ, tin.

- **Sửa lịch / Hủy lịch**: chỉ khi chờ kết quả và có `interview.item.update` / `.cancel` (Tuyển dụng, Admin). Hộp thoại sửa dùng chung `ScheduleDialog` với hộp thoại đặt lịch của hồ sơ, mở sẵn đúng giờ hiện tại (đổi sang giờ Việt Nam bằng `toVietnamLocal`). 409 trùng giờ trong 60 phút và "vòng đã có lịch" hiện trong hộp thoại, form giữ nguyên; giờ quá khứ bị chặn ở form bằng đúng câu của API.
- **Ghi kết quả**: form chỉ hiện khi chờ kết quả, có `interview.result.record` và là người được xếp lịch hoặc Admin. Không đạt bắt buộc nhận xét. Sau khi form hợp lệ có một hộp xác nhận ("không thể thay đổi sau khi ghi"); 409 vì người khác ghi trước hiện trong hộp kèm nút Tải lại. HR xem được mọi lịch nhưng với lịch của người khác chỉ thấy câu giải thích, không có form.
- **Bố cục**: màn hình rộng (≥1024px) hiện kết quả bên trái, CV và tin bên phải; hẹp hơn thì ba tab Kết quả (mặc định), CV, Tin. Chọn bằng `useMediaQuery` (`useSyncExternalStore`), nên chỉ một bố cục được dựng và không có id trùng.
- **Tab Tin**: Phỏng vấn viên không có `job.list.view` nên không đọc được mô tả tin; họ thấy tên tin, trạng thái hồ sơ và một dòng giải thích. Các vai trò khác thấy mô tả (qua `sanitizeJobHtml`). Nếu muốn Phỏng vấn viên đọc mô tả thì cần quyền mới ở API (chưa làm, chưa hỏi chủ dự án).
- Tab Phỏng vấn trong chi tiết hồ sơ giờ có liên kết sang từng vòng.
- Phạm vi: Phỏng vấn viên và Trưởng bộ phận chỉ thấy lịch của mình, lịch khác trả 404 và trang hiện "Không tìm thấy trang".

**Kiểm chứng.** `format:check`, `lint`, `typecheck`, `build` exit 0; `npm test` API 348, web 107 tệp. Playwright toàn bộ 50 test pass (thêm `interviews.spec.ts`, 5 test): Phỏng vấn viên vào danh sách chờ kết quả chỉ thấy lịch của mình, lịch của HR trả 404, ghi Không đạt (cần nhận xét, có xác nhận) và hồ sơ vẫn bị khóa ở Đề nghị; Tuyển dụng sửa lịch gặp trùng giờ và giờ quá khứ trong hộp thoại, đổi giờ thành công, hủy lịch rồi đặt lại được; HR không có form ở lịch người khác và có form ở lịch của mình; điện thoại 390px có ba tab; TBP không thấy lịch của người khác.

**Đã sửa trong spec cũ.** `applications.spec.ts` chọn khung giờ phỏng vấn trong khoảng quá nhỏ (vài chục ngày × vài giờ), và lịch phỏng vấn đã có kết quả không xóa được, nên các lần chạy lặp lại sớm muộn trùng nhau (409) và test hỏng chập chờn. Cả hai spec giờ dùng `randomFutureHour()` (ngẫu nhiên trong vài năm). Quy tắc chung: mọi spec đặt lịch phải dùng hàm này.

**Dữ liệu spec để lại.** Mỗi lần chạy `interviews.spec.ts` còn một yêu cầu đã duyệt, một tin, ba hồ sơ, ba ứng viên và bốn lịch phỏng vấn (một đã hủy, một Không đạt) tên `E2E-...`. Xóa bằng role owner nếu cần DB sạch.

**Chưa làm / cần xác nhận.**

- Danh sách lịch chưa có thao tác ngay trên dòng (sửa, hủy); mọi thao tác ở trang chi tiết.
- Chưa lọc theo `applicationId` bằng giao diện (API nhận, địa chỉ `?applicationId=` có tác dụng).
- Phiên kế tiếp theo kế hoạch: B7.9 đến B7.11 (Tổng quan, Báo cáo, Nhật ký kiểm toán).

## Phiên 10: B7.9, B7.10, B7.11 (2026-11-06) - B7 xong

**B7.9 Tổng quan** (`/`, `features/dashboard/`). Chọn kỳ bằng hai ô ngày (mặc định 30 ngày gần nhất do API chọn, nút "Về 30 ngày gần nhất" khi đã lọc), lọc phòng ban (ẩn với Trưởng bộ phận). Năm thẻ số; phễu năm bậc cộng dồn; kết quả từ chối và rút; hộp việc theo `todo` của API (mỗi dòng là liên kết `href`, chỉ liên kết khi bắt đầu bằng `/` và không phải `//`); danh sách rỗng hiện "Không có việc cần xử lý."; kỳ không hợp lệ (quá 366 ngày) báo tại chỗ, bộ lọc vẫn còn.

- Theo skill `dataviz`: phễu là các bậc có thứ tự của một đại lượng nên dùng **một màu** (primary) và thanh ngang cùng đường gốc, cao 20px, bo 4px ở đầu dữ liệu, giá trị ở đầu thanh, tooltip và `aria-label` nói rõ số hồ sơ và % so với bậc đầu, có nút "Xem dạng bảng". Hai con số từ chối/rút không vẽ biểu đồ mà là số liệu. Không dùng thư viện biểu đồ nên không có gì để tải lười (kế hoạch ghi tải lười); nếu sau này thêm biểu đồ theo thời gian thì tải lười khi đó. Không chạy `validate_palette` vì chỉ có một màu đã đạt tương phản ở `tokens.test.ts`.
- Nhãn việc cần làm do API quyết định theo quyền: HR thấy "Yêu cầu tuyển dụng chờ duyệt", Tuyển dụng thấy "Hồ sơ mới chưa có người phụ trách".

**B7.10 Báo cáo** (`/reports/[type]`, `features/reports/`). Ba tab là ba địa chỉ (`/reports` chuyển về tiến độ yêu cầu); bảng vẽ đúng `columns` và `rows` của API (cột đầu căn trái, các cột số căn phải); lọc kỳ, phòng ban, vị trí; tab mới giữ nguyên bộ lọc. **Xuất CSV** qua `lib/api/download.ts` (`downloadFile`: fetch, blob, thẻ `<a download>`, tên tệp theo `Content-Disposition`, lỗi thành `ApiError`), toast "Đã tải ...", ghi chú rằng mỗi lần xuất vào nhật ký kiểm toán. Chỉ Admin và HR; vai trò khác thấy "Không có quyền truy cập", loại báo cáo lạ trả 404.

**B7.11 Nhật ký kiểm toán** (`/audit-events`, `/audit-events/[id]`, `features/audit/`). Lọc sự kiện (nhãn tiếng Việt từ `AUDIT_EVENTS`), đối tượng, người thực hiện (100 người đầu theo tên), nguồn, khoảng ngày, và `entityId`/`event` từ địa chỉ; tìm theo tên người thực hiện; mới nhất trước. Chi tiết: người thực hiện như lúc đó, nguồn, IP, trình duyệt, dữ liệu sự kiện, và các thay đổi dòng cùng giao dịch (Thêm dòng/Sửa dòng/Xóa dòng; sửa hiện `cũ → mới`; `[REDACTED]` giữ nguyên). Mọi giá trị là văn bản: có test và Playwright với tên ứng viên chứa `<b>` và `<img onerror>`. Xuất CSV theo bộ lọc hiện tại, có dòng "chứa dữ liệu cá nhân, chỉ Admin được đọc" và giới hạn 10.000 dòng.

**Hai lỗi thật tìm ra khi chạy trình duyệt, đã sửa ở `useListParams`:**

- Hai thay đổi liên tiếp trước khi URL kịp cập nhật (điền hai ô ngày) làm thay đổi sau xóa thay đổi trước, vì cùng dựa trên `params` cũ. Giờ thay đổi sau xây tiếp trên thay đổi trước (`pending`) cho đến khi URL đổi.
- Danh sách không có phân trang (Tổng quan, Báo cáo) bị thêm `page=1` vào địa chỉ. Giờ chỉ đặt lại trang khi schema có `page`.
- Thêm `queryString()` để liên kết mang bộ lọc sang trang khác (tab báo cáo) mà không đọc `window.location`.

**Kiểm chứng.** `format:check`, `lint`, `typecheck`, `build` exit 0; `npm test` API 348, web 114 tệp. Playwright toàn bộ 59 test pass (thêm `overview-reports-audit.spec.ts`, 9 test). Không đổi API trong phiên này.

**Dữ liệu spec để lại.** Một yêu cầu đã duyệt và một tin đã đăng tên `E2E-Tin tong quan ...` mỗi lần chạy (hồ sơ và ứng viên được xóa ở cuối). Sự kiện nhật ký do các spec tạo ra không xóa được qua API.

**Chưa làm / cần xác nhận.**

- Bộ lọc người thực hiện của nhật ký chỉ liệt kê 100 người đầu; nếu hệ thống đông hơn cần ô tìm kiếm.
- Chưa có biểu đồ theo thời gian ở Tổng quan (API chỉ trả phễu).
- B7 đã xong. Còn B8 (hoàn thiện): rà soát truy cập (`design:accessibility-review`), điện thoại, hiệu năng, ranh giới lỗi, danh sách kiểm sản xuất, cập nhật `CLAUDE.md` và `docs/handoff.md`, kiểm định Cổng B.
