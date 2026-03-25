# Chức năng hiện có của hệ thống EduExam

## 1. Phạm vi chức năng hiện tại

Hệ thống hiện có hai nhóm người dùng chính:

- Nhóm quản trị nội bộ: quản trị viên, giám khảo, giám thị.
- Nhóm thí sinh: người được giao thi hoặc luyện tập.

Quyền truy cập thực tế được kiểm soát bởi RBAC ở backend, vì vậy không phải mọi tài khoản nội bộ đều có toàn quyền trên mọi module.

## 2. Chức năng dùng chung toàn hệ thống

### 2.1. Xác thực và tài khoản

- Đăng nhập bằng JWT.
- Tự bootstrap phiên làm việc từ token lưu local.
- Làm mới access token tự động khi hết hạn.
- Quên mật khẩu và đặt lại mật khẩu.
- Xem và cập nhật hồ sơ cá nhân.
- Đổi mật khẩu.

### 2.2. Trải nghiệm hệ thống

- Hỗ trợ tiếng Việt và tiếng Anh.
- Chuyển ngôn ngữ trực tiếp trong giao diện.
- Có bridge dịch thuật cho phần UI cũ.
- Hệ thống thông báo popup/toast.
- Theo dõi thông báo chưa đọc trên header.

### 2.3. Nhật ký và truy vết

- Ghi nhận audit event cho các luồng xác thực, chấm bài, công bố kết quả, giám sát và phân công.
- Có API thống kê audit summary và danh sách audit event.

## 3. Chức năng cổng quản trị

## 3.1. Dashboard

- Xem tổng quan vận hành trực tiếp từ API.
- Hiển thị số lượng thí sinh, kỳ thi đang hoạt động, quy mô ngân hàng câu hỏi và tỷ lệ hoàn thành.
- Hiển thị hoạt động gần đây và cảnh báo tổng quan.

## 3.2. Quản lý người dùng và phân quyền

- Quản lý người dùng.
- Gán vai trò cho người dùng.
- Quản lý role và permission.
- Hỗ trợ import dữ liệu người dùng bằng CSV.
- Kiểm soát trạng thái hoạt động tài khoản.

## 3.3. Quản lý tổ chức học tập

- Quản lý môn học.
- Quản lý nhóm thí sinh.
- Quản lý thành viên nhóm.
- Liên kết người dùng với trường/nhóm phục vụ phân công thi và tài liệu.

## 3.4. Ngân hàng câu hỏi

- Tạo, sửa, xóa câu hỏi.
- Quản lý đáp án, key đáp án và tag.
- Lưu revision cho câu hỏi.
- Import câu hỏi theo lô.
- Kiểm tra tính hợp lệ của dữ liệu import.
- Chặn import nếu dữ liệu không khớp môn học của kỳ thi đang cấu hình.

## 3.5. Quản lý kỳ thi và lớp học

- Quản lý danh sách kỳ thi.
- Hỗ trợ cả kỳ thi và lớp học/học phần trong cùng module quản trị.
- Tạo mới, chỉnh sửa, nhân bản và xóa bản ghi.
- Cấu hình lịch thi, thời lượng, số lần làm, điểm đạt.
- Cấu hình đề gồm câu hỏi cố định và rule random.
- Xem chi tiết kỳ thi theo tab.
- Chuyển sang tab monitoring từ route chuẩn của chi tiết kỳ thi.
- Ẩn tab monitoring khi bài thi không bật proctoring.

## 3.6. Phân công thi

- Gán kỳ thi cho nhóm hoặc đối tượng cụ thể.
- Đồng bộ thông tin được phân công vào danh sách "bài thi của tôi" ở cổng thí sinh.
- Hỗ trợ nhập trực tiếp danh sách học viên/thí sinh cho kỳ thi.

## 3.7. Giám sát thi trực tiếp

- Có màn hình hub để xem toàn bộ kỳ thi đang được giám sát.
- Tìm kiếm và refresh dữ liệu monitoring theo chu kỳ.
- Drill-down từ hub vào workspace giám sát chi tiết của từng kỳ thi.
- Hiển thị trạng thái kết nối và mức độ ổn định của thí sinh.
- Nhận delta realtime qua WebSocket thay vì reload toàn bộ snapshot.

## 3.8. Workspace giám sát chi tiết

- Xem danh sách thí sinh trong kỳ thi đang giám sát.
- Xem webcam local/live theo yêu cầu.
- Chỉ mở webcam live khi giám thị yêu cầu, không phát liên tục mặc định.
- Xem alert vi phạm theo thời gian thực.
- Xem bằng chứng liên kết với từng case vi phạm.
- Mở chi tiết case trực tiếp từ live alert.
- Theo dõi trạng thái webcam publish và screen capture của từng phiên.

## 3.9. Chấm bài

- Quản lý hàng chờ chấm tự luận.
- Chấm tay từng câu trả lời chủ quan.
- Gửi điểm chấm từ giao diện vào backend grading task API.

## 3.10. Kết quả và báo cáo

- Xem dữ liệu kết quả trực tiếp từ backend.
- Xem phân bố điểm và thống kê kết quả.
- Phân biệt trạng thái workflow và publish state.
- Công bố kết quả cho thí sinh.
- Xem báo cáo và xuất dữ liệu kết quả.
- Màn hình kết quả hiện rõ trạng thái đỗ/trượt đã hoàn tất.

## 3.11. Kỷ luật và chứng chỉ

- Xem tổng hợp kỷ luật theo từng kỳ thi.
- Mở bảng xử lý chi tiết theo kỳ thi.
- Xem điểm gốc, mức phạt và điểm sau xử lý.
- Soạn mức phạt nháp ngay trên bảng.
- Duyệt, bác bỏ hoặc đánh dấu không phạt cho từng case.
- Hỗ trợ chọn nhiều dòng và thao tác hàng loạt.
- Cấu hình chính sách xét chứng chỉ theo ngưỡng điểm hoặc tỷ lệ xếp hạng.
- Tính lại kết quả chứng chỉ sau khi đổi chính sách.
- Xuất bảng tổng hợp và danh sách case ra file.

## 3.12. Tài liệu học tập

- Upload tài liệu.
- Quản lý metadata tài liệu.
- Xem preview tài liệu ngay trong giao diện.
- Hỗ trợ luồng xem nội dung cho các định dạng phù hợp.
- Tải file hoặc mở tab mới khi cần.

## 3.13. Thông báo

- Xem danh sách thông báo nội bộ.
- Lọc theo loại và tìm kiếm theo nội dung.
- Đánh dấu đã đọc từng thông báo.
- Đánh dấu đã đọc hàng loạt hoặc toàn bộ.
- Đồng bộ số lượng chưa đọc với header.

## 3.14. Audit và bảo mật

- Xem timeline audit event.
- Xem summary theo nhóm sự kiện.
- Rà soát các hành động liên quan đến auth, grading, results, proctoring và assignment.

## 4. Chức năng cổng thí sinh

## 4.1. Dashboard thí sinh

- Xem tổng quan bài thi được giao.
- Xem kết quả đã công bố.
- Xem tài liệu học tập đang hoạt động.
- Xem nhanh số thông báo chưa đọc.

## 4.2. Bài thi của tôi

- Xem danh sách bài thi đã được giao.
- Tìm kiếm và lọc theo trạng thái hoặc môn học.
- Xem số lượt làm đã dùng/còn lại.
- Nhận biết bài thi có giám sát hay không.
- Mở trang hướng dẫn trước thi.

## 4.3. Hướng dẫn trước khi vào thi

- Xem lịch, thời lượng, số câu, số lượt làm và điểm đạt.
- Hiển thị checklist sẵn sàng trước khi bắt đầu.
- Chỉ cho phép vào thi khi các điều kiện/checklist đã đạt.
- Hỗ trợ resume phiên thi nếu đã có session đang mở.

## 4.4. Làm bài thi

- Tải phiên thi hiện tại từ backend.
- Điều hướng câu hỏi trong phiên làm bài.
- Lưu đáp án theo thao tác người dùng.
- Autosave trong quá trình làm bài.
- Đánh dấu câu để xem lại.
- Nộp bài và xem trạng thái sau nộp.
- Hiển thị kết quả tức thì nếu bài thi cho phép.

## 4.5. Thi có giám sát

- Yêu cầu camera, microphone, screen share và fullscreen trước khi mở bài.
- Khóa không cho vào bài nếu chưa đạt điều kiện giám sát.
- Hiển thị webcam preview của thí sinh.
- Gửi heartbeat định kỳ để backend đánh giá trạng thái kết nối.
- Gửi event khi thoát fullscreen, chuyển tab hoặc có cảnh báo thủ công.
- Tự động chụp và upload bằng chứng webcam/screen khi có vi phạm.
- Chỉ publish webcam live khi có yêu cầu từ giám thị qua control socket.
- Giữ bài thi ở trạng thái khóa nếu fullscreen chưa được khôi phục.

## 4.6. Luyện tập

- Xem catalog đề luyện tập.
- Xem lịch sử các phiên đã luyện.
- Tạo phiên luyện tập mới.
- Làm bài luyện tập với autosave.
- Nộp bài luyện tập.
- Xem review gồm đáp án của mình và đáp án đúng.

## 4.7. Kết quả cá nhân

- Xem danh sách kết quả đã công bố.
- Theo dõi xu hướng kết quả cá nhân.
- Mở trang chi tiết cho từng kết quả.
- Xem điểm, trạng thái chấm và tóm tắt kết quả chi tiết.

## 4.8. Tài liệu học tập

- Xem danh sách tài liệu được phép truy cập.
- Tìm kiếm và lọc theo môn học/loại tài liệu.
- Xem preview trực tiếp trong cổng thí sinh.
- Với tài liệu chỉ xem nội bộ, hệ thống giữ luồng view-only thay vì tải file.

## 4.9. Thông báo

- Xem inbox thông báo dành cho thí sinh.
- Đánh dấu đã đọc từng mục.
- Đánh dấu đã đọc toàn bộ.
- Đồng bộ badge chưa đọc với thanh điều hướng.

## 4.10. Hồ sơ và trợ giúp

- Xem hồ sơ thí sinh.
- Ẩn email nội bộ trong giao diện hồ sơ nếu dữ liệu được nhập từ đăng ký.
- Giữ thông tin đăng ký ở chế độ chỉ đọc khi cần.
- Xem hướng dẫn chuẩn bị thiết bị, trình duyệt và quy tắc trước ngày thi.
- Mở hộp thoại cài đặt cục bộ để đổi ngôn ngữ và giao diện ở cổng thí sinh.

## 5. Chức năng nền và vận hành

### 5.1. Cleanup dữ liệu

- Dọn file bằng chứng giám sát hết hạn.
- Dọn chi tiết phiên luyện tập hết hạn nhưng giữ bản tóm tắt cần thiết.

### 5.2. Đồng bộ vòng đời

- Có lệnh đồng bộ trạng thái kỳ thi dựa trên schedule window.

### 5.3. Dữ liệu demo

- Có thể reset toàn bộ business data local và sinh lại bộ dữ liệu mẫu để kiểm thử đầu cuối.

## 6. Kết luận

Ở trạng thái hiện tại, EduExam không chỉ là hệ thống tạo đề và làm bài thi, mà đã bao phủ gần đủ chuỗi nghiệp vụ:

- quản lý người dùng và phân quyền,
- tổ chức kỳ thi/lớp học,
- ngân hàng câu hỏi,
- phân công và làm bài,
- luyện tập,
- giám sát realtime,
- chấm bài và công bố kết quả,
- xử lý kỷ luật và chứng chỉ,
- tài liệu học tập,
- thông báo và audit vận hành.
