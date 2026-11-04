# Prompt cho phiên local: port B1 đến B3 và B5

Dán nội dung dưới đây vào một phiên Claude Code chạy trên máy của chủ dự án (nơi có bộ admin cũ). Phiên cloud đã xong B0 và B6; B4 do cloud làm giữa hai đợt.

```text
Bạn đang làm việc trên máy của tôi, trong repo Hiflow. Nhiệm vụ: làm phần PORT giao diện của web giai đoạn B (B1, B2, phần port của B3, và sau này B5) từ bộ admin cũ của tôi. Mọi phần còn lại (B0, B4, B6, B7, B8) do phiên cloud làm, đừng làm.

## Đọc trước khi làm bất cứ gì
1. `CLAUDE.md` (đặc biệt mục Isolation, Git workflow, Working agreements, quy tắc commit chỉ có header).
2. `docs/web-plan.md` (mục 3 kiến trúc, mục 4 các mốc, mục 8 câu hỏi) và `docs/web-plan-detail.md` (mục 1 quy ước chung, B1, B2, B3, B5 và bảng lịch mục 4).
3. `docs/port-manifest.md` (quy trình port từng tệp) và skill `admin-design-guide` (nạp trước khi viết bất kỳ thành phần giao diện nào).
4. `apps/web/AGENTS.md` và `node_modules/next/dist/docs/` trước khi dùng API của Next 16.
5. `docs/handoff.md` mục 3 và 6.

## Quyết định đã chốt (theo đề xuất trong web-plan.md mục 8)
G1: port ở máy này. G2: TanStack Query, React Hook Form + Zod, Radix UI, một thư viện toast, Vitest + Testing Library, Playwright. G3, G4: kiểu và nhãn dùng chung ở `packages/shared-types`. G7: không có chế độ tối.

## Xác nhận cần có trước khi bắt đầu
Quyền dùng lại bộ admin cũ chưa được ghi lại ở đâu. Hãy hỏi tôi xác nhận một lần ở đầu phiên. Đường dẫn bộ cũ nằm trong `.claude/settings.local.json` (không commit).

## Quy tắc cách ly (bắt buộc)
- Chỉ port các tệp thuộc `components/ui`, `components/layout`, `components/shared`, `lib`, `hooks`, `providers`, từng tệp một, mỗi tệp một commit, ghi một dòng vào `docs/port-manifest.md`.
- Đọc toàn bộ từng tệp nguồn. Gỡ SSO, import tới `features/*`, chuỗi và tên miền của nguồn. Đổi mọi định danh, khóa lưu trữ, sự kiện, token sang tiền tố `hf`.
- Căn theo hợp đồng Hiflow: quyền từ `@hiflow/shared-types`, phân trang `{ items, meta }`, lỗi `{ statusCode, message }`, phiên bằng cookie HttpOnly (JS không đọc token). Căn theo design guide: chỉ dùng token, bán kính theo vai trò, không nút dạng viên thuốc, chữ tiếng Việt.
- Không port tính năng, logic nghiệp vụ, ảnh, test hay cấu hình của nguồn. Không bao giờ ghi tên hay đường dẫn của nguồn vào repo, commit, comment hay manifest.
- Phụ thuộc npm thêm cùng commit với tệp đầu tiên dùng nó.
- Không dùng `--no-verify`. Pre-commit có chạy `../tools/leak-scan.sh`; nếu nó chặn, sửa nội dung chứ không bỏ qua.

## Phạm vi đợt 1 (làm ngay)
- Xác nhận B0 (Vitest, `typecheck`, `transpilePackages`) đã có trên `develop`. Nếu chưa có, dừng và báo tôi (phiên cloud làm B0 trước); đừng tự làm B0.
- B1: `styles/tokens.css`, ánh xạ Tailwind 4, phông, trang xem mẫu token chỉ ở môi trường phát triển, test tương phản AA (gồm chữ trạng thái trung tính).
- B2: Button, Input, Textarea, Select, Checkbox, Switch, FileInput, Dialog, Tooltip, Popover, DropdownMenu, Badge, Skeleton, Spinner, Tabs, Toast; mỗi cái có trạng thái focus, vô hiệu, lỗi, nhãn đọc màn hình và test bàn phím.
- B3, chỉ phần port: `lib/api/client.ts`, `errors.ts`, `describe-error.ts`, `query-string.ts`, `format.ts` (vi-VN), `validations.ts`, `permissions.ts`, `lib/query/`, `hooks/useListParams`, `useDebouncedValue`. Phần viết mới thì ghi rõ trạng thái `mới` trong manifest.
- Mỗi commit qua cổng chất lượng của `web-plan-detail.md` mục 1.2 (`format`, `lint`, `typecheck`, `test`, `build`) và `/tl-review` trước khi commit.
- Làm trên nhánh cắt từ `develop`, push nhánh đó (không push `main`/`master`).

## Dừng và báo tôi khi
- Xong B1 đến B3: báo danh sách commit và trạng thái cổng chất lượng để phiên cloud làm B4.
- Gặp tệp nguồn nào không thể port mà không kéo theo logic nghiệp vụ hoặc tên nguồn.
- Có gì lệch so với design guide hoặc hợp đồng API.

## Đợt 2 (sau khi cloud xong B4, tôi sẽ nhắn lại)
B5: DataTable, FilterToolbar, ListPagination, PageSizeSelector, EmptyState, StatusBadge, SectionCard, VerticalTimeline, NotesSection, ConfirmDialog, UnsavedChangesGuard, các trường RHF dùng chung, FormDialog, PermissionGate, kèm trang mẫu Danh mục dùng dữ liệu thật. Mỗi thành phần có ba trạng thái (tải, rỗng, lỗi), bàn phím và test. Xong B5 thì dừng: B7 do cloud làm.

## Báo cáo
Nói tiếng Việt. Báo đúng exit code và kết quả thật của từng lệnh; nếu bỏ qua kiểm tra nào thì nói rõ.
```
