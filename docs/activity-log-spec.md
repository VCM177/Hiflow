# Spec kỹ thuật: Nhật ký hoạt động (Activity Log)

Tài liệu mô tả cơ chế **đã được cài đặt** ở `apps/api/src/modules/activity-logs/`, dùng làm chuẩn khi đọc code, viết test hoặc dựng màn hình xem nhật ký ở web.

## 1. Vị trí trong hệ thống

Module tên `activity-logs` (không có module riêng tên "audit"). Interceptor của nó được đăng ký toàn cục (`APP_INTERCEPTOR`), nên chạy trên **mọi** controller của ứng dụng, không chỉ module này.

```
apps/api/src/modules/activity-logs/
├── entities/activity-log.entity.ts
├── activity-log.constants.ts        # danh sách bỏ qua, ánh xạ loại đối tượng
├── activity-log.interceptor.ts      # nơi ghi log thật sự
├── sanitize-payload.ts              # che dữ liệu nhạy cảm
├── activity-logs.controller.ts      # API đọc, chỉ admin
├── activity-logs.service.ts
├── activity-logs.dto.ts
└── activity-log-view.ts
```

## 2. Bảng dữ liệu

Tạo trong migration gốc `1789917123561-InitSchema.ts` (không có migration riêng):

```sql
CREATE TABLE "activity_logs" (
  "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actor_id"    uuid,                 -- FK -> users.id, ON DELETE SET NULL
  "action"      varchar NOT NULL,     -- HTTP method: POST/PUT/PATCH/DELETE
  "entity_type" varchar NOT NULL,     -- "Candidate", "Requisition", ...
  "entity_id"   varchar,              -- id của đối tượng, có thể null
  "payload"     jsonb,                -- { route, body } đã che dữ liệu nhạy cảm
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON activity_logs (created_at);
CREATE INDEX ON activity_logs (entity_type, entity_id);
```

Không có cột IP, user-agent, `updatedAt` hay bản ghi trạng thái trước/sau — xem mục 7 (giới hạn).

Xóa một user không xóa lịch sử của họ: `actor_id` chỉ được set về `NULL` (`ON DELETE SET NULL`), dòng log vẫn còn.

## 3. Cơ chế ghi log (interceptor)

`ActivityLogInterceptor` chạy sau mỗi request HTTP, ghi log bất đồng bộ (fire-and-forget) sau khi response đã được trả:

- **Điều kiện ghi**: chỉ khi method là `POST`, `PUT`, `PATCH`, `DELETE` (`LOGGED_METHODS`). `GET` không bao giờ được ghi.
- **Bỏ qua** (`SKIP_LOG_ROUTES`, so khớp theo route pattern của Express, ví dụ `/candidates/:id`):
  - `POST /auth/login` — body chứa mật khẩu.
  - `POST /auth/logout` — không có gì để ghi.
  - `POST /public/jobs/:id/applications` — dữ liệu cá nhân của người lạ nộp qua cổng công khai, có lịch sử riêng ở bản ghi hồ sơ, không đưa vào nhật ký nội bộ.
- **`entityType`**: đoạn đầu của đường dẫn, tra qua bảng ánh xạ cố định (`users`→`User`, `candidates`→`Candidate`, `applications`→`Application`...); đoạn không có trong bảng thì viết hoa chữ cái đầu (`/widgets` → `Widgets`).
- **`entityId`**: ưu tiên `request.params.id`. Nếu route không có tham số tên đúng `:id` (ví dụ `:candidateId`), interceptor **không nhận ra được** — chỉ còn cách rơi về `response.id` (id trả về sau khi tạo mới). **Đây là lý do quy tắc bắt buộc: tham số đường dẫn của mọi route ghi dữ liệu phải tên `:id`.**
- **`actor`**: `request.user.id` (JWT guard gán); `null` nếu request không đăng nhập (route `@Public()`).
- **`payload`** lưu dạng jsonb: `{ route, body }`. `route` là _route pattern_, không phải URL thật (giữ nguyên `/requisitions/:id/approve` chứ không phải id thật) — nhờ vậy phân biệt được sub-route với route gốc. `body` là `request.body` sau khi che (mục 4). Không lưu query string, header, IP, user-agent, cũng không lưu response body (chỉ đọc `id` từ đó rồi bỏ).
- **Không chặn response**: ghi log nằm trong `tap()`, gọi service bằng `void this.record(...)`, và bên trong có `try/catch` chỉ log cảnh báo nếu ghi thất bại. Lỗi ghi nhật ký không bao giờ làm hỏng response trả về cho client.

## 4. Che dữ liệu nhạy cảm (`sanitize-payload.ts`)

```
SENSITIVE_KEY = /password|token|secret|authorization/i
MAX_DEPTH = 4
```

- So khớp theo **tên khóa** (không phân biệt hoa thường, khớp cả khi là chuỗi con), không xét giá trị. Vậy `password`, `newPassword`, `accessToken`, `JWT_SECRET`, `Authorization` đều bị thay bằng `'[REDACTED]'`.
- Đệ quy vào object và array lồng nhau.
- Từ độ sâu 4 trở lên, **toàn bộ nhánh** (không phải từng trường) bị thay bằng `'[TRUNCATED]'` — không che theo từng khóa nữa ở mức đó.
- Chỉ áp dụng cho `request.body`; không áp dụng cho header, query string hay response.

## 5. API đọc nhật ký

Toàn bộ route dưới `/activity-logs`, yêu cầu Bearer token, chỉ **Admin** có quyền (`activity_log.list.view`, `activity_log.list.export` — không role nào khác trong `ROLE_PERMISSIONS` được cấp hai quyền này). Không đăng nhập → 401; role khác Admin → 403.

| Route                       | Quyền                      | Mô tả                                                                              |
| --------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `GET /activity-logs`        | `activity_log.list.view`   | Danh sách có phân trang, lọc, tìm kiếm                                             |
| `GET /activity-logs/export` | `activity_log.list.export` | Xuất CSV (khai báo trước `:id` để không bị hiểu nhầm là id)                        |
| `GET /activity-logs/:id`    | `activity_log.list.view`   | Chi tiết một dòng; id không phải UUID → 400; UUID hợp lệ nhưng không tồn tại → 404 |

### Bộ lọc / truy vấn (`ListActivityLogsQueryDto`)

Kế thừa `PaginationQueryDto` (`page`, `limit` ≤100, `search`, `sortBy`, `sortDir`) và thêm:

- `actorId` (UUID), `action` (một trong POST/PUT/PATCH/DELETE), `entityType`, `entityId`, `from`/`to` (ISO date).
- `sortBy` chỉ nhận `createdAt` | `entityType` | `action`; sắp phụ theo `id ASC` để phân trang ổn định.
- `from`/`to` tính trọn ngày theo giờ địa phương server: `from` là đầu ngày (bao gồm), `to` là cuối ngày (bao gồm, cài đặt bằng mốc đầu ngày kế tiếp, loại trừ).
- `search` so khớp `ILIKE` trên tên hiển thị người thực hiện, `entityType`, `entityId`.
- Sai định dạng bất kỳ trường lọc nào → 400.

### Xuất CSV

- Giới hạn **10.000 dòng** mỗi lần xuất (snapshot, không phải dump toàn bộ bảng).
- File có BOM UTF-8, tiêu đề cột tiếng Việt: `Thời gian, Người thực hiện, Thao tác, Đối tượng, Mã đối tượng, Đường dẫn`.
- Áp dụng cùng bộ lọc và validate như `list`.

### Hình dạng một dòng (`ActivityLogView`)

```ts
{
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;          // POST | PUT | PATCH | DELETE
  entityType: string;
  entityId: string | null;
  route: string | null;    // route pattern, ví dụ /candidates/:id
  body: Record<string, unknown> | null;  // đã che dữ liệu nhạy cảm
  createdAt: string;
}
```

## 6. Test đã phủ

- **Unit** `activity-log.interceptor.spec.ts`: GET không ghi; `/auth/login` không ghi dù là POST; mỗi method ghi đúng 1 lần; entityId ưu tiên `params.id`; route lưu dạng pattern; mật khẩu bị che; user ẩn danh ghi `actorId: null`; resource lạ viết hoa chữ đầu; ghi log lỗi không ảnh hưởng response.
- **Unit** `sanitize-payload.spec.ts`: che đúng từng loại khóa nhạy cảm, đệ quy đúng, cắt đúng ở độ sâu 4.
- **E2E** `activity-log.e2e-spec.ts`: chứng minh toàn bộ pipeline HTTP → Postgres thật, kể cả route công khai (`@Public()`), giá trị mật khẩu gốc không bao giờ xuất hiện trong payload đã lưu.
- **E2E** `activity-logs.e2e-spec.ts`: phân quyền đúng theo từng role; nội dung log khớp với thao tác thật (PATCH chỉ lưu đúng field gửi lên, không merge với dữ liệu cũ); lọc/tìm kiếm/sắp xếp hoạt động đúng; validate input trả 400 đúng chỗ; export đúng định dạng CSV và số dòng.

## 7. Giới hạn đã biết (không phải bug, là phạm vi hiện tại)

- Không ghi IP, user-agent.
- Không lưu trạng thái trước khi thay đổi (before/after diff) — chỉ lưu request body đã gửi lên.
- Không lưu response body (trừ việc đọc tạm `id`).
- Nếu route dùng tên tham số khác `:id` (ví dụ `:candidateId`), `entityId` sẽ trống trừ khi response có sẵn trường `id`.
- Che dữ liệu chỉ dựa vào **tên khóa**, không quét nội dung giá trị; nhánh sâu hơn 4 cấp bị cắt toàn bộ thay vì che từng trường.
- Danh sách route bỏ qua là mảng cố định trong code, không có decorator kiểu `@SkipAuditLog()` — thêm route công khai mới có ghi dữ liệu nhạy cảm phải tự nhớ thêm vào `SKIP_LOG_ROUTES`.
- Chỉ Admin đọc được nhật ký; không có giới hạn theo phòng ban hay phạm vi dữ liệu khác.
