# Spec thiết kế: Nhật ký kiểm toán (Audit Trail) v2

**Trạng thái:** bản thiết kế, chưa cài đặt. Thay thế cơ chế interceptor mô tả trong `activity-log-spec.md` (file đó bị xóa ở commit cuối của kế hoạch này).

## 1. Mục tiêu

Nhật ký phải trả lời được bốn câu hỏi, và câu trả lời phải đúng với dữ liệu thật trong Postgres:

1. **Ai** làm (kể cả tên và vai trò của họ tại thời điểm đó).
2. **Làm gì** theo nghĩa nghiệp vụ ("Duyệt yêu cầu YC-012"), không phải HTTP method.
3. **Dữ liệu đổi thế nào**: giá trị trước và sau của đúng các cột đã đổi.
4. **Trong ngữ cảnh nào**: cùng request, cùng transaction, từ nguồn nào (app, seed, thao tác tay trên DB).

Ràng buộc:

- Nhật ký ghi **trong cùng transaction** với thao tác nghiệp vụ: ghi log lỗi thì thao tác rollback.
- **Không thể quên**: một đường ghi dữ liệu không đi qua cơ chế audit phải bị chặn, không được lặng lẽ bỏ qua.
- **Không thể sửa**: app không có quyền UPDATE/DELETE trên bảng audit; ngay cả role owner cũng phải bật cờ tường minh mới xóa được.
- Chỉ dùng Postgres, không thêm hạ tầng ngoài.

## 2. Kiến trúc

Hai lớp, nối với nhau bằng `tx_id`:

```
HTTP request
  └─ RequestContext (AsyncLocalStorage): requestId, ip, userAgent
       └─ TxRunner.run(actor, work)
            BEGIN
            set_config('hiflow.tx_id' | 'hiflow.actor_id' | 'hiflow.request_id' | 'hiflow.origin', ..., true)
            ├─ work(manager, audit)
            │    ├─ ghi nghiệp vụ ──► trigger ──► audit_row_changes   (lớp 2: dữ liệu thật)
            │    └─ audit.record(...) ────────► audit_events        (lớp 1: sự kiện nghiệp vụ)
            COMMIT (hoặc ROLLBACK cả ba)
```

- **Lớp 1, `audit_events`**: service ghi tường minh, một dòng cho mỗi hành động nghiệp vụ. Danh mục sự kiện nằm ở `packages/shared-types`.
- **Lớp 2, `audit_row_changes`**: trigger Postgres ghi tự động mọi INSERT/UPDATE/DELETE trên bảng nghiệp vụ, chỉ các cột đã đổi. Bắt được mọi đường ghi, kể cả `UPDATE ... WHERE status = ?` có điều kiện, QueryBuilder, SQL tay.

### Các phương án đã loại

| Phương án                                 | Lý do                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interceptor HTTP (hiện tại)               | Ghi sau khi commit, không atomic; chỉ có request body, không có trạng thái cũ; hành động là HTTP method |
| TypeORM subscriber                        | Không chạy với `manager.update` theo điều kiện và QueryBuilder; không có trạng thái cũ                  |
| CDC (logical replication, Debezium/Kafka) | Thêm hạ tầng, bất đồng bộ, không biết "ai" và "vì sao"                                                  |
| pgaudit                                   | Ghi SQL vào log server, app không truy vấn được, không có actor                                         |
| Event sourcing                            | Viết lại toàn bộ domain                                                                                 |
| DB/dịch vụ audit riêng                    | Mất atomic, phải có outbox. Để dành cho khi cần đẩy sang SIEM (outbox đọc từ `audit_events`)            |

## 3. Vai trò cơ sở dữ liệu

| Role                                            | Dùng bởi                                               | Quyền                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| owner (role chủ sở hữu mặc định của dự án Neon) | migration, seed CLI, bảo trì e2e, job xóa theo hạn lưu | toàn quyền; xóa bảng audit chỉ khi `hiflow.purge = 'on'`                                                                             |
| `hiflow_app`                                    | API khi chạy (dev, e2e, production)                    | SELECT/INSERT/UPDATE/DELETE trên bảng nghiệp vụ; **chỉ SELECT/INSERT** trên bảng audit; USAGE/SELECT/UPDATE trên sequence; không DDL |

- Tạo role bằng Neon CLI (`neon roles create --name hiflow_app`); mật khẩu chỉ nằm trong `.env`.
- Biến môi trường: `DATABASE_URL` là kết nối của `hiflow_app`; thêm `DATABASE_OWNER_URL` cho migration, seed và bảo trì e2e. `typeorm.config.ts` (CLI) dùng `DATABASE_OWNER_URL`.
- Migration cấp quyền (GRANT, `ALTER DEFAULT PRIVILEGES` cho bảng tạo sau này). Role lấy tên từ `DB_APP_ROLE` (mặc định `hiflow_app`); role chưa tồn tại thì migration dừng với thông báo rõ ràng.
- **Kiểm tra lúc khởi động:** app từ chối khởi động nếu role đang dùng có quyền UPDATE hoặc DELETE trên bảng audit (`has_table_privilege`). Ở production, `AUDIT_ORIGIN` phải là `app`.

## 4. Bảng dữ liệu

### `audit_events`

| Cột                        | Kiểu                         | Ghi chú                                                               |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `id`                       | uuid PK                      |                                                                       |
| `occurred_at`              | timestamptz                  | `clock_timestamp()`, thứ tự đúng kể cả trong cùng transaction         |
| `event`                    | varchar(64)                  | mã trong danh mục (mục 7)                                             |
| `entity_type`              | varchar(32)                  | `Requisition`, `Application`, ...                                     |
| `entity_id`                | uuid null                    | null cho sự kiện không gắn đối tượng (đăng nhập sai email lạ, export) |
| `actor_id`                 | uuid null                    | **không có khóa ngoại**: xóa user không được phép chạm vào log        |
| `actor_name`, `actor_role` | varchar null                 | ảnh chụp tại thời điểm hành động                                      |
| `tx_id`                    | uuid                         | nối với `audit_row_changes`                                           |
| `request_id`               | uuid null                    | các sự kiện cùng một request                                          |
| `origin`                   | varchar(16)                  | `app` \| `seed` \| `maintenance` \| `e2e`                             |
| `ip`, `user_agent`         | inet null, varchar(256) null | _chờ xác nhận, mục 12_                                                |
| `data`                     | jsonb                        | chỉ các trường khai báo cho sự kiện đó (allowlist theo kiểu)          |

Chỉ mục: `(occurred_at DESC)`, `(entity_type, entity_id, occurred_at)`, `(actor_id, occurred_at)`, `(tx_id)`, `(event, occurred_at)`.

### `audit_row_changes`

| Cột                                | Kiểu               | Ghi chú                                                                     |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `id`                               | bigint identity PK | thứ tự ghi                                                                  |
| `tx_id`                            | uuid               |                                                                             |
| `table_name`                       | varchar(64)        |                                                                             |
| `row_id`                           | uuid               |                                                                             |
| `op`                               | char(1)            | `I` / `U` / `D`                                                             |
| `changes`                          | jsonb              | `I`: `{cột: mới}`; `U`: `{cột: [cũ, mới]}` chỉ cột đã đổi; `D`: `{cột: cũ}` |
| `actor_id`, `request_id`, `origin` |                    | lấy từ `hiflow.*`                                                           |
| `occurred_at`                      | timestamptz        | `clock_timestamp()`                                                         |

Chỉ mục: `(table_name, row_id, id)`, `(tx_id)`.

Bảng cũ `activity_logs` bị xóa (đã xác nhận: chỉ chứa dữ liệu demo và e2e).

## 5. Trigger

### `hiflow_audit_capture()`: AFTER INSERT/UPDATE/DELETE, FOR EACH ROW

Gắn vào 10 bảng: `users`, `departments`, `job_positions`, `requisitions`, `jobs`, `candidates`, `applications`, `application_status_histories`, `interviews`, `offers`. Bảng lịch sử trạng thái cũng được ghi: nó bị xóa theo dây chuyền khi xóa hồ sơ, và việc đó phải để lại dấu vết. Chỉ hai bảng audit là không gắn.

1. Đọc `hiflow.tx_id`. Nếu trống:
   - Role không có quyền DELETE trên `audit_row_changes` (tức `hiflow_app`) → `RAISE EXCEPTION` mã `HF001` "ghi dữ liệu ngoài TxRunner". **Đây là cơ chế chống quên chính.**
   - Role owner → vẫn ghi, `tx_id` suy ra từ `txid_current()`, `origin = 'maintenance'`. Sửa tay bằng psql cũng để lại dấu vết.
2. `hiflow.capture = 'off'` chỉ có hiệu lực với role owner (dọn dữ liệu e2e, reset demo); với `hiflow_app` bị bỏ qua.
3. UPDATE không đổi cột nào (sau khi loại cột bỏ qua) → không ghi.
4. Áp chính sách cột (mục 6).

Kiểm tra quyền bằng `has_table_privilege(current_user, ...)` nên trigger không cần biết tên role.

### `hiflow_audit_immutable()`: BEFORE UPDATE/DELETE, FOR EACH ROW + BEFORE TRUNCATE trên hai bảng audit

- UPDATE: luôn bị từ chối.
- DELETE, TRUNCATE: chỉ khi `hiflow.purge = 'on'` (role owner bật trong transaction dọn dẹp). `hiflow_app` vốn đã không có quyền, đây là lớp phòng thủ thứ hai.

## 6. Chính sách cột trong `audit_row_changes`

| Loại            | Cột                        | Cách ghi                                                                         |
| --------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Bỏ qua          | `created_at`, `updated_at` | không xuất hiện                                                                  |
| Bí mật          | `users.password_hash`      | `"[REDACTED]"`, vẫn thấy được là đã đổi mật khẩu                                 |
| Dữ liệu cá nhân | email, SĐT, họ tên         | giá trị thật; được bảo vệ bằng phân quyền đọc (chỉ Admin) và hạn lưu (mục 12, B) |
| Còn lại         |                            | giá trị thật                                                                     |

## 7. Danh mục sự kiện

Định nghĩa ở `packages/shared-types/src/audit-events.ts`: tên sự kiện, `entityType`, kiểu của `data`. Service chỉ ghi được `data` đúng kiểu đó (TypeScript chặn trường thừa). Sự kiện `*_UPDATED` chỉ ghi `changedFields` (tên cột); giá trị nằm ở lớp 2.

| Nhóm               | Sự kiện                                                                                     | `data`                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Phiên              | `AUTH_LOGIN_SUCCEEDED`, `AUTH_LOGGED_OUT`                                                   | —                                                                                                                             |
|                    | `AUTH_LOGIN_FAILED`                                                                         | `reason: INVALID_CREDENTIALS \| ACCOUNT_LOCKED`                                                                               |
| Hồ sơ cá nhân      | `PROFILE_UPDATED`                                                                           | `changedFields`                                                                                                               |
|                    | `PASSWORD_CHANGED`                                                                          | —                                                                                                                             |
| Người dùng         | `USER_CREATED`, `USER_UPDATED`                                                              | `changedFields` (UPDATED)                                                                                                     |
|                    | `USER_ROLE_CHANGED`                                                                         | `from`, `to`                                                                                                                  |
|                    | `USER_STATUS_CHANGED`                                                                       | `from`, `to` (isActive)                                                                                                       |
|                    | `USER_PASSWORD_RESET`                                                                       | —                                                                                                                             |
| Phòng ban / Vị trí | `DEPARTMENT_*`, `POSITION_*` (CREATED, UPDATED, DELETED)                                    | `changedFields`                                                                                                               |
| Yêu cầu tuyển dụng | `REQUISITION_CREATED`, `_UPDATED`, `_DELETED`, `_SUBMITTED`, `_APPROVED`, `_CLOSED`         | `code`; `changedFields` (UPDATED)                                                                                             |
|                    | `REQUISITION_REJECTED`                                                                      | `code`, `reason`                                                                                                              |
| Tin tuyển dụng     | `JOB_CREATED`, `_UPDATED`, `_DELETED`, `_PUBLISHED`, `_STOPPED`                             | `changedFields` (UPDATED)                                                                                                     |
| Ứng viên           | `CANDIDATE_CREATED`, `_UPDATED`, `_DELETED`, `_NOTE_UPDATED`, `_CV_UPLOADED`, `_CV_REMOVED` | `changedFields` (UPDATED)                                                                                                     |
|                    | `CANDIDATE_CV_DOWNLOADED`                                                                   | — (đọc dữ liệu nhạy cảm)                                                                                                      |
| Hồ sơ ứng tuyển    | `APPLICATION_CREATED`, `_NOTE_UPDATED`, `_DELETED`                                          | —                                                                                                                             |
|                    | `APPLICATION_SUBMITTED_ONLINE`                                                              | `jobId` _(chờ xác nhận, mục 12)_                                                                                              |
|                    | `APPLICATION_ASSIGNEE_CHANGED`                                                              | `from`, `to` (id)                                                                                                             |
|                    | `APPLICATION_STATUS_CHANGED`                                                                | `from`, `to`, `note` — ghi trong `ApplicationWorkflowService.moveTo`, nên mọi đường (endpoint trạng thái, luồng offer) đều có |
|                    | `APPLICATION_CV_DOWNLOADED`                                                                 | —                                                                                                                             |
| Phỏng vấn          | `INTERVIEW_SCHEDULED`, `_UPDATED`                                                           | `changedFields` (UPDATED)                                                                                                     |
|                    | `INTERVIEW_CANCELLED`                                                                       | `reason`                                                                                                                      |
|                    | `INTERVIEW_RESULT_RECORDED`                                                                 | `result`                                                                                                                      |
| Offer              | `OFFER_CREATED`, `OFFER_UPDATED`                                                            | `changedFields` (UPDATED)                                                                                                     |
|                    | `OFFER_RESPONSE_RECORDED`                                                                   | `response`                                                                                                                    |
| Xuất dữ liệu       | `AUDIT_LOG_EXPORTED`, `REPORT_EXPORTED`                                                     | bộ lọc đã dùng, số dòng                                                                                                       |

Một request có thể sinh nhiều sự kiện (ghi nhận phản hồi offer sinh `OFFER_RESPONSE_RECORDED` và `APPLICATION_STATUS_CHANGED`), chung `tx_id` và `request_id`.

`application_status_histories` giữ nguyên: đó là dữ liệu nghiệp vụ mà báo cáo phễu đang dùng.

## 8. Cài đặt phía API

- **`RequestContext`** (`common/request-context`): middleware đặt `requestId` (UUID mới), `ip` (`request.ip`, đã qua `TRUST_PROXY`), `userAgent` vào `AsyncLocalStorage` có sẵn của Node. Không thêm thư viện.
- **`TxRunner.run(actor, work)`** (`modules/audit`): mở transaction, đặt `hiflow.*`, gọi `work(manager, audit)`. `actor` là `{ id, name, role }`; request công khai dùng system user. Là cách **duy nhất** để ghi dữ liệu nghiệp vụ; mọi `repository.save/update/delete` ngoài nó bị trigger chặn (`HF001` → 500, lộ ngay trong e2e).
- **`audit.record(event, entity, data)`**: kiểu được suy ra từ danh mục.
- **`AuditService.recordStandalone(...)`**: cho sự kiện không kèm thao tác ghi (đăng nhập, tải CV, export). Đăng nhập thất bại cũng ghi, ở cả hai nhánh email có và không có, để thời gian phản hồi vẫn như nhau.
- **Decorator trên controller:** `@AuditEvent(EVENT, { conditional? })` khai báo sự kiện route này phải sinh ra; `@NoAudit('lý do')` cho route ghi dữ liệu nhưng cố ý không có sự kiện. Thay cho `SKIP_LOG_ROUTES`.
- **`AuditVerifierInterceptor`**: không ghi gì, chỉ kiểm tra. Route khai báo `@AuditEvent(X)` trả 2xx mà `X` không được ghi trong request đó: môi trường test trả 500 (e2e fail), production ghi `logger.error`. `conditional: true` (ví dụ form công khai nộp trùng không tạo hồ sơ) thì bỏ qua kiểm tra.
- Quy tắc "tham số đường dẫn phải tên `:id`" **bị bỏ**: `entity_id` do service truyền vào.
- Bỏ `sanitize-payload.ts`: không còn lưu request body. `data` là allowlist theo kiểu, `audit_row_changes` theo chính sách cột.

## 9. API đọc

Quyền đổi tên theo quy ước `domain.entity.action`: `audit.event.view`, `audit.event.export` (thay `activity_log.list.*`). Trước mắt chỉ Admin _(phạm vi người đọc chờ xác nhận, mục 12)_.

| Route                           | Quyền                | Mô tả                                                                                                                                          |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /audit-events`             | `audit.event.view`   | Phân trang; lọc `event`, `entityType`, `entityId`, `actorId`, `origin`, `from`/`to`; `search` trên tên người thực hiện; `sortBy`: `occurredAt` |
| `GET /audit-events/export`      | `audit.event.export` | CSV tối đa 10.000 dòng, BOM UTF-8, tiêu đề tiếng Việt; tự sinh `AUDIT_LOG_EXPORTED`                                                            |
| `GET /audit-events/:id`         | `audit.event.view`   | Chi tiết sự kiện + các `audit_row_changes` cùng `tx_id`                                                                                        |
| `GET /requisitions/:id/history` | như hiện tại         | đọc từ `audit_events` của yêu cầu đó, bỏ `REQUISITION_EVENTS`                                                                                  |

Nhãn tiếng Việt của từng sự kiện nằm ở shared-types, web dùng chung.

## 10. Seed, migration và e2e

- **Migration** (hai file, xem mục 13): file đầu tạo hai bảng, hai hàm trigger, gắn trigger, cấp quyền cho `DB_APP_ROLE`; file sau xóa `activity_logs` và bật chặn `HF001`. Chứng minh cả `up` lẫn `down` trên DB rỗng.
- **Seed** chạy bằng role owner với `hiflow.actor_id` = system user, `origin = 'seed'`. `seed:demo` ghi thêm `audit_events` lùi ngày khớp với lịch sử đã seed (tạo, gửi, duyệt yêu cầu; đăng tin; đổi trạng thái hồ sơ). `--reset` bật `hiflow.purge` để xóa dấu vết demo cũ.
- **e2e:**
  - App e2e chạy bằng `hiflow_app`, đúng như production.
  - Helper mới `maintenance` (kết nối `DATABASE_OWNER_URL`) dùng cho `seedBase`, dữ liệu dựng tay bằng SQL và dọn dẹp. Mọi truy vấn ghi trực tiếp hiện có trong test (khoảng 50 chỗ ở 14 file) chuyển sang helper này.
  - App e2e chạy với `AUDIT_ORIGIN=e2e`. Global teardown xóa mọi dòng audit `origin = 'e2e'` (bật `hiflow.purge`). Chạy dở bị ngắt thì lần sau dọn nốt. Không sợ xóa nhầm hoạt động dev đang chạy song song vì chúng có `origin = 'app'`.
  - `flow.cleanup()` xóa dữ liệu nghiệp vụ với `hiflow.capture = 'off'`, không còn tự dò `activity_logs`.

## 11. Test

- **Unit:** kiểu danh mục sự kiện (không có sự kiện trùng tên, mọi sự kiện có nhãn); `TxRunner` đặt đủ biến `hiflow.*`; verifier (thiếu sự kiện → lỗi, `conditional` → bỏ qua, không phải 2xx → bỏ qua).
- **e2e hạ tầng** (`audit-db.e2e-spec.ts`):
  - ghi ngoài `TxRunner` bằng `hiflow_app` → `HF001`;
  - `hiflow_app` UPDATE/DELETE bảng audit → bị từ chối;
  - owner DELETE không bật purge → bị từ chối;
  - `capture = 'off'` từ `hiflow_app` → vẫn ghi;
  - UPDATE chỉ đổi `updated_at` → không có dòng;
  - `password_hash` luôn là `[REDACTED]`;
  - thao tác lỗi giữa chừng → rollback cả sự kiện lẫn thay đổi dòng.
- **e2e sự kiện:** mỗi sự kiện trong danh mục có ít nhất một test chứng minh nó được ghi với đúng `actor`, `entity`, `data` và nối được với thay đổi dòng qua `tx_id`.
- **e2e metadata** (mở rộng bộ duyệt route của `rbac-matrix`): mọi route POST/PUT/PATCH/DELETE có `@AuditEvent` hoặc `@NoAudit`; mọi sự kiện trong danh mục được ít nhất một route hoặc service khai báo.
- **Khởi động:** app từ chối boot khi role có quyền DELETE trên bảng audit.

## 12. Quyết định

**Đã chốt (2026-09-27):**

1. Làm lại triệt để, bỏ interceptor.
2. Xóa `activity_logs`, `seed:demo` sinh lại sự kiện.
3. Tách role DB; e2e dọn dấu vết của mình bằng role owner.
4. Không làm chuỗi băm (hash chain) lúc này; thêm được về sau mà không đổi thiết kế.

**Chờ xác nhận:**

| #   | Câu hỏi                                                                                                   | Mặc định đang dùng | Phải chốt trước               |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------- |
| A   | Dữ liệu cá nhân trong `audit_row_changes` lưu giá trị thật (không che), bảo vệ bằng phân quyền và hạn lưu | lưu giá trị thật   | **commit migration**          |
| B   | Lưu IP và user-agent? Giữ bao lâu?                                                                        | lưu, 12 tháng      | commit `RequestContext`       |
| C   | Form công khai sinh `APPLICATION_SUBMITTED_ONLINE` (actor = system user, chỉ id)?                         | có                 | commit chuyển module `public` |
| D   | Ai đọc: toàn bộ nhật ký chỉ Admin; timeline theo đối tượng cho người xem được đối tượng đó?               | chỉ Admin          | commit API đọc                |
| E   | `AUTH_LOGIN_FAILED` với email không tồn tại: lưu email đã nhập không?                                     | không lưu          | commit sự kiện phiên          |

## 13. Thứ tự commit

1. `feat(types)`: danh mục sự kiện, nhãn, thêm quyền `audit.event.*` (quyền `activity_log.*` cũ giữ đến bước 7).
2. `feat(api)`: role, migration (bảng, trigger, quyền; **chưa** xóa `activity_logs`), kiểm tra lúc khởi động, `DATABASE_OWNER_URL`, helper `maintenance` cho e2e.
3. `feat(api)`: `RequestContext`, `TxRunner`, `AuditService`, decorator, verifier.
4. Mỗi module một commit chuyển sang `TxRunner` + `record`: users/profile/auth, departments/positions, requisitions, jobs, candidates, applications + offers, interviews, public.
5. `feat(api)`: API đọc, export, lịch sử yêu cầu tuyển dụng.
6. `feat(api)`: seed ghi sự kiện, `--reset` dọn dấu vết.
7. `refactor(api)`: migration thứ hai xóa `activity_logs` và bật chặn `HF001`; gỡ interceptor, `activity-logs`, `sanitize-payload`, quyền `activity_log.*`; cập nhật `business-flow.md` mục 5–7, CLAUDE.md (bỏ quy tắc `:id`, thêm quy tắc audit, biến môi trường, helper e2e); xóa `activity-log-spec.md`.

Mỗi commit phải để suite xanh:

- Bước 2 tạo trigger ở chế độ "ghi nhưng không chặn" (ghi thiếu ngữ cảnh thì `origin = 'maintenance'`). Bước 7 mới bật chặn `HF001`, khi mọi module đã chuyển xong.
- Interceptor và `activity_logs` cũ chạy song song đến bước 7.
- Từ bước 2, app e2e đã chạy bằng `hiflow_app`, nên mọi test ghi trực tiếp phải chuyển sang helper `maintenance` ngay trong commit đó.
