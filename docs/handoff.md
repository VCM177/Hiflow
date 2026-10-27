# Bàn giao Hiflow

Cập nhật 2026-10-02, nhánh `develop`. Tài liệu này chỉ ghi trạng thái và việc kế tiếp; quy tắc làm việc nằm ở `CLAUDE.md`, nghiệp vụ ở `docs/business-flow.md`.

## 1. Đang ở đâu

| Hạng mục                               | Trạng thái                                           | Bằng chứng                                                                                       |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Backend (NestJS)                       | Xong, Cổng A đã đóng ngày 2026-09-24                 | `docs/gate-a-audit.md`: 19 PASS, 309 unit và 556 e2e xanh                                        |
| Cổng công khai (tin và form nộp hồ sơ) | Xong ở backend                                       | `modules/public`, `business-flow.md` mục 6                                                       |
| Web (`apps/web`)                       | **Mới là scaffold của Next**, chưa có code giao diện | `apps/web/src/app` chỉ có `layout.tsx`, `page.tsx`, `globals.css`                                |
| UX giai đoạn 1 và 2                    | Viết xong                                            | `docs/ux/01-discovery.md`, `docs/ux/02-define.md`                                                |
| UX giai đoạn 4 (prototype)             | Có, bấm được                                         | Artifact wireframe (mục 5)                                                                       |
| UX giai đoạn 3 và 5                    | Chưa làm                                             | Không có người dùng thật để kiểm thử                                                             |
| Nhật ký kiểm toán v2                   | **Mới có thiết kế, chưa có dòng code nào**           | `docs/audit-trail-spec.md` ("chưa cài đặt"); không có `audit_events` hay `AuditService` trong mã |

Kiểm tra lúc bàn giao: `npm run lint`, `npm test` (34 suite, 309 test) và `npm run build` đều exit 0. Không chạy e2e vì lần này chỉ đổi tài liệu và hook.

## 2. Việc kế tiếp, theo thứ tự

1. **Chốt nhật ký kiểm toán A đến E** (mục 3). Câu A chặn commit migration đầu tiên.
2. **Sửa backend theo quyết định UX** (mục 4), mỗi việc một commit, đi qua `/tl-review plan`.
3. **Web giai đoạn B** theo kế hoạch v2 (mục 5): B0 chuẩn bị, B1 token, B2 primitive, B3 lib, B4 phiên và khung, B5 component dùng chung, B6 backend nhỏ, B7 mười một module, B8 hoàn thiện. **Xong B5 mới được làm module.**
4. Bổ sung giai đoạn 3 và 5 của UX nếu báo cáo cần (mục 6).

Quyết định thứ tự giữa 1 và 3: người dùng muốn xong backend trước khi làm web (ghi nhận khi bắt đầu thiết kế nhật ký, 2026-09-27).

## 3. Chờ người dùng xác nhận

**Nhật ký kiểm toán v2** (`docs/audit-trail-spec.md` mục 12, phản chiếu ở `business-flow.md` mục 7):

| #   | Câu hỏi                                                                   | Mặc định đang dùng                        | Chặn                          |
| --- | ------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------- |
| A   | Lưu giá trị thật của dữ liệu cá nhân trong bảng thay đổi dòng (không che) | Lưu thật, chỉ Admin đọc, xóa theo hạn lưu | commit migration              |
| B   | Lưu IP và user-agent, giữ bao lâu                                         | Lưu, 12 tháng                             | commit `RequestContext`       |
| C   | Form công khai sinh sự kiện `APPLICATION_SUBMITTED_ONLINE`                | Có                                        | commit chuyển module `public` |
| D   | Ai được đọc                                                               | Chỉ Admin                                 | commit API đọc                |
| E   | Đăng nhập sai với email không tồn tại có lưu email đã nhập                | Không                                     | commit sự kiện phiên          |

Đã chốt (2026-09-27): làm lại triệt để và bỏ interceptor; xóa `activity_logs` và để `seed:demo` sinh lại sự kiện; tách role DB (`hiflow_app` lúc chạy, owner cho migration, seed và dọn e2e); chưa làm chuỗi băm. Thứ tự 7 commit ở spec mục 13.

**Quyết định thiết kế UX A đến K** (`docs/ux/02-define.md` mục 4, `business-flow.md` mục 7 điểm 10 đến 19): do người thực hiện tự chốt ngày 2026-10-02 theo ủy quyền của người dùng, **chưa ai xác nhận lại**. Trong báo cáo cần ghi rõ như vậy.

**Quyền dùng lại giao diện cũ.** Kế hoạch giai đoạn B yêu cầu người dùng xác nhận quyền dùng lại mã nguồn bộ admin cũ trước B0. Quy tắc Isolation trong `CLAUDE.md` đã được sửa cho phép port, nhưng việc xác nhận bản quyền chưa được ghi lại ở đâu.

## 4. Việc backend còn nợ từ quyết định UX

Chưa làm. Mỗi việc một commit, chạy `rbac-matrix` và e2e liên quan.

1. Trưởng bộ phận được `interview.list.view`; Trưởng bộ phận và HR được `interview.result.record`, nhưng chỉ cho lịch xếp cho chính mình. Hiện `INTERVIEWER_ROLES` gồm Phỏng vấn viên, Trưởng bộ phận và HR, mà chỉ Phỏng vấn viên và Admin nhập được kết quả. HR đang xem mọi lịch: xác nhận phạm vi trước khi sửa `scopedQuery` và `findScoped` trong `interviews.service.ts`.
2. `DashboardService.todoFor`: thêm "Yêu cầu bị từ chối cần sửa" và "Yêu cầu nháp chưa gửi" cho Trưởng bộ phận. Hiện cả bốn loại việc đều cần quyền mà vai trò này không có, nên danh sách luôn trống.
3. Chi tiết hồ sơ: khi hồ sơ không có CV riêng thì dùng CV của ứng viên. Hiện `GET /applications/:id/cv` chỉ trả CV nộp qua website.
4. Mốc B6: RECRUITER được `user.listView` để chọn người phỏng vấn và người phụ trách.
5. Sửa mục 1.1.2.1 trong danh sách chức năng (`D:\Hiflow\docs\danh-sach-chuc-nang.txt`, ngoài repo) thành "chuyển tới trang đích theo vai trò".

Giữ nguyên, không đổi (đã đối chiếu với code): mã 202 của form công khai (CV được kiểm tra và lưu trước khi trả lời) và 404 cho tin đã đóng.

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
