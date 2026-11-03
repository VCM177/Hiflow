# Phụ lục: hợp đồng API cho web

Sinh ngày 2026-11-03 từ bản build thật của API (79 thao tác) và metadata quyền của từng route. **Đây là ảnh chụp**: sau mốc B6 các kiểu này được thay bằng kiểu dùng chung trong `packages/shared-types` (xem `docs/web-plan.md` mục 3.4). Cột "Ai gọi được": Ad = Admin, HR = Quản lý nhân sự, TBP = Trưởng bộ phận, TD = Tuyển dụng, PV = Phỏng vấn viên. Trưởng bộ phận và Phỏng vấn viên còn bị giới hạn phạm vi dữ liệu (ngoài phạm vi trả 404). Tham số có giá trị mặc định là tùy chọn.

## Health

| Route         | Ai gọi được | Sự kiện audit |
| ------------- | ----------- | ------------- |
| `GET /health` | công khai   |               |

## applications

| Route                              | Ai gọi được     | Sự kiện audit                |
| ---------------------------------- | --------------- | ---------------------------- |
| `GET /applications`                | Ad HR TBP TD PV |                              |
| `POST /applications`               | Ad TD           | APPLICATION_CREATED          |
| `GET /applications/:id`            | Ad HR TBP TD PV |                              |
| `DELETE /applications/:id`         | Ad TD           | APPLICATION_DELETED          |
| `GET /applications/:id/cv`         | Ad HR TBP TD PV | APPLICATION_CV_DOWNLOADED    |
| `PATCH /applications/:id/assignee` | Ad TD           | APPLICATION_ASSIGNEE_CHANGED |
| `POST /applications/:id/status`    | Ad TD           | APPLICATION_STATUS_CHANGED   |
| `PUT /applications/:id/note`       | Ad TD           | APPLICATION_NOTE_UPDATED     |

**`GET /applications`**

Tham số truy vấn: `status`: một trong NEW, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED, WITHDRAWN; `jobId`: string/uuid; `candidateId`: string/uuid; `assigneeId`: string/uuid; `departmentId`: string/uuid; `appliedFrom`: string; `appliedTo`: string; `sortBy`: một trong appliedAt, status, candidateName, jobTitle mặc định appliedAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /applications`**

| Trường        | Bắt buộc | Kiểu        | Giới hạn    | Ghi chú                                           |
| ------------- | -------- | ----------- | ----------- | ------------------------------------------------- |
| `candidateId` | có       | string/uuid |             |                                                   |
| `jobId`       | có       | string/uuid |             |                                                   |
| `assigneeId`  |          | string/uuid |             | Defaults to the caller when they are a recruiter. |
| `note`        |          | string      | tối đa 2000 |                                                   |

**`PATCH /applications/:id/assignee`**

| Trường       | Bắt buộc | Kiểu        | Giới hạn | Ghi chú                                                    |
| ------------ | -------- | ----------- | -------- | ---------------------------------------------------------- |
| `assigneeId` | có       | string/uuid |          | `null` removes the assignee; the field itself is required. |

**`POST /applications/:id/status`**

| Trường     | Bắt buộc | Kiểu                                                                   | Giới hạn    | Ghi chú |
| ---------- | -------- | ---------------------------------------------------------------------- | ----------- | ------- |
| `toStatus` | có       | một trong NEW, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED, WITHDRAWN |             |         |
| `note`     |          | string                                                                 | tối đa 1000 |         |

**`PUT /applications/:id/note`**

| Trường | Bắt buộc | Kiểu   | Giới hạn    | Ghi chú                          |
| ------ | -------- | ------ | ----------- | -------------------------------- |
| `note` | có       | string | tối đa 2000 | An empty string clears the note. |

## audit-events

| Route                      | Ai gọi được | Sự kiện audit      |
| -------------------------- | ----------- | ------------------ |
| `GET /audit-events`        | Ad          |                    |
| `GET /audit-events/export` | Ad          | AUDIT_LOG_EXPORTED |
| `GET /audit-events/:id`    | Ad          |                    |

**`GET /audit-events`**

Tham số truy vấn: `sortBy`: chuỗi mặc định occurredAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc; `event`: một trong AUTH_LOGIN_SUCCEEDED, AUTH_LOGIN_FAILED, AUTH_LOGGED_OUT, PROFILE_UPDATED, PASSWORD_CHANGED, USER_CREATED, USER_UPDATED, USER_ROLE_CHANGED, USER_STATUS_CHANGED, USER_PASSWORD_RESET, DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, POSITION_CREATED, POSITION_UPDATED, POSITION_DELETED, REQUISITION_CREATED, REQUISITION_UPDATED, REQUISITION_DELETED, REQUISITION_SUBMITTED, REQUISITION_APPROVED, REQUISITION_REJECTED, REQUISITION_CLOSED, JOB_CREATED, JOB_UPDATED, JOB_DELETED, JOB_PUBLISHED, JOB_STOPPED, CANDIDATE_CREATED, CANDIDATE_UPDATED, CANDIDATE_DELETED, CANDIDATE_NOTE_UPDATED, CANDIDATE_CV_UPLOADED, CANDIDATE_CV_REMOVED, CANDIDATE_CV_DOWNLOADED, CANDIDATE_ANONYMIZED, APPLICATION_CREATED, APPLICATION_SUBMITTED_ONLINE, APPLICATION_NOTE_UPDATED, APPLICATION_ASSIGNEE_CHANGED, APPLICATION_STATUS_CHANGED, APPLICATION_DELETED, APPLICATION_CV_DOWNLOADED, INTERVIEW_SCHEDULED, INTERVIEW_UPDATED, INTERVIEW_CANCELLED, INTERVIEW_RESULT_RECORDED, OFFER_CREATED, OFFER_UPDATED, OFFER_RESPONSE_RECORDED, AUDIT_LOG_EXPORTED, REPORT_EXPORTED; `entityType`: string tối đa 32; `entityId`: string/uuid; `actorId`: string/uuid; `origin`: một trong app, seed, maintenance, e2e; `from`: string; `to`: string

**`GET /audit-events/export`**

Tham số truy vấn: `event`: một trong AUTH_LOGIN_SUCCEEDED, AUTH_LOGIN_FAILED, AUTH_LOGGED_OUT, PROFILE_UPDATED, PASSWORD_CHANGED, USER_CREATED, USER_UPDATED, USER_ROLE_CHANGED, USER_STATUS_CHANGED, USER_PASSWORD_RESET, DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, POSITION_CREATED, POSITION_UPDATED, POSITION_DELETED, REQUISITION_CREATED, REQUISITION_UPDATED, REQUISITION_DELETED, REQUISITION_SUBMITTED, REQUISITION_APPROVED, REQUISITION_REJECTED, REQUISITION_CLOSED, JOB_CREATED, JOB_UPDATED, JOB_DELETED, JOB_PUBLISHED, JOB_STOPPED, CANDIDATE_CREATED, CANDIDATE_UPDATED, CANDIDATE_DELETED, CANDIDATE_NOTE_UPDATED, CANDIDATE_CV_UPLOADED, CANDIDATE_CV_REMOVED, CANDIDATE_CV_DOWNLOADED, CANDIDATE_ANONYMIZED, APPLICATION_CREATED, APPLICATION_SUBMITTED_ONLINE, APPLICATION_NOTE_UPDATED, APPLICATION_ASSIGNEE_CHANGED, APPLICATION_STATUS_CHANGED, APPLICATION_DELETED, APPLICATION_CV_DOWNLOADED, INTERVIEW_SCHEDULED, INTERVIEW_UPDATED, INTERVIEW_CANCELLED, INTERVIEW_RESULT_RECORDED, OFFER_CREATED, OFFER_UPDATED, OFFER_RESPONSE_RECORDED, AUDIT_LOG_EXPORTED, REPORT_EXPORTED; `entityType`: string tối đa 32; `entityId`: string/uuid; `actorId`: string/uuid; `origin`: một trong app, seed, maintenance, e2e; `from`: string; `to`: string

## auth

| Route               | Ai gọi được            | Sự kiện audit        |
| ------------------- | ---------------------- | -------------------- |
| `POST /auth/login`  | công khai              | AUTH_LOGIN_SUCCEEDED |
| `POST /auth/logout` | công khai              | AUTH_LOGGED_OUT      |
| `GET /auth/me`      | mọi người đã đăng nhập |                      |

**`POST /auth/login`**

| Trường     | Bắt buộc | Kiểu         | Giới hạn | Ghi chú |
| ---------- | -------- | ------------ | -------- | ------- |
| `email`    | có       | string/email |          |         |
| `password` | có       | string       |          |         |

## candidates

| Route                            | Ai gọi được | Sự kiện audit           |
| -------------------------------- | ----------- | ----------------------- |
| `GET /candidates`                | Ad HR TD PV |                         |
| `POST /candidates`               | Ad TD       | CANDIDATE_CREATED       |
| `GET /candidates/:id`            | Ad HR TD PV |                         |
| `PATCH /candidates/:id`          | Ad TD       | CANDIDATE_UPDATED       |
| `DELETE /candidates/:id`         | Ad TD       | CANDIDATE_DELETED       |
| `PUT /candidates/:id/note`       | Ad TD       | CANDIDATE_NOTE_UPDATED  |
| `GET /candidates/:id/cv`         | Ad HR TD PV | CANDIDATE_CV_DOWNLOADED |
| `POST /candidates/:id/cv`        | Ad TD       | CANDIDATE_CV_UPLOADED   |
| `DELETE /candidates/:id/cv`      | Ad TD       | CANDIDATE_CV_REMOVED    |
| `POST /candidates/:id/anonymize` | Ad HR       | CANDIDATE_ANONYMIZED    |

**`GET /candidates`**

Tham số truy vấn: `source`: một trong WEBSITE, REFERRAL, SOCIAL, AGENCY, OTHER; `createdFrom`: string; `createdTo`: string; `sortBy`: một trong fullName, email, source, createdAt mặc định createdAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /candidates`**

| Trường     | Bắt buộc | Kiểu                                               | Giới hạn    | Ghi chú |
| ---------- | -------- | -------------------------------------------------- | ----------- | ------- |
| `fullName` | có       | string                                             | tối đa 100  |         |
| `email`    | có       | string/email                                       | tối đa 150  |         |
| `phone`    |          | string                                             |             |         |
| `dob`      |          | string                                             |             |         |
| `source`   |          | một trong WEBSITE, REFERRAL, SOCIAL, AGENCY, OTHER |             |         |
| `note`     |          | string                                             | tối đa 2000 |         |

**`PATCH /candidates/:id`**

| Trường     | Bắt buộc | Kiểu                                               | Giới hạn   | Ghi chú |
| ---------- | -------- | -------------------------------------------------- | ---------- | ------- |
| `fullName` |          | string                                             | tối đa 100 |         |
| `email`    |          | string/email                                       | tối đa 150 |         |
| `phone`    |          | string                                             |            |         |
| `dob`      |          | string                                             |            |         |
| `source`   |          | một trong WEBSITE, REFERRAL, SOCIAL, AGENCY, OTHER |            |         |

**`PUT /candidates/:id/note`**

| Trường | Bắt buộc | Kiểu   | Giới hạn    | Ghi chú                          |
| ------ | -------- | ------ | ----------- | -------------------------------- |
| `note` | có       | string | tối đa 2000 | An empty string clears the note. |

## dashboard

| Route                     | Ai gọi được  | Sự kiện audit |
| ------------------------- | ------------ | ------------- |
| `GET /dashboard/overview` | Ad HR TBP TD |               |

**`GET /dashboard/overview`**

Tham số truy vấn: `from`: string; `to`: string; `departmentId`: string/uuid

## departments

| Route                     | Ai gọi được  | Sự kiện audit      |
| ------------------------- | ------------ | ------------------ |
| `GET /departments`        | Ad HR TBP TD |                    |
| `POST /departments`       | Ad           | DEPARTMENT_CREATED |
| `GET /departments/:id`    | Ad HR TBP TD |                    |
| `PATCH /departments/:id`  | Ad           | DEPARTMENT_UPDATED |
| `DELETE /departments/:id` | Ad           | DEPARTMENT_DELETED |

**`GET /departments`**

Tham số truy vấn: `sortBy`: một trong name, code, createdAt mặc định name; `sortDir`: một trong asc, desc mặc định asc; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100

**`POST /departments`**

| Trường | Bắt buộc | Kiểu   | Giới hạn                   | Ghi chú |
| ------ | -------- | ------ | -------------------------- | ------- |
| `name` | có       | string | tối đa 100                 |         |
| `code` | có       | string | mẫu `^[A-Za-z0-9_]{2,30}$` |         |

**`PATCH /departments/:id`**

| Trường | Bắt buộc | Kiểu   | Giới hạn                   | Ghi chú |
| ------ | -------- | ------ | -------------------------- | ------- |
| `name` |          | string | tối đa 100                 |         |
| `code` |          | string | mẫu `^[A-Za-z0-9_]{2,30}$` |         |

## interviews

| Route                         | Ai gọi được     | Sự kiện audit             |
| ----------------------------- | --------------- | ------------------------- |
| `GET /interviews`             | Ad HR TBP TD PV |                           |
| `POST /interviews`            | Ad TD           | INTERVIEW_SCHEDULED       |
| `GET /interviews/:id`         | Ad HR TBP TD PV |                           |
| `PATCH /interviews/:id`       | Ad TD           | INTERVIEW_UPDATED         |
| `POST /interviews/:id/cancel` | Ad TD           | INTERVIEW_CANCELLED       |
| `POST /interviews/:id/result` | Ad HR TBP PV    | INTERVIEW_RESULT_RECORDED |

**`GET /interviews`**

Tham số truy vấn: `result`: một trong PENDING, PASSED, FAILED, CANCELLED; `applicationId`: string/uuid; `interviewerId`: string/uuid; `round`: number ≥ 1; ≤ 10; `scheduledFrom`: string; `scheduledTo`: string; `sortBy`: một trong scheduledAt, round, result, createdAt mặc định scheduledAt; `sortDir`: một trong asc, desc mặc định asc; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100

**`POST /interviews`**

| Trường          | Bắt buộc | Kiểu        | Giới hạn  | Ghi chú                                                          |
| --------------- | -------- | ----------- | --------- | ---------------------------------------------------------------- |
| `applicationId` | có       | string/uuid |           |                                                                  |
| `interviewerId` | có       | string/uuid |           |                                                                  |
| `scheduledAt`   | có       | string      |           | ISO 8601 with a time and offset, e.g. 2026-10-01T09:00:00+07:00. |
| `round`         |          | number      | ≥ 1; ≤ 10 | Defaults to the next round for the application.                  |

**`PATCH /interviews/:id`**

| Trường          | Bắt buộc | Kiểu        | Giới hạn  | Ghi chú                                                          |
| --------------- | -------- | ----------- | --------- | ---------------------------------------------------------------- |
| `interviewerId` |          | string/uuid |           |                                                                  |
| `scheduledAt`   |          | string      |           | ISO 8601 with a time and offset, e.g. 2026-10-01T09:00:00+07:00. |
| `round`         |          | number      | ≥ 1; ≤ 10 | Defaults to the next round for the application.                  |

**`POST /interviews/:id/result`**

| Trường     | Bắt buộc | Kiểu                     | Giới hạn    | Ghi chú |
| ---------- | -------- | ------------------------ | ----------- | ------- |
| `result`   | có       | một trong PASSED, FAILED |             |         |
| `feedback` |          | string                   | tối đa 2000 |         |

## jobs

| Route                    | Ai gọi được  | Sự kiện audit |
| ------------------------ | ------------ | ------------- |
| `GET /jobs`              | Ad HR TBP TD |               |
| `POST /jobs`             | Ad TD        | JOB_CREATED   |
| `GET /jobs/:id`          | Ad HR TBP TD |               |
| `PATCH /jobs/:id`        | Ad TD        | JOB_UPDATED   |
| `DELETE /jobs/:id`       | Ad TD        | JOB_DELETED   |
| `POST /jobs/:id/publish` | Ad TD        | JOB_PUBLISHED |
| `POST /jobs/:id/stop`    | Ad TD        | JOB_STOPPED   |

**`GET /jobs`**

Tham số truy vấn: `status`: một trong DRAFT, OPEN, CLOSED; `departmentId`: string/uuid; `positionId`: string/uuid; `requisitionId`: string/uuid; `createdFrom`: string; `createdTo`: string; `sortBy`: một trong title, status, quantity, createdAt, publishedAt mặc định createdAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /jobs`**

| Trường          | Bắt buộc | Kiểu        | Giới hạn     | Ghi chú                                  |
| --------------- | -------- | ----------- | ------------ | ---------------------------------------- |
| `requisitionId` | có       | string/uuid |              |                                          |
| `title`         |          | string      | tối đa 200   | Defaults to the requisition's title.     |
| `quantity`      |          | number      | ≥ 1; ≤ 1000  | Defaults to the requisition's headcount. |
| `salaryMin`     |          | number      | ≥ 0          |                                          |
| `salaryMax`     |          | number      | ≥ 0          |                                          |
| `location`      |          | string      | tối đa 200   |                                          |
| `description`   |          | string      | tối đa 20000 |                                          |

**`PATCH /jobs/:id`**

| Trường        | Bắt buộc | Kiểu   | Giới hạn     | Ghi chú                                  |
| ------------- | -------- | ------ | ------------ | ---------------------------------------- |
| `title`       |          | string | tối đa 200   | Defaults to the requisition's title.     |
| `quantity`    |          | number | ≥ 1; ≤ 1000  | Defaults to the requisition's headcount. |
| `salaryMin`   |          | number | ≥ 0          |                                          |
| `salaryMax`   |          | number | ≥ 0          |                                          |
| `location`    |          | string | tối đa 200   |                                          |
| `description` |          | string | tối đa 20000 |                                          |

## offers

| Route                                   | Ai gọi được | Sự kiện audit           |
| --------------------------------------- | ----------- | ----------------------- |
| `GET /applications/:id/offer`           | Ad TD       |                         |
| `POST /applications/:id/offer`          | Ad TD       | OFFER_CREATED           |
| `PATCH /applications/:id/offer`         | Ad TD       | OFFER_UPDATED           |
| `POST /applications/:id/offer/response` | Ad TD       | OFFER_RESPONSE_RECORDED |

**`POST /applications/:id/offer`**

| Trường      | Bắt buộc | Kiểu   | Giới hạn           | Ghi chú                            |
| ----------- | -------- | ------ | ------------------ | ---------------------------------- |
| `salary`    | có       | number | ≥ 1; ≤ 10000000000 | Monthly salary in VND.             |
| `startDate` | có       | string |                    |                                    |
| `expiresAt` |          | string |                    | Last day the candidate may answer. |
| `note`      |          | string | tối đa 2000        |                                    |

**`PATCH /applications/:id/offer`**

| Trường      | Bắt buộc | Kiểu   | Giới hạn           | Ghi chú                            |
| ----------- | -------- | ------ | ------------------ | ---------------------------------- |
| `salary`    |          | number | ≥ 1; ≤ 10000000000 | Monthly salary in VND.             |
| `startDate` |          | string |                    |                                    |
| `expiresAt` |          | string |                    | Last day the candidate may answer. |
| `note`      |          | string | tối đa 2000        |                                    |

**`POST /applications/:id/offer/response`**

| Trường     | Bắt buộc | Kiểu    | Giới hạn    | Ghi chú |
| ---------- | -------- | ------- | ----------- | ------- |
| `accepted` | có       | boolean |             |         |
| `note`     |          | string  | tối đa 1000 |         |

## positions

| Route                   | Ai gọi được  | Sự kiện audit    |
| ----------------------- | ------------ | ---------------- |
| `GET /positions`        | Ad HR TBP TD |                  |
| `POST /positions`       | Ad           | POSITION_CREATED |
| `GET /positions/:id`    | Ad HR TBP TD |                  |
| `PATCH /positions/:id`  | Ad           | POSITION_UPDATED |
| `DELETE /positions/:id` | Ad           | POSITION_DELETED |

**`GET /positions`**

Tham số truy vấn: `sortBy`: một trong name, code, createdAt mặc định name; `sortDir`: một trong asc, desc mặc định asc; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100

**`POST /positions`**

| Trường | Bắt buộc | Kiểu   | Giới hạn                   | Ghi chú |
| ------ | -------- | ------ | -------------------------- | ------- |
| `name` | có       | string | tối đa 100                 |         |
| `code` | có       | string | mẫu `^[A-Za-z0-9_]{2,30}$` |         |

**`PATCH /positions/:id`**

| Trường | Bắt buộc | Kiểu   | Giới hạn                   | Ghi chú |
| ------ | -------- | ------ | -------------------------- | ------- |
| `name` |          | string | tối đa 100                 |         |
| `code` |          | string | mẫu `^[A-Za-z0-9_]{2,30}$` |         |

## profile

| Route                           | Ai gọi được            | Sự kiện audit    |
| ------------------------------- | ---------------------- | ---------------- |
| `GET /profile`                  | mọi người đã đăng nhập |                  |
| `PATCH /profile`                | mọi người đã đăng nhập | PROFILE_UPDATED  |
| `POST /profile/change-password` | mọi người đã đăng nhập | PASSWORD_CHANGED |

**`PATCH /profile`**

| Trường     | Bắt buộc | Kiểu   | Giới hạn   | Ghi chú |
| ---------- | -------- | ------ | ---------- | ------- |
| `fullName` | có       | string | tối đa 100 |         |

**`POST /profile/change-password`**

| Trường            | Bắt buộc | Kiểu   | Giới hạn | Ghi chú |
| ----------------- | -------- | ------ | -------- | ------- |
| `currentPassword` | có       | string |          |         |
| `newPassword`     | có       | string |          |         |

## public

| Route                                | Ai gọi được | Sự kiện audit                |
| ------------------------------------ | ----------- | ---------------------------- |
| `GET /public/jobs`                   | công khai   |                              |
| `GET /public/jobs/:id`               | công khai   |                              |
| `POST /public/jobs/:id/applications` | công khai   | APPLICATION_SUBMITTED_ONLINE |

**`GET /public/jobs`**

Tham số truy vấn: `departmentId`: string/uuid; `sortBy`: một trong publishedAt, title mặc định publishedAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /public/jobs/:id/applications`**

Nội dung `multipart/form-data`: `fullName`: string, `email`: string/email, `phone`: string, `consent`: boolean, `turnstileToken`: string

## reports

| Route                       | Ai gọi được | Sự kiện audit   |
| --------------------------- | ----------- | --------------- |
| `GET /reports/:type`        | Ad HR       |                 |
| `GET /reports/:type/export` | Ad HR       | REPORT_EXPORTED |

**`GET /reports/:type`**

Tham số truy vấn: `from`: string; `to`: string; `departmentId`: string/uuid; `positionId`: string/uuid

**`GET /reports/:type/export`**

Tham số truy vấn: `from`: string; `to`: string; `departmentId`: string/uuid; `positionId`: string/uuid

## requisitions

| Route                            | Ai gọi được  | Sự kiện audit         |
| -------------------------------- | ------------ | --------------------- |
| `GET /requisitions`              | Ad HR TBP TD |                       |
| `POST /requisitions`             | Ad TBP       | REQUISITION_CREATED   |
| `GET /requisitions/:id`          | Ad HR TBP TD |                       |
| `PATCH /requisitions/:id`        | Ad TBP       | REQUISITION_UPDATED   |
| `DELETE /requisitions/:id`       | Ad TBP       | REQUISITION_DELETED   |
| `GET /requisitions/:id/history`  | Ad HR TBP TD |                       |
| `POST /requisitions/:id/submit`  | Ad TBP       | REQUISITION_SUBMITTED |
| `POST /requisitions/:id/approve` | Ad HR        | REQUISITION_APPROVED  |
| `POST /requisitions/:id/reject`  | Ad HR        | REQUISITION_REJECTED  |
| `POST /requisitions/:id/close`   | Ad HR        | REQUISITION_CLOSED    |

**`GET /requisitions`**

Tham số truy vấn: `status`: một trong DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CLOSED; `departmentId`: string/uuid; `createdFrom`: string; `createdTo`: string; `sortBy`: một trong code, title, quantity, status, createdAt mặc định createdAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /requisitions`**

| Trường              | Bắt buộc | Kiểu        | Giới hạn    | Ghi chú                                                                |
| ------------------- | -------- | ----------- | ----------- | ---------------------------------------------------------------------- |
| `title`             | có       | string      | tối đa 200  |                                                                        |
| `departmentId`      |          | string/uuid |             | Ignored for a department manager, whose own department is always used. |
| `positionId`        | có       | string/uuid |             |                                                                        |
| `quantity`          | có       | number      | ≥ 1; ≤ 1000 |                                                                        |
| `reason`            |          | string      | tối đa 2000 |                                                                        |
| `expectedStartDate` |          | string      |             |                                                                        |
| `budgetMin`         |          | number      | ≥ 0         |                                                                        |
| `budgetMax`         |          | number      | ≥ 0         |                                                                        |

**`PATCH /requisitions/:id`**

| Trường              | Bắt buộc | Kiểu        | Giới hạn    | Ghi chú |
| ------------------- | -------- | ----------- | ----------- | ------- |
| `title`             |          | string      | tối đa 200  |         |
| `positionId`        |          | string/uuid |             |         |
| `quantity`          |          | number      | ≥ 1; ≤ 1000 |         |
| `reason`            |          | string      | tối đa 2000 |         |
| `expectedStartDate` |          | string      |             |         |
| `budgetMin`         |          | number      | ≥ 0         |         |
| `budgetMax`         |          | number      | ≥ 0         |         |

**`POST /requisitions/:id/reject`**

| Trường   | Bắt buộc | Kiểu   | Giới hạn    | Ghi chú |
| -------- | -------- | ------ | ----------- | ------- |
| `reason` | có       | string | tối đa 1000 |         |

## users

| Route                            | Ai gọi được | Sự kiện audit       |
| -------------------------------- | ----------- | ------------------- |
| `GET /users`                     | Ad HR       |                     |
| `POST /users`                    | Ad HR       | USER_CREATED        |
| `GET /users/options`             | Ad TD       |                     |
| `GET /users/:id`                 | Ad HR       |                     |
| `PATCH /users/:id`               | Ad HR       | USER_UPDATED        |
| `PATCH /users/:id/role`          | Ad HR       | USER_ROLE_CHANGED   |
| `PATCH /users/:id/status`        | Ad HR       | USER_STATUS_CHANGED |
| `POST /users/:id/reset-password` | Ad HR       | USER_PASSWORD_RESET |

**`GET /users`**

Tham số truy vấn: `role`: một trong ADMIN, HR_MANAGER, DEPT_MANAGER, RECRUITER, INTERVIEWER; `departmentId`: string/uuid; `isActive`: boolean; `sortBy`: một trong fullName, email, role, createdAt mặc định createdAt; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100; `sortDir`: một trong asc, desc mặc định desc

**`POST /users`**

| Trường         | Bắt buộc | Kiểu                                                              | Giới hạn   | Ghi chú |
| -------------- | -------- | ----------------------------------------------------------------- | ---------- | ------- |
| `email`        | có       | string/email                                                      | tối đa 150 |         |
| `fullName`     | có       | string                                                            | tối đa 100 |         |
| `role`         | có       | một trong ADMIN, HR_MANAGER, DEPT_MANAGER, RECRUITER, INTERVIEWER |            |         |
| `departmentId` |          | string/uuid                                                       |            |         |
| `password`     | có       | string                                                            |            |         |

**`GET /users/options`**

Tham số truy vấn: `purpose`: một trong ASSIGNEE, INTERVIEWER; `sortBy`: chuỗi mặc định fullName; `sortDir`: một trong asc, desc mặc định asc; `page`: number ≥ 1; mặc định 1; `limit`: number ≥ 1; ≤ 100; mặc định 10; `search`: string tối đa 100

**`PATCH /users/:id`**

| Trường         | Bắt buộc | Kiểu        | Giới hạn   | Ghi chú                                        |
| -------------- | -------- | ----------- | ---------- | ---------------------------------------------- |
| `fullName`     |          | string      | tối đa 100 |                                                |
| `departmentId` |          | string/uuid |            | `null` removes the user from their department. |

**`PATCH /users/:id/role`**

| Trường | Bắt buộc | Kiểu                                                              | Giới hạn | Ghi chú |
| ------ | -------- | ----------------------------------------------------------------- | -------- | ------- |
| `role` | có       | một trong ADMIN, HR_MANAGER, DEPT_MANAGER, RECRUITER, INTERVIEWER |          |         |

**`PATCH /users/:id/status`**

| Trường     | Bắt buộc | Kiểu    | Giới hạn | Ghi chú |
| ---------- | -------- | ------- | -------- | ------- |
| `isActive` | có       | boolean |          |         |

**`POST /users/:id/reset-password`**

| Trường        | Bắt buộc | Kiểu   | Giới hạn | Ghi chú |
| ------------- | -------- | ------ | -------- | ------- |
| `newPassword` | có       | string |          |         |
