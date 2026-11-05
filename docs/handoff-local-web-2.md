# Handoff: web giai đoạn B, phần port (phiên máy local, tiếp theo)

Viết ngày 2026-11-05. Dành cho phiên khác làm tiếp. Đọc hết trước khi chạy lệnh nào.

## 1. Trạng thái repo

- Nhánh: `feat/web-ui-port`, cắt từ `develop` (`65be943`), đã push: `origin/feat/web-ui-port` ở `8ddd226`.
- Chưa merge vào `develop` hay `main`. Chưa mở PR.
- Có 36 commit từ `9ec8dba` đến `8ddd226` (chạy `git log --oneline 65be943..HEAD`).
- Thay đổi chưa commit: `.claude/settings.json`. Đây là cấu hình quyền của chủ dự án, không đưa vào commit. Đừng xóa hay đổi nó nếu không được yêu cầu.
- Tệp `docs/handoff-local-web-2.md` (chính tệp này) chưa commit.

## 2. Đã xong

### B1 Token

- `apps/web/src/styles/tokens.css`: toàn bộ `--hf-*` theo design guide. Các màu chữ đậm dùng cho trạng thái: `--hf-warning-text`, `--hf-success-text`, `--hf-neutral-text`, `--hf-destructive-text` (tự chọn để đạt AA, xem mục 5). Thêm `--hf-scrim` cho lớp phủ dialog.
- `apps/web/src/app/globals.css`: ánh xạ vào `@theme` (tiền tố `hf`), import `tw-animate-css`, bỏ dark mode, giảm chuyển động.
- `apps/web/src/styles/tokens.test.ts`: tương phản AA cho mọi cặp chữ/nền, viền điều khiển 3:1, thứ tự chuỗi biểu đồ, bán kính theo vai trò.
- Phông: Inter, subset `latin` và `vietnamese` (`apps/web/src/app/layout.tsx`).
- Trang xem token chỉ dev: `apps/web/src/app/dev/tokens/page.tsx` (production trả 404, đã kiểm tra bằng `next start`).

### B2 Primitive (đủ 16)

Trong `apps/web/src/components/ui/`: button, input, textarea, select, checkbox, switch, file-input, dialog, tooltip, popover, dropdown-menu, badge, skeleton, spinner, tabs, sonner (toast). Mỗi cái có test (focus, vô hiệu, lỗi, nhãn đọc màn hình, bàn phím). `motion.ts` là hằng số class chuyển động cho popup.

### B3 Thư viện lõi (phần port, do phiên này làm)

- `lib/utils.ts` (`cn`).
- `lib/api/errors.ts` (`ApiError`), `lib/api/describe-error.ts` (bảng 1.3), `lib/api/query-string.ts`, `lib/api/client.ts` (fetch, `credentials: 'include'`, không đọc token, 401 gọi `setUnauthorizedHandler`).
- `lib/format.ts` (vi-VN, múi giờ Asia/Ho_Chi_Minh).
- `lib/validations.ts` (Zod, bảng 1.6), `lib/permissions.ts` (`can`, `canAny`).
- `lib/query/client.ts` (không thử lại 4xx, mutation không tự thử lại), `lib/query/keys.ts` (`[thực thể, list|detail|options, params]`).
- `lib/list-params.ts` (tham số danh sách, mục 1.5), `hooks/use-list-params.ts`, `hooks/use-debounced-value.ts`.
- Chưa làm: B3.9 (`features/*/constants.ts`), vì đó là việc theo từng module.

Sổ ghi port: `docs/port-manifest.md`, 30 dòng. Mọi tệp có nguồn đều ghi trạng thái `chỉnh` và mô tả thay đổi. Tệp viết mới ghi `mới`.

## 3. Việc tiếp theo

Phân công (`docs/web-plan.md`, `docs/web-plan-detail.md`): phiên cloud làm B0 (xong), B4, B6, B7, B8. Phiên máy local (phiên này và phiên tiếp theo) làm B1 đến B3 (xong) và **B5**.

**Bước 1: chờ phiên cloud xong B4.** B4 gồm Route Handler `app/api/[...path]/route.ts` (chuyển tiếp `x-hiflow-proxy-secret`, `X-Forwarded-For`), `proxy.ts`, trang đăng nhập, `SessionProvider`. Kiểm tra trên `develop` hoặc nhánh cloud trước khi làm B5. Nếu chưa có, dừng và báo.

**Bước 2: B5 (đợt 2)**, theo `docs/web-plan-detail.md` mục B5. Danh sách:

- DataTable, FilterToolbar, ListPagination, PageSizeSelector, EmptyState, StatusBadge (dùng `constants.ts` theo domain), SectionCard, VerticalTimeline, NotesSection, ConfirmDialog, UnsavedChangesGuard.
- Các trường RHF dùng chung (RHFTextField, RHFSelectField, RHFDateField...), FormDialog, PermissionGate.
- Cần cài `react-hook-form` và `@hookform/resolvers` (cùng commit với thành phần đầu tiên dùng chúng). Zod đã có.
- Trang mẫu Danh mục dùng dữ liệu thật (qua API của phiên cloud).
- Mỗi thành phần có ba trạng thái: tải (skeleton), rỗng (`EmptyState` có lý do và hành động tiếp), lỗi (dòng lỗi có nút thử lại). Có bàn phím và test.
- Xong B5 thì dừng. B7 do cloud làm.

Mục nào trong B5 phải port từ bộ admin cũ thì làm theo quy trình `docs/port-manifest.md`. Các thành phần B5 trong nguồn đều nằm trong danh mục cho phép (components/shared). Đừng port tính năng, logic nghiệp vụ, ảnh, test hay cấu hình của nguồn.

## 4. Quyết định và xác nhận còn mở

- Chủ dự án đã xác nhận quyền dùng lại bộ admin cũ cho phần port. Nguồn là repo FE cũ của chủ dự án. **Không ghi tên hay đường dẫn của nguồn vào repo, commit, comment, test hay manifest.** Muốn biết đường dẫn, hỏi chủ dự án.
- Phông: đã chọn Inter (chủ dự án xác nhận).
- Hình dạng công tắc (Switch): track bo tròn hoàn toàn. Design guide cấm viên thuốc cho nút và badge nhưng chưa nêu công tắc. Cần xác nhận.
- Màu chữ đậm cho trạng thái và `--hf-scrim` là token tự chọn. Chưa có trong design guide. Cần xác nhận khi có màn hình thật.
- Các primitive viết lại (không copy nguyên văn) và bỏ một số API: ghi trong manifest.
- Các biến token chưa có thành phần dùng: `--hf-text-micro`, `--hf-ease-standard` (cảnh báo của `/tl-review`, không phải lỗi).

## 5. Lưu ý khi làm (đã gặp)

- Node 20.20.2 trên máy. jsdom 30 của B0 cần Node 22, nên jsdom được hạ xuống `^26.1.0` và đặt ở `devDependencies` gốc (vitest hoist và nhận jsdom từ gốc).
- Test web cần `npm run build:types` trước (đã có trong script `test` của gốc).
- `npm ci` có lúc chạy hơn 2 phút. Đã chạy xong, không phải lỗi mạng. Nếu cần cài thêm, dùng `npm install <gói>@<ver> -w @hiflow/web`.
- `npm run build -w @hiflow/web` tải Inter từ Google Fonts: cần mạng.
- Hook `leak-scan` (`../tools/leak-scan.sh`) chặn mọi tệp chứa chuỗi nhận diện của dự án khác, kể cả trong test. Khi bị chặn, sửa nội dung test (dùng chữ trung tính như `user@example.com`). Đừng đọc danh sách từ của scanner và đừng dùng `--no-verify`.
- Hook guard (`.claude/hooks/guard.mjs`) chặn lệnh `git commit` có nhiều hơn một `-m`. Mỗi commit gọi một lệnh riêng. Header only, không có trailer `Co-Authored-By`.
- `lint-staged` tạo stash tạm khi commit. Kiểm tra `git stash list` sau mỗi lần commit lỗi.
- Prettier tự định dạng lại `docs/port-manifest.md` và các tệp đã sửa. Khi sửa manifest, đọc lại trước. Dòng mới thêm vào cuối bảng bằng `printf '...' >> docs/port-manifest.md`, rồi chạy Prettier.
- `serializeListParams` ghi tham số URL theo thứ tự khóa của schema (ví dụ `page` trước `status`). Test so sánh chuỗi phải theo đúng thứ tự đó, hoặc so sánh theo `URLSearchParams`.

## 6. Cổng chất lượng (chạy ở gốc, trước mỗi commit)

```
npm run format:check
npm run lint
npm run typecheck
npm run build:types
npm run test -w @hiflow/web
npm run build -w @hiflow/web
```

`npm run format` (ghi) chỉ chạy khi cần. Chạy `/tl-review` trước mỗi commit thêm hoặc đổi hành vi. Cổng gần nhất (trước `8ddd226`): tất cả exit 0, web test 34 file / 195 test pass. Test api không chạy trong phiên này (`npm test` ở gốc có chạy thêm api).

## 7. Quyền của Claude Code

`.claude/settings.json` đã cho phép: `npm install ... -w @hiflow/web`, `npm install -D ...`, `git add`, `git commit -m`, `git push`, `Edit` và `Write` trong `D:\Hiflow\hiflow`, các script `format:check`, `typecheck`, `test -w @hiflow/web`, `build -w @hiflow/web`. Guard vẫn chặn force push, push sang `main`, reset cứng, rebase. Không mở quyền `npx *` hay `npm run *`.
