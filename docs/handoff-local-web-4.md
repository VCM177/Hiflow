# Handoff: web và cổng B, phiên máy local (tiếp theo)

Viết ngày 2026-11-07. Dành cho phiên local làm tiếp. Đọc hết trước khi chạy lệnh nào. Thay cho `docs/handoff-local-web-3.md` về trạng thái; `docs/handoff-cloud-b7.md` ghi chi tiết từng module.

## 0. Trạng thái khi bàn giao

- Nhánh `claude/admiring-pasteur-lv1m6o`, commit `635b8f8`, đã push, cây làm việc sạch. Chưa merge vào `develop` hay `main` (cần người dùng xác nhận).
- Web đã xong toàn bộ B7 và B8 trừ hai việc cần máy này (xem mục 2 và 3). Cổng B còn đúng một mục OPEN (B-5.3); Cổng A còn `throttle-redis`.
- Đã kiểm ở cloud: unit API 348 đạt; unit web 118 tệp đạt; `format:check`, `lint` (0 cảnh báo), `typecheck`, `build` đều thoát 0; Playwright web 77 đạt và 2 bỏ qua (captcha, cần `E2E_TURNSTILE`); e2e API 652/653, ca hỏng là `throttle-redis`.

## 1. Việc 1: Cổng A, `throttle-redis` (làm ở máy này)

Đây là mục duy nhất của Cổng A còn SKIPPED. Cloud không kết nối được Redis (cổng TCP 6379 bị chặn qua proxy), còn máy này có mạng tới Upstash.

1. Đảm bảo không có e2e nào khác đang chạy.
2. Chạy và đọc mã thoát thật:

   ```bash
   npm run test:e2e -w @hiflow/api -- throttle-redis --verbose
   ```

3. Nếu đạt: cập nhật mục 1.3 trong `docs/gate-a-audit.md` bằng lệnh, mã thoát và số test; đổi kết luận sang "CỔNG ĐÃ ĐÓNG" (19 PASS); sửa đoạn "Current state" trong `CLAUDE.md` (đang ghi cổng A còn open). Commit và push.
4. Nếu hỏng: ghi nguyên văn đoạn lỗi cuối log, không đánh PASS, và báo lại trước khi sửa gì.

## 2. Việc 2: Cổng B, mục B-5.3 (kiểm tay với trình đọc màn hình)

Đây là mục OPEN duy nhất của Cổng B. Đã có tự động hóa (axe, bàn phím) nhưng không thay được một người nghe trình đọc màn hình.

Kịch bản tối thiểu, với NVDA (Windows) hoặc VoiceOver (macOS):

1. Đăng nhập `recruiter@hiflow.local`, chỉ dùng bàn phím. Mọi ô có nhãn được đọc đúng; lỗi hiện ra được đọc.
2. `/candidates`, nút "Thêm ứng viên": hộp thoại được đọc tên; focus vào ô đầu; Escape đóng và focus về nút đã mở.
3. `/jobs/new` (hoặc từ một yêu cầu đã duyệt): trình soạn mô tả có tên "Mô tả công việc", thanh công cụ có nhãn; các nút định dạng đọc được trạng thái nhấn.
4. `/applications/[id]`: tab Tiến trình; nút chuyển bậc bị khóa đọc được lý do.
5. `/careers/[slugId]` (chưa đăng nhập): form nộp hồ sơ; lỗi được đọc tại ô tương ứng.
6. `/interviews/[id]` ở cửa sổ hẹp (dưới 1024px): ba tab được đọc đúng thứ tự.

Ghi kết quả vào `docs/gate-b-audit.md`, mục B-5.3: đạt, hoặc liệt kê từng điểm đọc sai. Nếu không còn lỗi thì đổi kết luận cổng B. Nếu có lỗi: sửa theo quy trình (test trước, chạy lại, không đánh PASS khi chưa chạy lại).

## 3. Việc 3: quyết định còn chờ người dùng

- **B8.5, `TRUST_PROXY`.** Phải đặt đúng số lớp proxy giữa khách và API khi triển khai thật (web gọi thẳng API thì là 1; có CDN hay bộ cân bằng tải thì cộng thêm). Không kiểm được ở cloud. Hỏi người dùng topology thật trước khi đặt.
- **B8.3, khung chờ `/careers`.** Đã gỡ `app/careers/loading.tsx` vì nó làm trang trả 200 thay vì 404 và làm form hiện trước khi React gắn xong. Muốn có khung chờ lại thì cần tách vùng danh sách khỏi trang chi tiết. Đây là quyết định UX, hỏi người dùng.

## 4. Lưu ý khi chạy e2e trên máy này

- `apps/api/.env` trỏ tới Neon. Không in file này và không echo giá trị trong đó.
- API cho Playwright: `THROTTLE_LIMIT_SCALE=100 npm run start -w @hiflow/api`. Không đặt `TURNSTILE_SECRET` khi chạy bộ thường (spec nộp hồ sơ không có token sẽ bị 400).
- Captcha, chế độ `pass`: khởi động API với `TURNSTILE_SECRET=1x0000000000000000000000000000000AA`, rồi trong `apps/web` chạy `E2E_TURNSTILE=pass NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx playwright test captcha`. Chế độ `block`: `E2E_TURNSTILE=block NEXT_PUBLIC_TURNSTILE_SITE_KEY=2x00000000000000000000AB`. Sau đó khởi động lại API không có secret.
- Không chạy hai e2e cùng lúc (tranh khe giờ phỏng vấn, gây lỗi 409).
- Lịch phỏng vấn đã có kết quả và tin đã đăng không xóa được qua API. Các spec để lại dữ liệu `E2E-…`. Dọn bằng role owner nếu cần DB sạch; không xóa tay ngoài phạm vi đó.
- Nếu API e2e báo 409 khi đặt lịch: đã sửa bằng gốc thời gian ngẫu nhiên trong `apps/api/test/helpers/flow.ts`. Nếu vẫn gặp, đọc thông báo đầy đủ của lỗi, không đoán.

## 5. Những thay đổi quan trọng ở phiên cloud (để khỏi làm lại)

- `components/ui/dialog.tsx`: hộp thoại mở từ state trả focus về nút đã mở (lỗi thật, có test).
- `apps/api/test/helpers/flow.ts`: `futureSlot()` dùng gốc thời gian ngẫu nhiên cho mỗi lần chạy.
- `apps/web/src/app/careers/loading.tsx` đã gỡ (xem mục 3).
- `apps/web/src/app/global-error.tsx` giữ mã màu cứng: đã quyết, ghi ở `docs/business-flow.md` mục 7, điểm 22.
- `useListParams`: thay đổi liên tiếp trước khi URL cập nhật không còn ghi đè nhau; danh sách không có trang không thêm `page`.
- Spec Playwright mới: `keyboard`, `accessibility`, `captcha` (có điều kiện), `production-readiness`, `lifecycle`, `interviews`, `overview-reports-audit`.

## 6. Quy tắc làm việc (từ `CLAUDE.md`)

- Trả lời người dùng bằng tiếng Việt; code, comment và commit bằng tiếng Anh.
- Commit chỉ có header theo Conventional Commits, không có phần thân hay dòng ghi chú nào thêm vào. Một thay đổi logic một commit.
- Push nhánh này được. Merge vào `develop` hoặc `main` chỉ khi người dùng xác nhận rõ và suite đã xanh.
- Báo kết quả thật: lệnh, mã thoát, số test. Test bỏ qua là bỏ qua, không phải đạt.
