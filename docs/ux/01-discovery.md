# UX 1: Khám phá và nghiên cứu

> Giai đoạn 1 của quy trình UX. Viết ngày 2026-09-27.
> **Phương pháp:** nghiên cứu tại bàn (desk research). Dự án không tiếp cận được người dùng thật, nên persona ở mục 4 là **proto-persona**: dựng từ nghiệp vụ đã cài đặt (`docs/business-flow.md`), ma trận quyền (`packages/shared-types`) và số liệu công khai. Mọi giả định được đánh dấu để kiểm chứng ở giai đoạn 5.

## 1. Vấn đề cần giải quyết

Một công ty vừa và nhỏ tuyển dụng bằng email, bảng tính và tin nhắn. Hệ quả thường gặp:

- Yêu cầu tuyển dụng của phòng ban đi qua email, không biết đang chờ ai duyệt.
- CV nằm rải rác trong hộp thư; một ứng viên nộp hai lần thành hai dòng trong bảng tính.
- Xếp lịch phỏng vấn bằng tin nhắn, dễ trùng giờ người phỏng vấn; kết quả phỏng vấn trả lời miệng, không lưu.
- Không trả lời được câu hỏi "tháng này tuyển được bao nhiêu người, nguồn nào hiệu quả".

**Mục tiêu của Hiflow:** một chuỗi duy nhất từ yêu cầu tuyển dụng tới nhận việc, mỗi bước có người chịu trách nhiệm, có lịch sử, và mỗi vai trò chỉ thấy việc của mình.

## 2. Nỗi đau đã được ghi nhận (số liệu công khai)

> Phần lớn số liệu là của thị trường Mỹ và toàn cầu, lấy qua trang tổng hợp (nguồn thứ cấp), chưa đối chiếu bản gốc. Báo cáo thị trường Việt Nam của TopCV 2025–2026 (khảo sát hơn 3 000 doanh nghiệp và người lao động) chỉ công bố cho người đăng ký, nên chưa có số liệu Việt Nam tương ứng.
>
> **Hạn chế khi áp dụng vào Việt Nam:** hành vi ứng viên và nhà tuyển dụng ở Việt Nam khác thị trường Mỹ. Liên hệ trực tiếp qua điện thoại và Zalo phổ biến hơn là chờ email từ hệ thống tuyển dụng. Vì vậy các số liệu dưới đây chỉ dùng để định hướng ưu tiên, không dùng làm cam kết định lượng; các phát hiện về email và "im lặng" cần kiểm chứng bằng phỏng vấn người dùng Việt Nam (mục 6).

### 2.1 Phía người tuyển dụng

| Phát hiện                                                                                                                     | Nguồn                                                                                                                 | Ý nghĩa cho Hiflow                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nhà tuyển dụng tốn trung bình 17,7 giờ việc hành chính cho mỗi vị trí (khảo sát 748 lãnh đạo HR của Totaljobs)                | [Shortlistd](<https://www.shortlistd.io/blog/why-recruiters-spend-80-of-time-on-admin-work-(and-how-to-fix-it)>)      | Mỗi thao tác lặp phải ngắn: chuyển trạng thái một bước, không nhập lại dữ liệu  |
| 45 % lãnh đạo tuyển dụng dành hơn nửa thời gian cho việc hành chính có thể tự động hóa (SmartRecruiters 2024, 533 người)      | [Kinematic Labs](https://www.kinematiclabs.dev/blog/staffing/recruiters-spending-time-on-admin-work)                  | Tổng quan phải chỉ ra việc cần làm, không bắt người dùng tự đi tìm              |
| 67 % nhà tuyển dụng mất 30 phút tới 2 giờ để xếp **một** buổi phỏng vấn                                                       | [Shortlistd](<https://www.shortlistd.io/blog/why-recruiters-spend-80-of-time-on-admin-work-(and-how-to-fix-it)>)      | Form đặt lịch báo trùng giờ ngay (quy tắc 60 phút) thay vì để người dùng tự dò  |
| Hệ thống rời rạc gây nhập lại dữ liệu và **trùng hồ sơ ứng viên**                                                             | DirectEmployers, bài về lỗi tích hợp giữa ATS và hệ thống nhân sự (blog của directemployers.org, truy cập 2026-09-27) | Hiflow gắn hồ sơ mới vào ứng viên cũ theo email (đã cài)                        |
| Người dùng Workable phàn nàn về bộ lọc tìm ứng viên chưa đủ chi tiết và báo cáo khó tùy biến                                  | [Treegarden](https://treegarden.io/blog/workable-review-2026/)                                                        | Mọi danh sách có tìm kiếm, lọc, sắp xếp, trạng thái lọc lưu trên URL            |
| Người phỏng vấn chậm gửi nhận xét là điểm nghẽn phổ biến; các ATS đầu ngành làm form nhận xét ngắn, dùng được trên điện thoại | [US Tech Automations](https://ustechautomations.com/resources/blog/interview-feedback-collection-automation)          | Nhập kết quả phỏng vấn chỉ gồm Đạt/Không đạt và nhận xét, làm được trên màn nhỏ |

### 2.2 Phía ứng viên

| Phát hiện                                                                                                                                                       | Nguồn                                                                     | Ý nghĩa cho Hiflow                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đơn ứng tuyển dưới 5 phút có tỷ lệ hoàn thành 12,47 %; trên 15 phút chỉ 3,61 % (Appcast 2025, 379 triệu lượt nhấp)                                              | [Pin](https://www.pin.com/blog/applicant-drop-off-rates/)                 | Form công khai giữ tối thiểu: họ tên, email, điện thoại, CV, đồng ý (đã cài)                                                                                                                                 |
| 60 % người lao động từng bỏ dở đơn ứng tuyển; 50 % vì form quá dài, 31 % vì không minh bạch lương (iCIMS 2025)                                                  | [Pin](https://www.pin.com/blog/applicant-drop-off-rates/)                 | Tin công khai hiện mức lương (đã cài)                                                                                                                                                                        |
| 70 % tổ chức đăng khoảng lương nhận được nhiều ứng viên hơn (SHRM 2025)                                                                                         | [Pin](https://www.pin.com/blog/applicant-drop-off-rates/)                 | Như trên                                                                                                                                                                                                     |
| 59 % người tìm việc coi việc bị nhà tuyển dụng "im lặng" là khó khăn lớn nhất (iHire 2025); 34 % nghĩ mình bị bỏ rơi sau một tuần không tin tức (Criteria 2024) | [Pin](https://www.pin.com/blog/applicant-drop-off-rates/)                 | Hiflow chỉ gửi email xác nhận khi nhận hồ sơ. Giảm "im lặng" bằng nội dung trang cảm ơn và email (bước tiếp theo, thời gian dự kiến, nhắc để ý điện thoại); email theo từng bước là hướng phát triển (mục 5) |
| Khoảng 70 % đơn ứng tuyển được làm trên điện thoại                                                                                                              | [RecruitBPM](https://recruitbpm.com/blog/candidate-experience-statistics) | Cổng công khai phải thiết kế cho điện thoại trước                                                                                                                                                            |

## 3. Phân tích đối thủ

### 3.1 Các sản phẩm được xem

Nguồn tiếng Việt được ghi bằng tên trang và ngày truy cập, không dán liên kết, vì kho mã này không chứa tên miền của dự án khác (quét rò rỉ ở pre-commit chặn).

| Sản phẩm                 | Thị trường | Điểm nổi bật về quy trình                                                                                                                                                                                              | Nguồn                                                                                                                                                                            |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base E-Hiring**        | Việt Nam   | Định biên và kế hoạch tuyển dụng có phê duyệt; đăng tin sang nhiều trang việc làm Việt Nam; pipeline tùy biến; email tự động theo từng bước; kho ứng viên; phát hiện trùng; tiêu chí đánh giá; phân quyền theo vai trò | Trang trợ giúp Base E-Hiring, bài "Giới thiệu chung về app và mục lục tính năng"; trang giới thiệu sản phẩm Base E-Hiring (truy cập 2026-09-27)                                  |
| **MISA AMIS Tuyển dụng** | Việt Nam   | Trưởng bộ phận lập đề xuất, cấp trên duyệt rồi HR mới tạo tin; nằm trong bộ nhân sự AMIS                                                                                                                               | Trang trợ giúp MISA AMIS, bài "Tạo và đăng tin tuyển dụng"; trang giới thiệu AMIS Tuyển dụng (truy cập 2026-09-27)                                                               |
| **Greenhouse**           | Toàn cầu   | Tuyển dụng có cấu trúc: kế hoạch phỏng vấn, bộ câu hỏi và phiếu chấm cho từng người phỏng vấn; phê duyệt tin và offer                                                                                                  | [Greenhouse Support](https://support.greenhouse.io/hc/en-us/articles/115002226746-Interview-kit-overview), [Greenhouse](https://www.greenhouse.com/interviewing-decision-making) |
| **Workable**             | Toàn cầu   | Bảng Kanban kéo thả giữa các bậc; bậc tùy biến theo tin, được bỏ qua bậc; cập nhật thời gian thực cho cả nhóm                                                                                                          | [Workable Help](https://help.workable.com/hc/en-us/articles/115011967408-Customizing-the-recruiting-pipeline)                                                                    |
| **Lever**                | Toàn cầu   | Form nhận xét phỏng vấn có điều kiện theo vòng và vai trò người phỏng vấn                                                                                                                                              | [US Tech Automations](https://ustechautomations.com/resources/blog/interview-feedback-automation-comparison-best-tools)                                                          |

### 3.2 So sánh với Hiflow

| Tiêu chí                        | Base                    | AMIS     | Greenhouse             | Workable              | **Hiflow**                        |
| ------------------------------- | ----------------------- | -------- | ---------------------- | --------------------- | --------------------------------- |
| Yêu cầu tuyển dụng có phê duyệt | Có                      | Có       | Có                     | Không rõ              | **Có, một cấp**                   |
| Bậc hồ sơ                       | Tùy biến                | Không rõ | Tùy biến               | Tùy biến, bỏ bậc được | **Cố định 5 bậc, không nhảy bậc** |
| Cách xem pipeline               | Pipeline và dashboard   | Không rõ | Không rõ               | Kanban kéo thả        | **Bảng có lọc theo trạng thái**   |
| Email cho ứng viên              | Tự động theo bước       | Không rõ | Có                     | Có                    | **Chỉ email xác nhận nhận hồ sơ** |
| Đánh giá phỏng vấn              | Tiêu chí, tổng hợp điểm | Không rõ | Phiếu chấm có cấu trúc | Phiếu chấm            | **Đạt/Không đạt và nhận xét**     |
| Đăng tin                        | Nhiều trang việc làm    | Có       | Có                     | Có                    | **Cổng công khai riêng**          |
| Phạm vi dữ liệu theo phòng ban  | Có phân quyền           | Không rõ | Có                     | Hạn chế               | **Có, ngoài phạm vi trả 404**     |
| Nhật ký hoạt động               | Có                      | Không rõ | Có                     | Không rõ              | **Có, chỉ Admin**                 |

"Không rõ" nghĩa là nguồn công khai đã xem không nói tới, không có nghĩa là sản phẩm thiếu.

### 3.3 Rút ra cho Hiflow

**Học theo (nằm trong phạm vi đã cài):**

- Luồng "trưởng bộ phận đề xuất, HR duyệt, tuyển dụng tạo tin" giống AMIS và Base. Đây là quy trình quen thuộc với doanh nghiệp Việt Nam, nên giữ nguyên nhãn và thứ tự này trên giao diện.
- Greenhouse đưa đủ thông tin cho người phỏng vấn ở một chỗ. Màn chi tiết lịch phỏng vấn của Hiflow gom CV, tin tuyển dụng và form nhập kết quả vào một trang; trên màn hình nhỏ chia thành ba tab (Kết quả, CV, Tin) thay vì một cột dài (xem `02-define.md` mục 2.5).
- Workable cho thấy trạng thái pipeline phải nhìn được ngay. Tổng quan của Hiflow có phễu và danh sách việc cần xử lý; danh sách hồ sơ lọc sẵn theo bậc.

**Tránh:**

- Pipeline tùy biến làm phức tạp cấu hình và báo cáo; Hiflow cố ý giữ 5 bậc cố định, nên phễu so sánh được giữa các tin.
- Kéo thả tự do dễ bấm nhầm. Hiflow chỉ hiện nút cho các bậc kế tiếp hợp lệ (`APPLICATION_TRANSITIONS`), và từ chối phải nhập lý do.
- Điểm yếu của pipeline cố định: ứng viên được giới thiệu cũng phải đi qua Sàng lọc. Chấp nhận để phễu so sánh được; đường tắt là hướng phát triển.

**Cố ý chưa làm (ngoài phạm vi đồ án, ghi vào phần hướng phát triển):**

- Email tự động theo từng bước (mời phỏng vấn, từ chối, offer). Đây là điểm yếu đã biết: ứng viên chỉ nhận một email xác nhận.
- Đường tắt bỏ qua bậc Sàng lọc cho ứng viên được giới thiệu.
- Phiếu chấm phỏng vấn có tiêu chí.
- Đăng tin sang trang việc làm bên ngoài; kho ứng viên có gắn thẻ.
- Kanban kéo thả.

## 4. Proto-persona

Năm vai trò của hệ thống cộng thêm ứng viên. Quyền lấy từ `ROLE_PERMISSIONS`; phần "giả định" là điều cần kiểm chứng.

### P1. Chị Lan, chuyên viên tuyển dụng (RECRUITER), người dùng chính

- **Bối cảnh:** 27 tuổi, phụ trách 8–12 vị trí cùng lúc. Dùng máy tính cả ngày, điện thoại khi đi họp.
- **Mục tiêu:** đưa ứng viên phù hợp tới Nhận việc nhanh; không để hồ sơ nào bị bỏ quên.
- **Việc thường làm:** tạo và đăng tin từ yêu cầu đã duyệt; nhận hồ sơ từ website và tự nhập ứng viên; sàng lọc; xếp lịch phỏng vấn; theo dõi kết quả; lập offer và ghi phản hồi.
- **Nỗi đau:** mất thời gian xếp lịch vì không biết người phỏng vấn bận hay rảnh; phải hỏi lại kết quả phỏng vấn; không nhớ hồ sơ nào đang chờ mình.
- **Cần ở Hiflow:** Tổng quan liệt kê hồ sơ mới chưa có người phụ trách, phỏng vấn hôm nay, offer sắp hết hạn; báo trùng lịch ngay khi đặt; nút chuyển bậc chỉ hiện bước hợp lệ.
- **Màn dùng nhiều nhất:** Hồ sơ ứng tuyển, Lịch phỏng vấn, Tổng quan.
- **Giả định:** dùng máy tính là chính; muốn thao tác hàng loạt (Hiflow chưa có).

### P2. Anh Minh, trưởng phòng Kỹ thuật (DEPT_MANAGER)

- **Bối cảnh:** 38 tuổi, quản lý 15 người, tuyển 2–3 lần mỗi quý. Vào hệ thống vài lần mỗi tháng.
- **Mục tiêu:** có người đúng hạn mà không phải theo dõi tuyển dụng hằng ngày.
- **Việc thường làm:** tạo yêu cầu tuyển dụng, gửi duyệt, sửa lại khi bị từ chối; xem tin và hồ sơ của phòng mình; có thể được xếp làm người phỏng vấn.
- **Nỗi đau:** không biết yêu cầu đang chờ ai; ít dùng nên quên thao tác.
- **Cần ở Hiflow:** form yêu cầu ngắn, có lưu nháp; thấy rõ trạng thái và lý do từ chối; timeline xử lý yêu cầu.
- **Màn dùng nhiều nhất:** Yêu cầu tuyển dụng, Tổng quan (chỉ số liệu phòng mình).
- **Giả định:** người dùng không thường xuyên, nên cần giao diện tự giải thích, ít bước.

### P3. Chị Hạnh, trưởng phòng Nhân sự (HR_MANAGER)

- **Bối cảnh:** 40 tuổi, chịu trách nhiệm ngân sách nhân sự toàn công ty, báo cáo cho ban giám đốc.
- **Mục tiêu:** kiểm soát số lượng tuyển; có số liệu tuyển dụng theo kỳ.
- **Việc thường làm:** duyệt, từ chối (kèm lý do) hoặc đóng yêu cầu; quản lý tài khoản; xem báo cáo, xuất CSV.
- **Nỗi đau:** yêu cầu tới qua nhiều kênh; tổng hợp báo cáo bằng tay.
- **Cần ở Hiflow:** danh sách yêu cầu chờ duyệt ngay ở Tổng quan; duyệt ngay trên trang chi tiết; ba báo cáo có bộ lọc và xuất tệp.
- **Màn dùng nhiều nhất:** Yêu cầu tuyển dụng, Báo cáo, Người dùng.
- **Giả định:** chỉ xem hồ sơ và ứng viên, không thao tác; không cần xem offer (theo quyền hiện tại).

### P4. Anh Tuấn, kỹ sư được mời phỏng vấn (INTERVIEWER)

- **Bối cảnh:** 30 tuổi, phỏng vấn 2–4 buổi mỗi tháng, xen giữa việc chính. Hay mở hệ thống trên điện thoại ngay trước buổi phỏng vấn.
- **Mục tiêu:** đọc CV nhanh trước buổi; ghi kết quả xong trong vài phút.
- **Việc thường làm:** xem lịch của mình, mở CV, nhập Đạt hoặc Không đạt kèm nhận xét.
- **Nỗi đau:** thông tin buổi phỏng vấn nằm rải rác; quên nhập kết quả.
- **Cần ở Hiflow:** đăng nhập xong vào thẳng danh sách lịch của mình (vai trò này không có Tổng quan); một trang đủ CV, tin và form kết quả; dùng được trên điện thoại.
- **Màn dùng nhiều nhất:** Lịch phỏng vấn (chỉ lịch của mình).
- **Giả định:** không có nhắc lịch qua email; người dùng dựa vào lịch riêng của họ.

### P5. Anh Khoa, quản trị hệ thống (ADMIN)

- **Bối cảnh:** người dùng kỹ thuật, số lượng ít.
- **Mục tiêu:** hệ thống chạy đúng, truy được ai làm gì.
- **Việc thường làm:** danh mục phòng ban và vị trí, tài khoản, nhật ký hoạt động; xử lý thay khi người khác vắng.
- **Cần ở Hiflow:** nhật ký lọc theo người, thao tác, thời gian; xuất nhật ký.

### P6. Bạn Vy, ứng viên (không đăng nhập)

- **Bối cảnh:** 24 tuổi, tìm việc trên điện thoại, nộp nhiều nơi cùng lúc, CV dạng PDF.
- **Mục tiêu:** biết tin có hợp với mình không (lương, địa điểm) và nộp nhanh.
- **Hành trình:** thấy tin, đọc mô tả và lương, điền form, đính CV, nhận email xác nhận, chờ liên hệ.
- **Nỗi đau:** form dài; không biết hồ sơ đã tới chưa; chờ lâu không tin tức.
- **Cần ở Hiflow:** trang tin đọc tốt trên điện thoại, có lương; form 5 trường; thông báo rõ khi tệp sai định dạng hoặc quá 5 MB; email xác nhận.
- **Giả định:** các bước sau (mời phỏng vấn, kết quả) được báo qua điện thoại hoặc email ngoài hệ thống.

## 5. Phát hiện cần xử lý trước khi thiết kế chi tiết

Đối chiếu persona với quyền và dữ liệu thật trong code:

1. **Trưởng bộ phận và HR được xếp làm người phỏng vấn nhưng không nhập được kết quả.** `INTERVIEWER_ROLES` gồm INTERVIEWER, DEPT_MANAGER, HR_MANAGER (`apps/api/src/modules/interviews/interviews.constants.ts`), nhưng quyền `interview.result.record` chỉ có ở INTERVIEWER (và ADMIN). DEPT_MANAGER còn không có `interview.list.view`, nên không thấy được lịch của chính mình. Hiện chỉ Admin nhập thay được.
2. **Phỏng vấn viên không có Tổng quan.** Danh sách chức năng 1.1.2.1 ghi "đăng nhập thành công, chuyển tới Tổng quan", nhưng vai trò này thiếu `dashboard.overview.view`. Cần một trang đích theo vai trò (đề xuất: Lịch phỏng vấn).
3. **Tổng quan của Trưởng bộ phận không có việc cần xử lý.** Cả bốn loại việc (duyệt yêu cầu, hồ sơ chưa phân công, phỏng vấn hôm nay, offer sắp hết hạn) đều cần quyền mà vai trò này không có, nên danh sách luôn trống. Việc thật của họ là "yêu cầu bị từ chối cần sửa".
4. **Tuyển dụng chưa chọn được người phỏng vấn và người phụ trách**, vì thiếu `user.list.view`. Kế hoạch giai đoạn B đã có mốc B6 cho việc này.
5. **Ứng viên không nhận được tin gì sau email xác nhận** (nỗi đau số 1 của người tìm việc theo mục 2.2). Ngoài phạm vi hiện tại; ghi vào hướng phát triển.

Cách xử lý từng mục đã được chốt ngày 2026-10-02 (`02-define.md` mục 4) và ghi vào `business-flow.md` mục 7; phần cần sửa backend nằm ở `02-define.md` mục 5. Với mục 5 ở trên, ứng viên được giảm bớt cảm giác bị bỏ rơi bằng nội dung trang cảm ơn và email xác nhận, không thêm email mới.

## 6. Kiểm chứng sau này

Khi có điều kiện gặp người dùng (hoặc nhờ bạn cùng lớp đóng vai theo persona), kiểm tra các giả định bằng 5 câu hỏi cho mỗi vai trò:

1. Lần gần nhất anh/chị làm việc này, anh/chị đã làm những bước nào, bằng công cụ gì?
2. Bước nào tốn thời gian hoặc hay sai nhất?
3. Anh/chị cần biết gì đầu tiên khi mở hệ thống mỗi sáng?
4. Anh/chị dùng máy tính hay điện thoại cho việc này?
5. Nếu chỉ sửa được một điều, anh/chị sửa điều gì?

Kết quả dùng để sửa persona ở mục 4, rồi làm đầu vào cho kiểm thử người dùng (giai đoạn 5).
