# Tài liệu hệ thống EduExam

Bộ tài liệu này mô tả trạng thái hiện tại của hệ thống dựa trên việc rà soát trực tiếp mã nguồn frontend, backend, cấu hình runtime, route ứng dụng và API hiện có.

Đây là tài liệu hiện trạng hệ thống, không phải tài liệu kế hoạch triển khai.

## Nội dung

- `system-architecture.md`: cấu trúc repo, kiến trúc chạy thực tế, các module chính và luồng tích hợp.
- `system-features.md`: các chức năng hiện có của hệ thống, phân theo cổng quản trị và cổng thí sinh.

## Nguồn rà soát

- Frontend: `src/app/`, `src/styles/`
- Backend: `backend/apps/`, `backend/config/`
- API schema: `backend/openapi.yaml`
- Vận hành local: `README.md`, `backend/docker-compose.yml`

## Ghi chú

- Bộ tài liệu `docs/superpowers/plans` và `docs/superpowers/specs` đã được loại bỏ để tránh trùng lặp với tài liệu hiện trạng.
- Nếu hệ thống tiếp tục thay đổi, cần cập nhật lại hai tài liệu trên thay vì tạo thêm các plan/spec rời trong `docs/`.
