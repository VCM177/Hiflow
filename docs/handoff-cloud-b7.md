# Handoff: web giai đoạn B, B7.1 cổng công khai (phiên cloud)

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
