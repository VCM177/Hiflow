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

Mỗi lần đổi trạng thái hồ sơ ghi một dòng lịch sử (ai, khi nào, ghi chú). Mọi thao tác ghi (POST, PUT, PATCH, DELETE) vào nhật ký hoạt động với mật khẩu đã được che. Timeline của yêu cầu tuyển dụng lấy từ nhật ký này.

## 6. "Mở tuyển dụng" và cách ứng viên nộp hồ sơ

**Hiện tại** "Đăng tin" chỉ là công tắc trạng thái nội bộ: tin chuyển sang Đang tuyển và ghi thời điểm đăng. Chỉ tin Đang tuyển mới nhận được hồ sơ. Chưa có trang công khai, và ứng viên không tự nộp: nhân viên tuyển dụng nhập ứng viên rồi tạo hồ sơ thay họ.

**Hướng đã chọn (chưa làm): cổng công khai cho ứng viên tự nộp.**

Phạm vi:

- Trang danh sách tin Đang tuyển và trang chi tiết tin, không cần đăng nhập.
- Form ứng tuyển: họ tên, email, số điện thoại, CV (PDF hoặc DOCX, tối đa 5MB; định dạng .doc cũ bị từ chối).
- Hồ sơ vào thẳng bậc Mới, nguồn ứng viên ghi là Website, chưa có người phụ trách (hiện ở việc cần xử lý của Tổng quan).
- Nếu email đã có thì gắn hồ sơ vào ứng viên cũ thay vì tạo trùng; nếu ứng viên đã nộp vào tin này thì báo rõ, không tạo lần hai.

Yêu cầu bảo vệ, phải làm cùng lúc chứ không làm sau:

- Giới hạn tần suất theo địa chỉ và theo email; cân nhắc captcha.
- Chỉ công khai các trường an toàn của tin (không lộ người tạo, mã yêu cầu, số hồ sơ, ngân sách nội bộ).
- Kiểm tra CV như hiện tại (đuôi tệp, nội dung thật của tệp phải khớp đuôi, dung lượng); CV do người lạ tải lên không được tải xuống công khai. **Đã cài đặt:** mọi CV là riêng tư, chỉ tải qua `GET /candidates/:id/cv` sau khi kiểm quyền và phạm vi; không còn đường công khai `/uploads`.
- Không cho khách đọc bất kỳ dữ liệu ứng viên nào, kể cả để kiểm tra "email đã tồn tại": phản hồi phải giống nhau dù email có sẵn hay chưa.
- Dữ liệu cá nhân: chỉ nhận đúng các trường cần, có dòng đồng ý xử lý dữ liệu trên form.

Các điểm cần chốt trước khi làm: có captcha hay không; có hiển thị mức lương trên tin công khai không; ứng viên có nhận email xác nhận không (hiện hệ thống chưa gửi email nào).

## 7. Những giả định cần được xác nhận

1. Chỉ một cấp duyệt; Trưởng bộ phận không tự tạo tin.
2. Ứng viên nộp được nhiều tin, không nộp trùng một tin; email ứng viên là duy nhất.
3. Phễu ở Tổng quan tính cộng dồn theo lịch sử ("từng đạt bậc đó").
4. Đủ người đã nhận việc thì yêu cầu và tin không tự đóng; HR đóng thủ công.
5. Chưa có thông báo (email hay trong ứng dụng).
6. Giá trị chọn: tuổi tối thiểu ứng viên 16, khung phỏng vấn 60 phút, tối đa 10 vòng, khoảng báo cáo tối đa 366 ngày.
7. Người phỏng vấn có thể là phỏng vấn viên, trưởng bộ phận hoặc HR; người phụ trách hồ sơ là Tuyển dụng, HR hoặc Admin.
