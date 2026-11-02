# Luồng nghiệp vụ Hiflow

Tài liệu này mô tả nghiệp vụ **đã được cài đặt** ở backend, dùng làm chuẩn để làm giao diện và viết báo cáo.

## 1. Chuỗi nghiệp vụ

```
Trưởng bộ phận        HR                   Tuyển dụng                    Phỏng vấn viên
   │                  │                        │                                │
Tạo YÊU CẦU ─ gửi ─► Duyệt / Từ chối           │                                │
   ▲  (sửa, gửi lại)   │ (bắt buộc có lý do)    │                                │
                       └─ đã duyệt ────────► Tạo TIN từ yêu cầu ─► Mở tuyển dụng │
                                                │                                │
                      Ứng viên (CV) ──────────► Nộp HỒ SƠ vào tin đang tuyển     │
                                                │  Mới → Sàng lọc → Phỏng vấn    │
                                                ├─ đặt LỊCH PHỎNG VẤN ──────────►│ ghi kết quả Đạt / Không đạt
                                                │  → Đề nghị → tạo OFFER         │
                                                └─ ứng viên chấp nhận → NHẬN VIỆC
```

Admin làm được mọi việc và là người duy nhất xem nhật ký kiểm toán. Tổng quan và Báo cáo chỉ đọc số liệu.

## 2. Bốn máy trạng thái

| Đối tượng          | Đường đi                                                                                 | Quy tắc                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Yêu cầu tuyển dụng | Nháp → Chờ duyệt → Đã duyệt → Đã đóng; Chờ duyệt → Từ chối → (sửa) → Chờ duyệt           | Một cấp duyệt. Từ chối bắt buộc có lý do. Chỉ sửa được khi Nháp hoặc Từ chối; chỉ xóa được khi Nháp. |
| Tin tuyển dụng     | Nháp → Đang tuyển → Đã đóng                                                              | Chỉ tạo được từ yêu cầu đã duyệt. Tổng số lượng các tin còn sống không vượt số đã duyệt.             |
| Hồ sơ ứng tuyển    | Mới → Sàng lọc → Phỏng vấn → Đề nghị → Nhận việc; từ mọi bậc → Từ chối hoặc Ứng viên rút | Không nhảy bậc, không quay lại. Từ chối bắt buộc có lý do.                                           |
| Phỏng vấn          | Chờ kết quả → Đạt / Không đạt / Đã hủy                                                   | Mỗi hồ sơ chỉ có một lịch chờ kết quả tại một thời điểm. Không đạt bắt buộc có nhận xét.             |

## 3. Ràng buộc giữa các bước

- Lên bậc **Đề nghị**: cần ít nhất một vòng phỏng vấn Đạt và không còn lịch nào chưa có kết quả.
- Lên bậc **Nhận việc**: chỉ qua việc ứng viên chấp nhận offer, không có đường tắt.
- Chấp nhận offer → hồ sơ thành Nhận việc; từ chối offer → hồ sơ thành Ứng viên rút. Cả hai trong cùng một giao dịch.
- Từ chối hoặc rút hồ sơ tự hủy các lịch phỏng vấn đang chờ và coi offer đang chờ là bị từ chối.
- Đóng yêu cầu tự đóng mọi tin nháp hoặc đang mở sinh ra từ nó.
- Đặt lịch phỏng vấn: hồ sơ phải ở bậc Phỏng vấn, thời gian ở tương lai, người phỏng vấn không có lịch khác trong vòng 60 phút.
- Offer: một offer mỗi hồ sơ; ngày nhận việc không ở quá khứ; hạn phản hồi không sau ngày nhận việc; offer quá hạn không chấp nhận được nhưng vẫn từ chối được.
- Hai người thao tác cùng lúc trên một đối tượng: chỉ một người thành công, người kia nhận lỗi 409.

## 4. Vai trò và phạm vi dữ liệu

| Vai trò        | Làm được                                                                                                            | Phạm vi                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Trưởng bộ phận | Tạo, sửa, gửi yêu cầu; xem tổng quan; xem và ghi kết quả phỏng vấn của chính mình                                   | Chỉ phòng ban của mình; lịch phỏng vấn chỉ của mình (ngoài phạm vi trả 404)                                                 |
| HR             | Duyệt, từ chối, đóng yêu cầu; quản lý người dùng; báo cáo và xuất CSV; ghi kết quả phỏng vấn do chính mình đảm nhận | Toàn công ty (xem mọi lịch phỏng vấn, chỉ ghi kết quả lịch của mình); không xem được offer, không tạo được tin hay ứng viên |
| Tuyển dụng     | Tin, ứng viên, hồ sơ, lịch phỏng vấn, offer                                                                         | Toàn công ty                                                                                                                |
| Phỏng vấn viên | Xem và ghi kết quả phỏng vấn của mình                                                                               | Chỉ hồ sơ và ứng viên mình được xếp lịch                                                                                    |
| Admin          | Tất cả, kể cả nhật ký kiểm toán                                                                                     | Toàn bộ                                                                                                                     |

HR không được cấp hay chạm vào tài khoản Admin; không ai tự đổi vai trò hay tự khóa chính mình. Khóa tài khoản hoặc đổi vai trò có hiệu lực ngay ở request kế tiếp.

## 5. Vết truy ngược

Mỗi lần đổi trạng thái hồ sơ ghi một dòng lịch sử (ai, khi nào, ghi chú). Hồ sơ do ứng viên tự nộp qua website không có người đăng nhập nên được ghi dưới **tài khoản hệ thống** `system@hiflow.local` (tên hiển thị "Ứng viên (Website)"): tài khoản này do migration tạo, bị khóa, mật khẩu ngẫu nhiên không ai biết, không đăng nhập được, không xuất hiện trong danh sách người dùng, không được phân công hồ sơ hay xếp lịch phỏng vấn, và mọi API quản lý người dùng đều trả 404 với nó. Ngoài ra có **nhật ký kiểm toán** (mục 5b). Timeline của yêu cầu tuyển dụng lấy từ nhật ký này.

## 5b. Nhật ký kiểm toán

Chỉ **Admin** đọc (`GET /audit-events`, chi tiết `GET /audit-events/:id`, xuất CSV `GET /audit-events/export`). Mỗi sự kiện nghiệp vụ ("Duyệt yêu cầu YC-012", "Chuyển trạng thái hồ sơ"...) ghi một dòng gồm người thực hiện (tên và vai trò **tại thời điểm đó**), đối tượng, dữ liệu riêng của sự kiện, nguồn (`app`, `seed`, `maintenance`, `e2e`), địa chỉ IP và user-agent; danh mục sự kiện và nhãn tiếng Việt nằm ở `packages/shared-types/src/audit-events.ts`. Cùng giao dịch, trigger của Postgres ghi **mọi cột đã đổi** (giá trị cũ và mới) của 10 bảng nghiệp vụ, nối với sự kiện bằng `tx_id`; mật khẩu chỉ ghi `[REDACTED]`. Ghi dữ liệu và ghi nhật ký cùng thành công hoặc cùng thất bại. Bảng chỉ thêm, không sửa: role chạy API không có quyền sửa hay xóa, và API từ chối khởi động nếu có.

- Cũng ghi các lần **đọc dữ liệu cá nhân**: tải CV (ứng viên và hồ sơ), xuất báo cáo, xuất nhật ký.
- Đăng nhập thành công, thất bại (sai mật khẩu, tài khoản bị khóa) và đăng xuất đều ghi; đăng nhập thất bại với email không tồn tại **không lưu email đã nhập**.
- Hồ sơ nộp qua website ghi `APPLICATION_SUBMITTED_ONLINE` (chỉ mã tin, người thực hiện là tài khoản hệ thống); nộp trùng không ghi gì.
- Ghi chú, nhận xét và nội dung ghi chú **không** nằm trong sự kiện; chúng nằm ở thay đổi dòng của bảng chứa chúng.
- IP và user-agent giữ `AUDIT_IP_RETENTION_MONTHS` tháng (12), sau đó `retention:run` xóa riêng hai trường này. Khi ứng viên bị ẩn danh, `retention:run` xóa các bản sao giá trị thật của họ trong thay đổi dòng; sự kiện `CANDIDATE_ANONYMIZED` được giữ để chứng minh việc đã làm.
- Dữ liệu demo sinh ra bởi `seed:demo` có nguồn `seed`, ngày lùi khớp lịch sử; `--reset` thay thế chúng.

## 6. "Mở tuyển dụng" và cách ứng viên nộp hồ sơ

"Đăng tin" chuyển tin sang Đang tuyển và ghi thời điểm đăng. Chỉ tin Đang tuyển mới nhận được hồ sơ, từ nhân viên tuyển dụng hoặc từ ứng viên tự nộp qua cổng công khai.

**Cổng công khai (đã cài đặt)**, không cần đăng nhập, mọi đường công khai nằm trong `modules/public`:

- `GET /public/jobs` và `GET /public/jobs/:id`: chỉ tin Đang tuyển, chỉ các trường dành cho ứng viên (tiêu đề, phòng ban, vị trí, địa điểm, mô tả, số lượng, **mức lương**, ngày đăng). Không lộ người tạo, mã yêu cầu, số hồ sơ. Tin nháp, đã đóng hoặc không có đều trả cùng một lỗi 404. Giới hạn 60 lượt mỗi phút mỗi địa chỉ.
- `POST /public/jobs/:id/applications` (multipart): họ tên, email, số điện thoại, CV (PDF hoặc DOCX, tối đa 5MB; `.doc` cũ bị từ chối), dòng đồng ý xử lý dữ liệu (`consent=true`, thời điểm đồng ý lưu ở hồ sơ), mã Cloudflare Turnstile. Form chỉ nhận đúng các trường này; trường lạ bị từ chối.
- Hồ sơ vào thẳng bậc Mới, nguồn ứng viên là Website, chưa có người phụ trách (hiện ở việc cần xử lý của Tổng quan), dòng lịch sử đầu tiên ghi dưới tài khoản hệ thống. CV nằm trên hồ sơ (`GET /applications/:id/cv`), không ghi đè CV của ứng viên; khi hồ sơ không có CV riêng, đường này trả CV của ứng viên.
- Email đã có thì gắn hồ sơ mới vào ứng viên cũ và **không sửa gì** ở ứng viên đó (form không chứng minh được người nộp là chủ email). Ứng viên đã nộp vào tin này thì không tạo lần hai.
- **Phản hồi luôn là một nội dung cố định (HTTP 202)**, dù là hồ sơ mới, nộp trùng hay email đã có sẵn: khách không dò được ai đã ứng tuyển tin nào. Chủ hộp thư được báo bằng email: "đã nhận hồ sơ" hoặc "bạn đã nộp tin này rồi".
- Bảo vệ: giới hạn 10 lần nộp mỗi 15 phút mỗi địa chỉ và 3 lần mỗi giờ mỗi email; captcha kiểm tra trước mọi việc tốn công; kiểm tra CV theo nội dung thật của tệp; CV lưu riêng tư; log hoạt động không ghi lần nộp (chứa dữ liệu cá nhân); họ tên chỉ một dòng, không ký tự điều khiển hay ký tự định dạng ẩn (vì tên được nhắc lại trong email).
- Email gửi bằng Resend (trình điều khiển `outbox` khi phát triển và kiểm thử chỉ giữ thư trong bộ nhớ). Thư là văn bản thuần, không chứa liên kết.

**Rủi ro đã chấp nhận:** email chưa được xác minh quyền sở hữu, nên ai cũng có thể khiến một hộp thư nhận thư xác nhận; giới hạn 3 thư mỗi giờ mỗi email và captcha làm giảm việc này. Thời gian phản hồi giữa nộp mới và nộp trùng được làm gần bằng nhau (cả hai đều lưu CV rồi mới quyết định) nhưng không tuyệt đối. Resend chỉ gửi được tới địa chỉ tùy ý sau khi xác minh tên miền gửi.

## 6b. Lưu và xóa dữ liệu ứng viên

Căn cứ: Luật Bảo vệ dữ liệu cá nhân 2025 (hiệu lực 01/01/2026) cho cá nhân quyền yêu cầu xóa và yêu cầu xóa khi hết mục đích xử lý. Các con số dưới đây là **chính sách của dự án**, chưa đối chiếu với nguyên văn Nghị định hướng dẫn.

- **Ẩn danh, không xóa dòng.** Ứng viên được ẩn danh để phễu và báo cáo vẫn đếm đủ: họ tên thành "Ứng viên đã ẩn danh", email thành `anonymized-<id>@anonymized.invalid`, xóa điện thoại, ngày sinh, ghi chú và CV (cả CV ở hồ sơ ứng viên lẫn CV nộp kèm từng hồ sơ), xóa ghi chú của các hồ sơ của họ, ghi sự kiện `CANDIDATE_ANONYMIZED`. Cột `anonymized_at` đánh dấu việc đã làm. Bản sao giá trị thật trong nhật ký kiểm toán bị xóa ở lần chạy `retention:run` kế tiếp (mục 5b).
- **Theo yêu cầu:** `POST /candidates/:id/anonymize`, chỉ HR và Admin (`candidate.item.anonymize`), có ghi nhật ký. Làm ngay, không chờ hết hạn lưu.
- **Điều kiện:** ứng viên chỉ được ẩn danh khi mọi hồ sơ của họ đã **Từ chối** hoặc **Ứng viên rút** (hoặc chưa có hồ sơ nào). Còn hồ sơ đang xử lý (Mới, Sàng lọc, Phỏng vấn, Đề nghị) hoặc đã **Nhận việc** thì trả 409: người đã nhận việc thuộc dữ liệu nhân sự, nằm ngoài phạm vi Hiflow. Việc kiểm tra và xóa nằm trong một giao dịch có khóa dòng ứng viên, nên một hồ sơ tạo cùng lúc không lọt qua.
- **Sau khi ẩn danh:** không sửa, không thêm ghi chú hay CV, không tạo hồ sơ mới cho ứng viên đó (409). Hồ sơ cũ vẫn xem được, đã mất mọi thông tin nhận dạng.
- **Hết hạn lưu:** ứng viên không còn hồ sơ đang xử lý và không có hoạt động nào trong `CANDIDATE_RETENTION_MONTHS` tháng (mặc định 12, số nguyên 1 đến 120, tính từ lần cập nhật, nộp hồ sơ hay đổi trạng thái muộn nhất) sẽ bị ẩn danh bởi `npm run retention:run -w @hiflow/api`. Thêm `-- --dry-run` để chỉ đếm. Lệnh phải được **một bộ lập lịch bên ngoài gọi định kỳ**; mã nguồn không tự chạy nó. Mỗi lần xử lý tối đa 500 ứng viên; lỗi của một ứng viên không dừng cả lần chạy.
- **Chưa được ẩn danh (giới hạn đã biết):** nội dung ghi chú trong lịch sử đổi trạng thái, nhận xét phỏng vấn, ghi chú offer, và thay đổi dòng của các bảng đó trong nhật ký kiểm toán. Đây là văn bản do nhân viên viết và có thể nhắc tên người.

## 7. Những giả định cần được xác nhận

1. Chỉ một cấp duyệt; Trưởng bộ phận không tự tạo tin.
2. Ứng viên nộp được nhiều tin, không nộp trùng một tin; email ứng viên là duy nhất.
3. Phễu ở Tổng quan tính cộng dồn theo lịch sử ("từng đạt bậc đó").
4. Đủ người đã nhận việc thì yêu cầu và tin không tự đóng; HR đóng thủ công.
5. Chỉ có email xác nhận cho ứng viên nộp qua website; chưa có thông báo nào khác (email hay trong ứng dụng).
6. Giá trị chọn: tuổi tối thiểu ứng viên 16, khung phỏng vấn 60 phút, tối đa 10 vòng, khoảng báo cáo tối đa 366 ngày.
7. Người phỏng vấn có thể là phỏng vấn viên, trưởng bộ phận hoặc HR; người phụ trách hồ sơ là Tuyển dụng, HR hoặc Admin.

**Nhật ký kiểm toán v2 (đã cài; A đến E được người dùng xác nhận theo mặc định ngày 2026-11-02, chi tiết ở `docs/audit-trail-spec.md` mục 12):**

- A. Dữ liệu cá nhân trong bảng thay đổi dòng lưu giá trị thật (không che), chỉ Admin đọc, xóa theo hạn lưu.
- B. Lưu IP và user-agent, giữ 12 tháng.
- C. Hồ sơ nộp qua website sinh sự kiện `APPLICATION_SUBMITTED_ONLINE` (chỉ id, người thực hiện là tài khoản hệ thống).
- D. Toàn bộ nhật ký chỉ Admin đọc; chưa có timeline theo đối tượng cho vai trò khác.
- E. Đăng nhập sai với email không tồn tại không lưu email đã nhập.

**Quyết định thiết kế UX (2026-10-02, người thực hiện tự chốt, `docs/ux/02-define.md` mục 4). Đã chốt, chưa xác nhận bởi người dùng cuối; mục nào ghi "chưa cài" thì backend hiện chưa theo:**

10. Giữ quy tắc hồ sơ không nhảy bậc; không có đường tắt bỏ qua Sàng lọc.
11. Trưởng bộ phận và HR là người phỏng vấn thì nhập được kết quả cho lịch xếp cho chính mình. **Đã cài và đã được người dùng xác nhận (2026-11-02):** HR vẫn xem mọi lịch nhưng chỉ ghi kết quả lịch của mình (lịch của người khác trả 403); Trưởng bộ phận chỉ thấy và ghi lịch của mình (lịch khác trả 404); Admin ghi thay mọi người. Việc "Phỏng vấn hôm nay" trên Tổng quan của Trưởng bộ phận đếm lịch của chính họ.
12. Chỉ có email xác nhận cho ứng viên; giảm cảm giác "im lặng" bằng nội dung trang cảm ơn và email, không thêm email theo bước.
13. Tổng quan của Trưởng bộ phận có việc "yêu cầu bị từ chối cần sửa" và "yêu cầu nháp chưa gửi" (đã cài: hai việc hiện cho vai trò có quyền sửa và gửi yêu cầu, đếm theo phòng ban của người xem).
14. Mục Danh mục chỉ hiện trong menu của Admin; vai trò khác đọc dữ liệu ngầm cho ô chọn.
15. Cổng công khai ở `/careers/<slug>-<id>`; id là phần xác định, slug chỉ để đọc.
16. Phỏng vấn viên vào thẳng Lịch phỏng vấn sau đăng nhập, lọc sẵn "Chờ kết quả".
17. Trưởng bộ phận thấy tên, email, điện thoại và CV của ứng viên trên chi tiết hồ sơ nhưng không vào được trang ứng viên.
18. CV trên chi tiết hồ sơ rơi về CV của ứng viên khi hồ sơ không có CV riêng (đã cài: `GET /applications/:id/cv` ưu tiên CV nộp kèm, nếu không có thì dùng CV ở hồ sơ ứng viên; `hasCv` của chi tiết hồ sơ cho biết có CV tải được hay không).
19. Tin đã đóng giữ 404 giống tin nháp và không tồn tại; giao diện hiện trang thân thiện gợi ý tin đang mở. Mã 202 của form nộp hồ sơ giữ nguyên.

**Đã xác nhận (2026-11-02):**

20. Nhân viên tuyển dụng chọn người phụ trách hồ sơ và người phỏng vấn qua `GET /users/options` (quyền `user.options.view`), chỉ trả `id`, họ tên và vai trò của người đang hoạt động; không có email, phòng ban hay tài khoản hệ thống. Họ không đọc được danh sách người dùng đầy đủ. Tham số `purpose` (`ASSIGNEE` hoặc `INTERVIEWER`) thu hẹp theo vai trò hợp lệ. HR đã có `user.list.view` nên không cần quyền này. Đã cài.

21. Chính sách lưu và xóa dữ liệu ứng viên ở mục 6b: giữ 12 tháng (cấu hình được), hết hạn thì ẩn danh chứ không xóa, Admin hoặc HR xử lý yêu cầu của ứng viên, người đã nhận việc nằm ngoài phạm vi. Đã cài.

**Đã xác nhận (2026-09-24, khi kiểm định Cổng A):**

8. Trưởng bộ phận gọi dữ liệu của phòng ban khác nhận **404**, không phải 403, để không lộ việc bản ghi có tồn tại. Thiếu quyền thì vẫn là 403.
9. Phỏng vấn viên **được xem** ứng viên, hồ sơ ứng tuyển, lịch phỏng vấn và tải CV, nhưng chỉ trong phạm vi các lịch được xếp cho mình (ngoài phạm vi trả 404). Thao tác ghi duy nhất của họ là nhập kết quả phỏng vấn của chính mình.
