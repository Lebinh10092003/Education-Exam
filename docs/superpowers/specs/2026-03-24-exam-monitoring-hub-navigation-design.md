# Exam Monitoring Hub Navigation Design

## Goal

Chuyen `Giám sát trực tiếp` thanh submenu cua `Quản lý kỳ thi`, tao mot trang monitoring tong hop rieng cho nhieu ky thi, va xoa artifact tam `.tmp/updated-ui-20260322` neu khong duoc he thong su dung.

## Current State

- Sidebar admin hien co muc `Giám sát trực tiếp` rieng, nhung muc nay dang tro ve `/exams` thay vi mot trang monitoring doc lap.
- Monitoring thuc te hien chi ton tai o muc tung ky thi thong qua `/exams/:id?tab=monitoring` va route cu `/exams/:id/monitor`.
- `ExamManagement` chi hien danh sach ky thi va nut `Monitor` cho tung record.
- `.tmp/updated-ui-20260322` khong co tham chieu nao trong codebase va co the xem la artifact tam.

## Decision

Ap dung huong:

1. `Quản lý kỳ thi` tro thanh nhom dieu huong co submenu.
2. Them route moi `/exams/monitoring` lam monitoring hub tong hop cho nhieu ky thi.
3. Giu monitoring theo tung ky thi trong `ExamDetail` lam workspace drill-down.
4. Xoa `.tmp/updated-ui-20260322` trong cung dot thay doi vi day la artifact khong can cho runtime.

## Information Architecture

### Sidebar Admin

`Quản lý kỳ thi` se khong con la item don.

No se tro thanh mot nhom co hai submenu:

- `Danh sách kỳ thi` -> `/exams`
- `Giám sát trực tiếp` -> `/exams/monitoring`

Yeu cau active state:

- Khi dang o `/exams`, `/exams/create`, `/exams/:id`, `/exams/:id/edit`, `/exams/:id/assign`, hoac `/exams/:id?tab=monitoring`, nhom `Quản lý kỳ thi` duoc xem la active.
- Submenu `Danh sách kỳ thi` active cho cac route quan ly ky thi thong thuong.
- Submenu `Giám sát trực tiếp` active cho `/exams/monitoring`.

### Drill-Down Flow

- Monitoring hub dung de quan sat nhieu ky thi dang mo/proctored cung luc.
- Tu monitoring hub, nguoi dung co the mo workspace monitoring chi tiet cua tung ky thi.
- `ExamDetail` van giu tab `Monitoring` nham phuc vu thao tac sau khi da chon mot ky thi cu the.

## Routing

### New Route

Them route admin moi:

- `/exams/monitoring` -> `ExamMonitoringHub`

### Existing Routes Kept

Giu nguyen:

- `/exams`
- `/exams/:id`
- `/exams/:id?tab=monitoring`
- `/exams/:id/monitor` -> redirect ve `/exams/:id?tab=monitoring`

Khong doi canonical route monitoring theo tung ky thi; monitoring hub la lop dieu huong va tong hop bo sung.

## Monitoring Hub Page

### Purpose

Trang nay tra loi cau hoi: "Ky thi nao dang can giam sat ngay bay gio?"

No khong thay the workspace monitoring chi tiet cua tung ky thi, ma lam bo loc va bang dieu khien cap cao.

### Layout

Trang `/exams/monitoring` se gom:

1. Header:
   - Tieu de `Giám sát trực tiếp`
   - Mo ta ngan ve viec tong hop nhieu ky thi duoc bat proctoring

2. Summary cards:
   - So ky thi dang theo doi
   - Tong so session dang lam bai
   - Tong so canh bao warning/critical moi
   - So ky thi co canh bao critical

3. Filter bar:
   - Search theo ten ky thi/mon hoc
   - Filter subject
   - Filter status (`open`, `paused`, `scheduled` neu co proctoring)
   - Filter muc do canh bao (`all`, `warning`, `critical`, `has alerts`, `quiet`)

4. Monitoring table/cards:
   - Ten ky thi
   - Mon hoc
   - Trang thai
   - So thi sinh dang lam
   - Tong assigned candidates
   - So canh bao moi
   - Muc canh bao cao nhat
   - Thoi diem canh bao gan nhat
   - Action:
     - `Open Monitoring`
     - `Open Exam`

### Behavior

- Default chi hien ky thi `enable_proctoring = true`.
- Uu tien sap xep:
  - Ky thi co critical alert
  - Ky thi co in-progress sessions
  - Sau do moi den thoi gian cap nhat gan nhat
- Auto refresh theo chu ky ngan bang polling; khong mo websocket rieng cho tung ky thi tren hub.

## Backend Data Strategy

### New Aggregate Endpoint

Them mot endpoint admin moi cho hub, vi neu frontend goi monitoring snapshot tung ky thi se thanh N+1 requests:

- `GET /api/v1/proctoring/exams/monitoring/`

Payload de xuat cho tung exam:

- `id`
- `name`
- `subject_name`
- `status`
- `enable_proctoring`
- `total_candidates`
- `in_progress`
- `completed`
- `not_started`
- `alert_count`
- `critical_alert_count`
- `latest_alert_at`
- `latest_alert_message`
- `latest_case_id`

Filters:

- `search`
- `subject`
- `status`
- `severity`

Co the paginated theo pattern hien tai cua repo.

### Why New Endpoint

- Giam request fan-out tu frontend
- Giu logic tong hop warning/critical trong backend
- De test va toi uu query hon
- Phu hop voi hub tong hop nhieu ky thi

## Frontend Component Structure

### Files to Add

- `src/app/pages/ExamMonitoringHub.tsx`
- `src/app/pages/ExamMonitoringHub.test.tsx`

### Files to Modify

- `src/app/routes.ts`
  - them route `/exams/monitoring`
- `src/app/components/layouts/AdminLayout.tsx`
  - doi nav item `Quản lý kỳ thi` thanh nhom submenu
  - bo muc top-level `Giám sát trực tiếp`
- `src/app/i18n/resources/vi/navigation.ts`
- `src/app/i18n/resources/en/navigation.ts`
  - them key cho submenu nhu `examList`, `liveMonitoring`

### Existing Pages Kept Intact

- `src/app/pages/ExamManagement.tsx`
- `src/app/pages/ExamDetail.tsx`
- `src/app/pages/LiveMonitoring.tsx`

Chi can dieu chinh link qua lai de monitoring hub va monitoring tung ky thi noi voi nhau ro rang hon.

## Error Handling

- Neu aggregate endpoint loi, hub hien error banner va cho phep retry.
- Neu khong co ky thi nao du dieu kien, hien empty state ro rang:
  - khong co ky thi proctored
  - hoac khong co ky thi khop bo loc
- Nut `Open Monitoring` chi active khi ky thi co proctoring; neu ky thi chua mo van co the mo `Open Exam`.

## `.tmp` Cleanup

- Xoa `.tmp/updated-ui-20260322`.
- Khong xoa `.playwright-cli` trong scope nay vi nguoi dung chi hoi nghia va tinh can thiet cua no, chua yeu cau xoa.

## Testing

### Frontend

- Route test cho `/exams/monitoring`
- Layout test:
  - `Quản lý kỳ thi` render submenu
  - submenu active state dung
  - muc top-level `Giám sát trực tiếp` khong con ton tai
- Hub page test:
  - render aggregate list
  - filter/search
  - `Open Monitoring` dan den `/exams/:id?tab=monitoring`

### Backend

- API test cho aggregate endpoint
  - chi lay exam co proctoring
  - tinh dung counts va severity summary
  - ho tro filters

## Non-Goals

- Khong thay doi workspace monitoring chi tiet cua tung ky thi ngoai viec noi link voi hub
- Khong dua monitoring hub vao candidate area
- Khong xoa `.playwright-cli` trong dot nay
