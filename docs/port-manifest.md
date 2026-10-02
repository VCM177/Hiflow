# Danh mục port giao diện

Tầng giao diện dùng chung của `apps/web` (`components/ui`, `components/layout`, `components/shared`, `lib`, `hooks`, `providers`) được port có chọn lọc từ bộ admin trước đây của chủ dự án. Tệp này là nơi duy nhất ghi nhận việc đó, và chỉ ghi **đường dẫn trong Hiflow**, không ghi tên hay đường dẫn của nguồn.

## Quy trình cho mỗi tệp

1. Chép đúng một tệp vào vị trí tương ứng, không chép cả thư mục.
2. Đọc toàn bộ tệp; gỡ import tới `features/*`, SSO, chế độ hiển thị riêng của nguồn, chuỗi và tên miền của nguồn.
3. Đổi mọi định danh, khóa lưu trữ, sự kiện và token sang tiền tố `hf`.
4. Căn theo hợp đồng Hiflow: quyền từ `@hiflow/shared-types`, phân trang `{ items, meta }`, lỗi `{ statusCode, message }`, phiên bằng cookie HttpOnly (JS không đọc token).
5. Căn theo design guide: chỉ dùng token, radius theo vai trò, không nút pill, chữ tiếng Việt.
6. Lint, type-check, test của tệp đó, leak-scan; rồi thêm một dòng vào bảng dưới.

Mỗi phụ thuộc npm được thêm trong cùng commit với tệp đầu tiên dùng nó.

## Trạng thái

- `port`: giữ nguyên hành vi, chỉ đổi tên và token.
- `chỉnh`: giữ phần lớn, có thay đổi hành vi hoặc API (ghi rõ ở cột thay đổi).
- `mới`: viết mới cho Hiflow, không có bản nguồn.

| Tệp trong Hiflow | Trạng thái | Thay đổi |
| ---------------- | ---------- | -------- |
