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

Admin làm được mọi việc và là người duy nhất xem nhật ký hoạt động. Tổng quan và Báo cáo chỉ đọc số liệu.

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

| Vai trò        | Làm được                                                              | Phạm vi                                                             |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Trưởng bộ phận | Tạo, sửa, gửi yêu cầu; xem tổng quan                                  | Chỉ phòng ban của mình (ngoài phạm vi trả 404)                      |
| HR             | Duyệt, từ chối, đóng yêu cầu; quản lý người dùng; báo cáo và xuất CSV | Toàn công ty; không xem được offer, không tạo được tin hay ứng viên |
| Tuyển dụng     | Tin, ứng viên, hồ sơ, lịch phỏng vấn, offer                           | Toàn công ty                                                        |
| Phỏng vấn viên | Xem và ghi kết quả phỏng vấn của mình                                 | Chỉ hồ sơ và ứng viên mình được xếp lịch                            |
| Admin          | Tất cả, kể cả nhật ký hoạt động                                       | Toàn bộ                                                             |

HR không được cấp hay chạm vào tài khoản Admin; không ai tự đổi vai trò hay tự khóa chính mình. Khóa tài khoản hoặc đổi vai trò có hiệu lực ngay ở request kế tiếp.

## 5. Vết truy ngược

Mỗi lần đổi trạng thái hồ sơ ghi một dòng lịch sử (ai, khi nào, ghi chú). Hồ sơ do ứng viên tự nộp qua website không có người đăng nhập nên được ghi dưới **tài khoản hệ thống** `system@hiflow.local` (tên hiển thị "Ứng viên (Website)"): tài khoản này do migration tạo, bị khóa, mật khẩu ngẫu nhiên không ai biết, không đăng nhập được, không xuất hiện trong danh sách người dùng, không được phân công hồ sơ hay xếp lịch phỏng vấn, và mọi API quản lý người dùng đều trả 404 với nó. Mọi thao tác ghi (POST, PUT, PATCH, DELETE) vào nhật ký hoạt động với mật khẩu đã được che. Timeline của yêu cầu tuyển dụng lấy từ nhật ký này.

## 6. "Mở tuyển dụng" và cách ứng viên nộp hồ sơ

"Đăng tin" chuyển tin sang Đang tuyển và ghi thời điểm đăng. Chỉ tin Đang tuyển mới nhận được hồ sơ, từ nhân viên tuyển dụng hoặc từ ứng viên tự nộp qua cổng công khai.

**Cổng công khai (đã cài đặt)**, không cần đăng nhập, mọi đường công khai nằm trong `modules/public`:

- `GET /public/jobs` và `GET /public/jobs/:id`: chỉ tin Đang tuyển, chỉ các trường dành cho ứng viên (tiêu đề, phòng ban, vị trí, địa điểm, mô tả, số lượng, **mức lương**, ngày đăng). Không lộ người tạo, mã yêu cầu, số hồ sơ. Tin nháp, đã đóng hoặc không có đều trả cùng một lỗi 404. Giới hạn 60 lượt mỗi phút mỗi địa chỉ.
- `POST /public/jobs/:id/applications` (multipart): họ tên, email, số điện thoại, CV (PDF hoặc DOCX, tối đa 5MB; `.doc` cũ bị từ chối), dòng đồng ý xử lý dữ liệu (`consent=true`, thời điểm đồng ý lưu ở hồ sơ), mã Cloudflare Turnstile. Form chỉ nhận đúng các trường này; trường lạ bị từ chối.
- Hồ sơ vào thẳng bậc Mới, nguồn ứng viên là Website, chưa có người phụ trách (hiện ở việc cần xử lý của Tổng quan), dòng lịch sử đầu tiên ghi dưới tài khoản hệ thống. CV nằm trên hồ sơ (`GET /applications/:id/cv`), không ghi đè CV của ứng viên.
- Email đã có thì gắn hồ sơ mới vào ứng viên cũ và **không sửa gì** ở ứng viên đó (form không chứng minh được người nộp là chủ email). Ứng viên đã nộp vào tin này thì không tạo lần hai.
- **Phản hồi luôn là một nội dung cố định (HTTP 202)**, dù là hồ sơ mới, nộp trùng hay email đã có sẵn: khách không dò được ai đã ứng tuyển tin nào. Chủ hộp thư được báo bằng email: "đã nhận hồ sơ" hoặc "bạn đã nộp tin này rồi".
- Bảo vệ: giới hạn 10 lần nộp mỗi 15 phút mỗi địa chỉ và 3 lần mỗi giờ mỗi email; captcha kiểm tra trước mọi việc tốn công; kiểm tra CV theo nội dung thật của tệp; CV lưu riêng tư; log hoạt động không ghi lần nộp (chứa dữ liệu cá nhân); họ tên chỉ một dòng, không ký tự điều khiển hay ký tự định dạng ẩn (vì tên được nhắc lại trong email).
- Email gửi bằng Resend (trình điều khiển `outbox` khi phát triển và kiểm thử chỉ giữ thư trong bộ nhớ). Thư là văn bản thuần, không chứa liên kết.

**Rủi ro đã chấp nhận:** email chưa được xác minh quyền sở hữu, nên ai cũng có thể khiến một hộp thư nhận thư xác nhận; giới hạn 3 thư mỗi giờ mỗi email và captcha làm giảm việc này. Thời gian phản hồi giữa nộp mới và nộp trùng được làm gần bằng nhau (cả hai đều lưu CV rồi mới quyết định) nhưng không tuyệt đối. Resend chỉ gửi được tới địa chỉ tùy ý sau khi xác minh tên miền gửi.

## 7. Những giả định cần được xác nhận

1. Chỉ một cấp duyệt; Trưởng bộ phận không tự tạo tin.
2. Ứng viên nộp được nhiều tin, không nộp trùng một tin; email ứng viên là duy nhất.
3. Phễu ở Tổng quan tính cộng dồn theo lịch sử ("từng đạt bậc đó").
4. Đủ người đã nhận việc thì yêu cầu và tin không tự đóng; HR đóng thủ công.
5. Chỉ có email xác nhận cho ứng viên nộp qua website; chưa có thông báo nào khác (email hay trong ứng dụng).
6. Giá trị chọn: tuổi tối thiểu ứng viên 16, khung phỏng vấn 60 phút, tối đa 10 vòng, khoảng báo cáo tối đa 366 ngày.
7. Người phỏng vấn có thể là phỏng vấn viên, trưởng bộ phận hoặc HR; người phụ trách hồ sơ là Tuyển dụng, HR hoặc Admin.

**Đã xác nhận (2026-09-24, khi kiểm định Cổng A):**

8. Trưởng bộ phận gọi dữ liệu của phòng ban khác nhận **404**, không phải 403, để không lộ việc bản ghi có tồn tại. Thiếu quyền thì vẫn là 403.
9. Phỏng vấn viên **được xem** ứng viên, hồ sơ ứng tuyển, lịch phỏng vấn và tải CV, nhưng chỉ trong phạm vi các lịch được xếp cho mình (ngoài phạm vi trả 404). Thao tác ghi duy nhất của họ là nhập kết quả phỏng vấn của chính mình.
