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

| Tệp trong Hiflow                          | Trạng thái | Thay đổi                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/utils.ts`               | chỉnh      | Chỉ giữ `cn`. Bỏ phần re-export định dạng (sẽ nằm ở `lib/format.ts`, B3) và `ensureHtml` (đi cùng trình soạn tin, G6).                                                                                                                                                                 |
| `apps/web/src/components/ui/button.tsx`   | chỉnh      | Dùng `<button>` thay cho primitive của `@base-ui/react` (G2 chọn Radix). Chỉ còn `primary`, `secondary`, `ghost`, `destructive`; cỡ `md`, `sm`, `icon-sm`. Màu theo token `hf`, bán kính 6px, bỏ kiểu dark. Mặc định `type="button"`. Trạng thái đang tải: `aria-busy` và vô hiệu hóa. |
| `apps/web/src/components/ui/input.tsx`    | chỉnh      | Dùng `<input>` gốc thay cho primitive của `@base-ui/react`. Cao 36px, bán kính 6px, màu theo token `hf`, bỏ kiểu dark. Lỗi qua `aria-invalid`; thông báo lỗi do trường biểu mẫu bao quanh.                                                                                             |
| `apps/web/src/components/ui/textarea.tsx` | chỉnh      | Cùng quy ước với Input: `<textarea>` gốc, bán kính 6px, token `hf`, bỏ kiểu dark. Tự co giãn theo nội dung, cao tối thiểu ba dòng.                                                                                                                                                     |
| `apps/web/src/components/ui/motion.ts`    | chỉnh      | Chuỗi class chuyển động của popup (mở 150 ms, đóng 100 ms). Dùng `ease-hf-standard` và `--hf-duration-fast` thay cho token của nguồn. Phụ thuộc `tw-animate-css` (import trong `globals.css`).                                                                                         |
| `apps/web/src/components/ui/checkbox.tsx` | chỉnh      | Chuyển từ primitive của `@base-ui/react` sang `@radix-ui/react-checkbox` (G2). Trạng thái dở dang dùng `checked="indeterminate"` thay cho prop `indeterminate`. Hộp 16px, bán kính 4px, token `hf`, bỏ kiểu dark.                                                                      |
