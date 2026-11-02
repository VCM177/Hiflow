# Bàn giao Hiflow

Cập nhật 2026-11-02, nhánh `develop`. Tài liệu này chỉ ghi trạng thái và việc kế tiếp; quy tắc làm việc nằm ở `CLAUDE.md`, nghiệp vụ ở `docs/business-flow.md`.

## 1. Đang ở đâu

| Hạng mục                               | Trạng thái                                            | Bằng chứng                                                              |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Backend (NestJS)                       | Xong, Cổng A đã đóng ngày 2026-09-24                  | `docs/gate-a-audit.md`: 19 PASS, 309 unit và 556 e2e xanh               |
| Cổng công khai (tin và form nộp hồ sơ) | Xong ở backend                                        | `modules/public`, `business-flow.md` mục 6                              |
| Web (`apps/web`)                       | **Mới là scaffold của Next**, chưa có code giao diện  | `apps/web/src/app` chỉ có `layout.tsx`, `page.tsx`, `globals.css`       |
| UX giai đoạn 1 và 2                    | Viết xong                                             | `docs/ux/01-discovery.md`, `docs/ux/02-define.md`                       |
| UX giai đoạn 4 (prototype)             | Có, bấm được                                          | Artifact wireframe (mục 5)                                              |
| UX giai đoạn 3 và 5                    | Chưa làm                                              | Không có người dùng thật để kiểm thử                                    |
| Nhật ký kiểm toán v2                   | **Đã cài đặt** (2026-11-02), thay hẳn `activity_logs` | `docs/audit-trail-spec.md`, `modules/audit`, `test/audit-*.e2e-spec.ts` |

Kiểm tra lúc bàn giao (2026-11-02): `npm run lint`, `npm run build`, `npm test` (41 suite, 344 test) và toàn bộ `npm run test:e2e` (638 test pass, 5 bỏ qua là Supabase và Redis thật) đều exit 0, chạy trên Postgres 16 cục bộ với role `hiflow_app`; hai suite captcha cần `NODE_USE_ENV_PROXY=1` trong môi trường sandbox. Chưa chạy lại trên Neon.

## 2. Việc kế tiếp, theo thứ tự

1. ~~Chốt và làm nhật ký kiểm toán v2~~ **Xong** (2026-11-02): A đến E theo mặc định, cài đặt theo 7 bước của spec, mỗi bước một commit.
2. ~~Sửa backend theo quyết định UX~~ **Xong**, trừ việc 5 ở mục 4 (sửa tệp ngoài repo).
3. **Web giai đoạn B**, kế hoạch đề xuất ở `docs/web-plan.md` (chờ duyệt 8 câu ở mục 8 của nó; kế hoạch cũ đã mất, mục 5): B0 chuẩn bị, B1 token, B2 primitive, B3 lib, B4 phiên và khung, B5 component dùng chung, B6 backend nhỏ (đã xong bằng `GET /users/options`), B7 mười một module, B8 hoàn thiện. **Xong B5 mới được làm module.**
4. Bổ sung giai đoạn 3 và 5 của UX nếu báo cáo cần (mục 6).
5. Đặt lịch chạy `npm run retention:run -w @hiflow/api` định kỳ (mã nguồn không tự lên lịch).

## 3. Chờ người dùng xác nhận

**Nhật ký kiểm toán v2:** A đến E đã được xác nhận theo mặc định ngày 2026-11-02 (lưu giá trị thật và chỉ Admin đọc, IP và user-agent giữ 12 tháng, form công khai có sự kiện, không lưu email đăng nhập sai). Ghi nhận ở `business-flow.md` mục 7.

**Quyết định thiết kế UX A đến K** (`docs/ux/02-define.md` mục 4, `business-flow.md` mục 7 điểm 10 đến 19): do người thực hiện tự chốt ngày 2026-10-02 theo ủy quyền của người dùng. Điểm 11, 13, 18 và 20 đã cài; điểm 11 được xác nhận ngày 2026-11-02. Các điểm còn lại **chưa ai xác nhận lại**: trong báo cáo cần ghi rõ như vậy.

**Quyền dùng lại giao diện cũ.** Kế hoạch giai đoạn B yêu cầu người dùng xác nhận quyền dùng lại mã nguồn bộ admin cũ trước B0. Quy tắc Isolation trong `CLAUDE.md` đã được sửa cho phép port, nhưng việc xác nhận bản quyền chưa được ghi lại ở đâu.

## 4. Việc backend còn nợ

Chỉ còn một việc ngoài repo: sửa mục 1.1.2.1 trong danh sách chức năng (`D:\Hiflow\docs\danh-sach-chuc-nang.txt`) thành "chuyển tới trang đích theo vai trò". Các việc backend khác của quyết định UX (quyền phỏng vấn của Trưởng bộ phận và HR, việc cần xử lý của Trưởng bộ phận, CV rơi về ứng viên, người dùng để chọn) đã xong.

Giữ nguyên, không đổi (đã đối chiếu với code): mã 202 của form công khai (CV được kiểm tra và lưu trước khi trả lời) và 404 cho tin đã đóng.

**Thiết lập bắt buộc từ bước 2 của nhật ký kiểm toán v2** (máy nào chạy API hoặc e2e cũng phải làm một lần):

1. Tạo role hạn chế: `neon roles create --name hiflow_app` (hoặc `CREATE ROLE hiflow_app LOGIN PASSWORD '...'` trên Postgres thường) rồi đặt mật khẩu.
2. Trong `apps/api/.env`: `DATABASE_URL` trỏ tới **hiflow_app** (API chạy bằng role này), thêm `DATABASE_OWNER_URL` trỏ tới role chủ sở hữu hiện tại (migration, seed, bảo trì e2e). Biến mẫu nằm ở `.env.example`.
3. `npm run migration:run -w @hiflow/api` (migration dừng với thông báo rõ nếu role chưa tồn tại).
4. API từ chối khởi động nếu role đang dùng có quyền UPDATE, DELETE hoặc TRUNCATE trên bảng audit; thông báo lỗi nói cách sửa.

## 5. Tài liệu và tài nguyên nằm ngoài repo

Các thứ dưới đây nằm trên máy của người dùng hoặc trên claude.ai, không có trong git:

- Kế hoạch giai đoạn B v2 (danh sách file port, mốc B0 đến B8, Definition of Done, checklist Cổng B): **file plan trên máy đã mất** — đường dẫn ghi trước đây không còn tồn tại (có thể do lỗi mã hóa tên file), và hai file plan còn lại trong thư mục đó thuộc dự án khác, không được chép vào đây theo quy tắc Isolation. Cần hỏi lại người dùng để lập lại kế hoạch này trước khi bắt đầu B0. Phạm vi port (ui/layout/shared, lib, hooks, providers; viết mới `features/*`) đã ghi ở `CLAUDE.md` mục "Isolation" và "Next" nên không mất hoàn toàn.
- Prototype giao diện (bản 2, sáng và tối, 5 vai trò, 4 trạng thái bảng): https://claude.ai/artifact/G8sqf8DyGAkdWV1VQ6bk5k
- Danh sách chức năng gốc (12 nhóm): `D:\Hiflow\docs\danh-sach-chuc-nang.txt`.
- Công cụ quét rò rỉ: `D:\Hiflow\tools\leak-scan.sh`, chạy trong pre-commit.
- Bộ admin cũ để port, chỉ đọc: đường dẫn nằm trong `.claude/settings.local.json` (không commit). Không ghi tên hay đường dẫn của nó vào repo.

## 6. Quy tắc dễ vấp

- **Quét rò rỉ** chặn mọi file chứa một số chuỗi, kể cả URL nguồn tham khảo. Đã gặp: đuôi miền quốc gia Việt Nam, một từ viết tắt về hệ thống nhân sự cũ, và tên role mặc định của Neon. Tài liệu UX vì vậy ghi nguồn tiếng Việt bằng tên trang và ngày truy cập. Sửa nội dung bị chặn, **không** dùng `--no-verify`.
- **Hook `guard.mjs`:** một lệnh commit chỉ được một `-m` (header). Không tách nhiều `git commit` trong một lệnh. Push thường (không force, không đụng `main` hoặc `master`) đã được phê duyệt; merge hay push vào `main` cần người dùng xác nhận từng lần.
- **Không chạy hai bộ e2e cùng lúc:** chúng tranh khung giờ phỏng vấn và lỗi 409. `npm run test:e2e` mất khoảng 15 phút, chạy nền.
- **Không in `apps/api/.env`.** Mọi biến được mô tả ở `.env.example`.
- **Nhật ký thay đổi lớn đang chờ:** nếu làm nhật ký kiểm toán v2, bước cuối phải sửa `CLAUDE.md` (bỏ quy tắc đặt tên `:id`, thêm quy tắc audit) và `/tl-review` mục A-07.
- Nói chuyện với người dùng bằng tiếng Việt; mã, comment và commit bằng tiếng Anh, commit chỉ có header.

## 7. Giới hạn đã biết của phần UX

- Persona là **proto-persona** dựng từ nghiệp vụ và nghiên cứu tại bàn, vì không tiếp cận được người dùng thật.
- Số liệu thị trường phần lớn là của Mỹ và toàn cầu, lấy qua trang tổng hợp, chưa đối chiếu bản gốc; báo cáo thị trường Việt Nam của TopCV chỉ dành cho người đăng ký nên chưa có số liệu tương ứng.
- Điểm cảm xúc trong journey map là giả định.
- Chưa có email nào cho ứng viên ngoài thư xác nhận nhận hồ sơ, và chưa gửi thử qua Resend thật.
