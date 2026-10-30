from __future__ import annotations

import secrets
import shutil
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.academics.models import Subject
from apps.exam_authoring.models import Exam
from apps.exam_authoring.services import create_exam, transition_exam_status
from apps.exam_delivery.services import create_autosave_snapshot, save_session_answer, start_or_resume_session, submit_session
from apps.grading.models import Result
from apps.grading.services import grade_manual_task
from apps.identity.bootstrap import seed_identity_access
from apps.identity.models import Profile, Role, UserRole
from apps.institutions.models import CandidateGroup, GroupMembership, School
from apps.materials.models import Material
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.proctoring.services import (
    create_proctor_evidence,
    record_heartbeat,
    record_proctor_event,
    register_client_capability,
    resolve_violation_case,
)
from apps.question_bank.models import Question
from apps.question_bank.services import create_question, revise_question

from apps.competitions.models import Competition, CompetitionRegistration

from .audit import record_audit_event



def generate_demo_password() -> str:
    """Mat khau ngau nhien cho bo du lieu mau (khong ghi cung trong ma nguon)."""
    return "Fermat-" + secrets.token_urlsafe(9)

DEMO_MEDIA_PREFIX = "demo-seed"


@dataclass
class DemoSeedContext:
    now: object
    password: str = ""
    users: dict[str, object] = field(default_factory=dict)
    schools: dict[str, School] = field(default_factory=dict)
    groups: dict[str, CandidateGroup] = field(default_factory=dict)
    subjects: dict[str, Subject] = field(default_factory=dict)
    questions: dict[str, Question] = field(default_factory=dict)
    exams: dict[str, Exam] = field(default_factory=dict)
    materials: dict[str, Material] = field(default_factory=dict)
    sessions: dict[str, object] = field(default_factory=dict)
    results: dict[str, Result] = field(default_factory=dict)


def seed_full_demo_data(password: str | None = None):
    _purge_demo_seed_media()

    password = password or generate_demo_password()
    context = DemoSeedContext(now=timezone.now(), password=password)
    _seed_users_and_roles(context)
    _seed_institutions(context)
    _seed_subjects(context)
    _seed_question_bank(context)
    _seed_exams(context)
    _seed_materials(context)
    _seed_sessions_results_and_proctoring(context)
    _seed_extra_notifications(context)
    _seed_extra_audit(context)
    _seed_competitions(context)

    return {
        "password": password,
        "credentials": [
            {"label": "Administrator", "email": "admin@example.com", "password": password},
            {"label": "Examiner", "email": "examiner1@example.com", "password": password},
            {"label": "Proctor", "email": "proctor1@example.com", "password": password},
            {"label": "Candidate", "email": "candidate01@example.com", "password": password},
        ],
        "accounts": [
            {
                "label": ", ".join(role.name for role in user.active_roles) or "-",
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
            }
            for user in get_user_model().objects.order_by("id")
        ],
        "counts": {
            "users": get_user_model().objects.count(),
            "schools": School.objects.count(),
            "groups": CandidateGroup.objects.count(),
            "subjects": Subject.objects.count(),
            "questions": Question.objects.count(),
            "exams": Exam.objects.count(),
            "materials": Material.objects.count(),
            "results": Result.objects.count(),
            "notifications": Notification.objects.count(),
            "competitions": Competition.objects.count(),
            "competition_registrations": CompetitionRegistration.objects.count(),
        },
    }


def _purge_demo_seed_media():
    media_root = Path(settings.MEDIA_ROOT)
    demo_root = media_root / DEMO_MEDIA_PREFIX
    if demo_root.exists():
        shutil.rmtree(demo_root, ignore_errors=True)


def _role(slug: str) -> Role:
    return Role.objects.get(slug=slug)


def _assign_roles(user, *role_slugs: str):
    for role_slug in role_slugs:
        user_role, created = UserRole.objects.get_or_create(
            user=user,
            role=_role(role_slug),
            defaults={"is_active": True},
        )
        if not created and not user_role.is_active:
            user_role.is_active = True
            user_role.save(update_fields=["is_active", "updated_at"])


def _create_user(
    context: DemoSeedContext,
    *,
    key: str,
    email: str,
    username: str,
    full_name: str,
    role_slugs: list[str],
    school: School | None = None,
    phone_number: str = "",
    student_class: str = "",
    cccd: str | None = None,
    date_of_birth=None,
    status: str = "active",
    is_staff: bool = False,
    is_superuser: bool = False,
):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        email=email,
        username=username,
        password=context.password,
        full_name=full_name,
        status=status,
        is_staff=is_staff,
        is_superuser=is_superuser,
        is_active=status == "active",
    )
    Profile.objects.create(
        user=user,
        phone_number=phone_number,
        school=school,
        cccd=cccd,
        date_of_birth=date_of_birth,
        student_class=student_class,
    )
    _assign_roles(user, *role_slugs)
    context.users[key] = user
    return user


def _seed_users_and_roles(context: DemoSeedContext):
    user_model = get_user_model()
    admin = user_model.objects.create_user(
        email="admin@example.com",
        username="admin",
        password=context.password,
        full_name="Quản trị hệ thống",
        is_staff=True,
        is_superuser=True,
        status=user_model.Status.ACTIVE,
    )
    Profile.objects.create(user=admin, phone_number="0900000000")
    seed_identity_access(admin_user=admin)
    context.users["admin"] = admin

    north = School.objects.create(
        name="Trường THPT Chuyên Hà Nội - Amsterdam",
        code="HN-AMS",
        description="Trường mẫu cho thí sinh khối 10.",
    )
    south = School.objects.create(
        name="Trường THPT Chu Văn An",
        code="HN-CVA",
        description="Trường mẫu cho thí sinh khối 11.",
    )
    context.schools["north"] = north
    context.schools["south"] = south

    _create_user(
        context,
        key="examiner1",
        email="examiner1@example.com",
        username="examiner1",
        full_name="Trần Minh Đức",
        role_slugs=["examiner"],
        phone_number="0901000001",
        is_staff=True,
    )
    _create_user(
        context,
        key="examiner2",
        email="examiner2@example.com",
        username="examiner2",
        full_name="Nguyễn Thu Hà",
        role_slugs=["examiner"],
        phone_number="0901000002",
        is_staff=True,
    )
    _create_user(
        context,
        key="proctor1",
        email="proctor1@example.com",
        username="proctor1",
        full_name="Lê Anh Tuấn",
        role_slugs=["proctor"],
        phone_number="0901000003",
        is_staff=True,
    )

    candidate_specs = [
        ("candidate01", "candidate01@example.com", "candidate01", "Phạm Gia An", north, "10A1", "100000000001", date(2008, 1, 10), "active"),
        ("candidate02", "candidate02@example.com", "candidate02", "Đỗ Minh Châu", north, "10A1", "100000000002", date(2008, 2, 11), "active"),
        ("candidate03", "candidate03@example.com", "candidate03", "Vũ Lan Chi", south, "11A2", "100000000003", date(2007, 3, 12), "active"),
        ("candidate04", "candidate04@example.com", "candidate04", "Bùi Quốc Đạt", south, "11A2", "100000000004", date(2007, 4, 13), "active"),
        ("candidate05", "candidate05@example.com", "candidate05", "Nguyễn Ngọc Diệp", north, "10A1", "100000000005", date(2008, 5, 14), "active"),
        ("candidate06", "candidate06@example.com", "candidate06", "Trần Hoàng Phúc", north, "10A2", "100000000006", date(2008, 6, 15), "active"),
        ("candidate07", "candidate07@example.com", "candidate07", "Lê Bảo Ngọc", north, "10A2", "100000000007", date(2008, 7, 16), "active"),
        ("candidate08", "candidate08@example.com", "candidate08", "Phan Khải Huy", north, "10A2", "100000000008", date(2008, 8, 17), "active"),
        ("candidate09", "candidate09@example.com", "candidate09", "Võ Nhã Linh", south, "11A2", "100000000009", date(2007, 9, 18), "active"),
        ("candidate10", "candidate10@example.com", "candidate10", "Đặng Minh Long", south, "11A2", "100000000010", date(2007, 10, 19), "active"),
        ("candidate11", "candidate11@example.com", "candidate11", "Hoàng Thu Mai", south, "Thi lại", "100000000011", date(2007, 11, 20), "pending"),
        ("candidate12", "candidate12@example.com", "candidate12", "Nguyễn Quang Nam", north, "Thi lại", "100000000012", date(2007, 12, 21), "locked"),
    ]
    for key, email, username, full_name, school, student_class, cccd, date_of_birth, status in candidate_specs:
        _create_user(
            context,
            key=key,
            email=email,
            username=username,
            full_name=full_name,
            role_slugs=["candidate"],
            school=school,
            phone_number=f"09{cccd[-8:]}",
            student_class=student_class,
            cccd=cccd,
            date_of_birth=date_of_birth,
            status=getattr(user_model.Status, status.upper()),
        )


def _seed_institutions(context: DemoSeedContext):
    context.groups["north_10a"] = CandidateGroup.objects.create(
        name="HN-Ams - Lớp 10A1",
        description="Nhóm luyện thi Toán chính.",
    )
    context.groups["north_10b"] = CandidateGroup.objects.create(
        name="HN-Ams - Lớp 10A2",
        description="Nhóm Khoa học tự nhiên.",
    )
    context.groups["south_11a"] = CandidateGroup.objects.create(
        name="Chu Văn An - Lớp 11A2",
        description="Thí sinh Ngữ văn và Sinh học.",
    )
    context.groups["retake"] = CandidateGroup.objects.create(
        name="Nhóm thi lại liên trường",
        description="Nhóm ôn tập bổ sung cho thí sinh nhiều trường.",
    )

    memberships = {
        "north_10a": ["candidate01", "candidate02", "candidate05"],
        "north_10b": ["candidate06", "candidate07", "candidate08"],
        "south_11a": ["candidate03", "candidate04", "candidate09", "candidate10"],
        "retake": ["candidate05", "candidate11", "candidate12"],
    }
    for group_key, candidate_keys in memberships.items():
        for candidate_key in candidate_keys:
            GroupMembership.objects.create(
                group=context.groups[group_key],
                user=context.users[candidate_key],
            )


def _seed_subjects(context: DemoSeedContext):
    subject_specs = [
        ("math", "Toán học", "TOAN10", "Toán cơ bản: trắc nghiệm và tự luận.", "bg-blue-600"),
        ("physics", "Vật lý", "LY10", "Kiến thức Vật lý cơ bản cho các bài kiểm tra.", "bg-violet-600"),
        ("literature", "Ngữ văn", "VAN11", "Nội dung đánh giá Ngữ văn thiên về tự luận.", "bg-emerald-600"),
        ("biology", "Sinh học", "SINH11", "Luyện tập trắc nghiệm Sinh học.", "bg-rose-600"),
    ]
    for key, name, code, description, color in subject_specs:
        context.subjects[key] = Subject.objects.create(
            name=name,
            code=code,
            description=description,
            color=color,
        )


def _seed_question_bank(context: DemoSeedContext):
    author = context.users["examiner1"]
    reviewer = context.users["examiner2"]

    context.questions["math_linear"] = create_question(
        subject=context.subjects["math"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Giá trị của x trong phương trình 2x + 4 = 10 là bao nhiêu?",
        tags=["đại số", "phương trình bậc nhất"],
        options=[
            {"key": "A", "text": "2"},
            {"key": "B", "text": "3"},
            {"key": "C", "text": "4"},
            {"key": "D", "text": "5"},
        ],
        correct_option_keys=["B"],
    )
    revise_question(
        question=context.questions["math_linear"],
        updated_by=reviewer,
        question_text="Giải phương trình: 2x + 4 = 10.",
        options=[
            {"key": "A", "text": "x = 2"},
            {"key": "B", "text": "x = 3"},
            {"key": "C", "text": "x = 4"},
            {"key": "D", "text": "x = 5"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["math_graph"] = create_question(
        subject=context.subjects["math"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Điểm nào thuộc đường thẳng y = 2x + 1?",
        tags=["đại số", "đồ thị"],
        options=[
            {"key": "A", "text": "(1, 3)"},
            {"key": "B", "text": "(2, 2)"},
            {"key": "C", "text": "(0, 0)"},
            {"key": "D", "text": "(3, 8)"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["math_truth"] = create_question(
        subject=context.subjects["math"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.TRUE_FALSE,
        question_text="Một tam giác có thể có hai góc vuông.",
        tags=["hình học"],
        options=[
            {"key": "A", "text": "Sai"},
            {"key": "B", "text": "Đúng"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["math_essay"] = create_question(
        subject=context.subjects["math"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.ESSAY,
        question_text="Trình bày cách giải hệ hai phương trình bậc nhất hai ẩn bằng phương pháp cộng đại số.",
        tags=["đại số", "tự luận"],
        essay_rubric="Nêu đủ các bước khử ẩn, biến đổi tương đương và thử lại nghiệm.",
        sample_answer="Nhân hệ số để khử một ẩn, giải phương trình còn lại, thế ngược để tìm ẩn kia và thử lại cặp nghiệm.",
    )

    context.questions["physics_force"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Đơn vị đo lực trong hệ SI là gì?",
        tags=["cơ học"],
        options=[
            {"key": "A", "text": "Newton"},
            {"key": "B", "text": "Joule"},
            {"key": "C", "text": "Pascal"},
            {"key": "D", "text": "Watt"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["physics_velocity"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Vận tốc là đại lượng vectơ vì có cả độ lớn và hướng.",
        tags=["chuyển động"],
        options=[
            {"key": "A", "text": "Đúng"},
            {"key": "B", "text": "Sai"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["physics_energy"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Công thức nào dùng để tính động năng?",
        tags=["năng lượng"],
        options=[
            {"key": "A", "text": "mgh"},
            {"key": "B", "text": "1/2mv^2"},
            {"key": "C", "text": "F = ma"},
            {"key": "D", "text": "P = IV"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["physics_waves"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.TRUE_FALSE,
        question_text="Sóng âm có thể truyền trong chân không.",
        tags=["sóng"],
        options=[
            {"key": "A", "text": "Sai"},
            {"key": "B", "text": "Đúng"},
        ],
        correct_option_keys=["A"],
    )

    context.questions["literature_essay"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.ESSAY,
        question_text="Phân tích điểm nhìn của người kể chuyện trong truyện ngắn \"Vợ nhặt\" của Kim Lân.",
        tags=["phân tích", "tự luận"],
        essay_rubric="Xác định ngôi kể, điểm nhìn, tác dụng đối với việc thể hiện nhân vật và cảm nhận của người đọc.",
        sample_answer="Bài tốt chỉ ra ngôi kể thứ ba, điểm nhìn linh hoạt và tác dụng làm nổi bật khát vọng sống của nhân vật.",
    )
    context.questions["literature_theme"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Chủ đề nào phù hợp nhất với tiểu thuyết về tuổi trưởng thành?",
        tags=["chủ đề"],
        options=[
            {"key": "A", "text": "Tối ưu hóa công nghiệp"},
            {"key": "B", "text": "Sự trưởng thành của bản thân"},
            {"key": "C", "text": "Chuyển động của hành tinh"},
            {"key": "D", "text": "Sự phân chia tế bào"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["literature_poetry"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Biện pháp điệp âm lặp lại yếu tố nào?",
        tags=["thơ"],
        options=[
            {"key": "A", "text": "Phụ âm đầu"},
            {"key": "B", "text": "Độ dài câu"},
            {"key": "C", "text": "Khoảng cách đoạn"},
            {"key": "D", "text": "Tình tiết bất ngờ"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["literature_reflection"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.ESSAY,
        question_text="Viết đoạn văn ngắn về ảnh hưởng của bối cảnh đến giọng điệu tác phẩm.",
        tags=["bối cảnh", "tự luận"],
        essay_rubric="Liên hệ chi tiết bối cảnh với giọng điệu cảm xúc, có ít nhất một dẫn chứng.",
        sample_answer="Bài tốt chỉ ra được mối liên hệ giữa chi tiết không gian và cảm xúc của người đọc.",
    )

    context.questions["biology_cells"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Bào quan nào được ví là \"nhà máy năng lượng\" của tế bào?",
        tags=["tế bào"],
        options=[
            {"key": "A", "text": "Ti thể"},
            {"key": "B", "text": "Ribôxôm"},
            {"key": "C", "text": "Nhân tế bào"},
            {"key": "D", "text": "Bộ máy Gôngi"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["biology_genetics"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="DNA là viết tắt của axit đêôxiribônuclêic.",
        tags=["di truyền"],
        options=[
            {"key": "A", "text": "Đúng"},
            {"key": "B", "text": "Sai"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["biology_ecology"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Mối quan hệ nào là quan hệ cộng sinh?",
        tags=["sinh thái"],
        options=[
            {"key": "A", "text": "Ve và chó"},
            {"key": "B", "text": "Ong và cây có hoa"},
            {"key": "C", "text": "Sư tử và ngựa vằn"},
            {"key": "D", "text": "Nấm mốc trên bánh mì"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["biology_respiration"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.TRUE_FALSE,
        question_text="Hô hấp tế bào chỉ diễn ra ở tế bào động vật.",
        tags=["hô hấp"],
        options=[
            {"key": "A", "text": "Sai"},
            {"key": "B", "text": "Đúng"},
        ],
        correct_option_keys=["A"],
    )
def _seed_exams(context: DemoSeedContext):
    now = context.now
    examiner1 = context.users["examiner1"]

    context.exams["math_open"] = create_exam(
        name="Thi thử Toán lớp 10",
        subject=context.subjects["math"],
        created_by=examiner1,
        description="Đề thi thử có giám sát và chấm tự luận.",
        status=Exam.Status.OPEN,
        duration_minutes=75,
        passing_score=60,
        max_attempts=2,
        shuffle_questions=True,
        show_results_immediately=False,
        enable_proctoring=True,
        opening_at=now - timedelta(days=1),
        closing_at=now + timedelta(days=3),
        manual_question_ids=[
            context.questions["math_linear"].id,
            context.questions["math_essay"].id,
        ],
        random_rules=[
            {
                "difficulty": Question.Difficulty.EASY,
                "question_type": Question.Type.TRUE_FALSE,
                "count": 1,
            }
        ],
        group_ids=[context.groups["north_10a"].id],
        user_ids=[context.users["candidate10"].id],
    )

    context.exams["literature_open"] = create_exam(
        name="Kiểm tra Ngữ văn (tự luận)",
        subject=context.subjects["literature"],
        created_by=examiner1,
        description="Bài kiểm tra tự luận, giáo viên chấm tay.",
        status=Exam.Status.OPEN,
        duration_minutes=60,
        passing_score=65,
        max_attempts=1,
        shuffle_questions=False,
        show_results_immediately=False,
        enable_proctoring=False,
        opening_at=now - timedelta(hours=12),
        closing_at=now + timedelta(days=2),
        manual_question_ids=[
            context.questions["literature_essay"].id,
            context.questions["literature_theme"].id,
        ],
        group_ids=[context.groups["south_11a"].id],
    )

    context.exams["physics_scheduled"] = create_exam(
        name="Kiểm tra 15 phút Vật lý",
        subject=context.subjects["physics"],
        created_by=examiner1,
        description="Bài kiểm tra đã lên lịch, chưa đến giờ thi.",
        status=Exam.Status.SCHEDULED,
        duration_minutes=45,
        passing_score=50,
        max_attempts=1,
        shuffle_questions=False,
        show_results_immediately=True,
        enable_proctoring=False,
        opening_at=now + timedelta(days=1),
        closing_at=now + timedelta(days=2),
        manual_question_ids=[
            context.questions["physics_force"].id,
            context.questions["physics_energy"].id,
            context.questions["physics_waves"].id,
        ],
        group_ids=[context.groups["north_10b"].id],
        user_ids=[context.users["candidate11"].id],
    )

    context.exams["biology_closed"] = create_exam(
        name="Ôn tập Sinh học",
        subject=context.subjects["biology"],
        created_by=examiner1,
        description="Đề trắc nghiệm, công bố kết quả tự động.",
        status=Exam.Status.OPEN,
        duration_minutes=40,
        passing_score=70,
        max_attempts=1,
        shuffle_questions=False,
        show_results_immediately=True,
        enable_proctoring=False,
        opening_at=now - timedelta(days=2),
        closing_at=now + timedelta(days=1),
        manual_question_ids=[
            context.questions["biology_cells"].id,
            context.questions["biology_genetics"].id,
            context.questions["biology_ecology"].id,
        ],
        group_ids=[context.groups["south_11a"].id],
    )

    context.exams["physics_class"] = create_exam(
        name="Lớp học Vật lý",
        mode=Exam.Mode.CLASS,
        subject=context.subjects["physics"],
        created_by=examiner1,
        description="Lớp học mở quyền xem tài liệu và luyện tập môn Vật lý.",
        status=Exam.Status.DRAFT,
        shuffle_questions=False,
        show_results_immediately=False,
        enable_proctoring=False,
        group_ids=[context.groups["retake"].id],
    )


def _create_material(context: DemoSeedContext, *, key: str, title: str, description: str, subject_key: str, uploaded_by_key: str, file_name: str):
    content = f"{title}\n\n{description}\nTạo lúc {context.now.isoformat()}.\n".encode("utf-8")
    material = Material(
        title=title,
        description=description,
        subject=context.subjects[subject_key],
        uploaded_by=context.users[uploaded_by_key],
        file_name=file_name,
        file_size=len(content),
        mime_type="text/plain",
        is_active=True,
    )
    material.file.save(
        f"{DEMO_MEDIA_PREFIX}/materials/{file_name}",
        ContentFile(content),
        save=False,
    )
    material.save()
    context.materials[key] = material
    return material


def _seed_materials(context: DemoSeedContext):
    _create_material(
        context,
        key="math_sheet",
        title="Bảng công thức Toán",
        description="Tra cứu nhanh công thức đại số và hình học.",
        subject_key="math",
        uploaded_by_key="examiner1",
        file_name="bang-cong-thuc-toan.txt",
    )
    _create_material(
        context,
        key="math_samples",
        title="Bài giải mẫu Toán",
        description="Lời giải mẫu các bài phương trình bậc nhất.",
        subject_key="math",
        uploaded_by_key="examiner2",
        file_name="bai-giai-mau-toan.txt",
    )
    _create_material(
        context,
        key="physics_notes",
        title="Đề cương ôn tập Vật lý",
        description="Ôn tập cơ học và năng lượng cho bài kiểm tra sắp tới.",
        subject_key="physics",
        uploaded_by_key="examiner1",
        file_name="de-cuong-vat-ly.txt",
    )
    _create_material(
        context,
        key="literature_rubric",
        title="Tiêu chí chấm bài Ngữ văn",
        description="Thang điểm và tiêu chí chấm bài tự luận Ngữ văn.",
        subject_key="literature",
        uploaded_by_key="examiner2",
        file_name="tieu-chi-cham-van.txt",
    )
    _create_material(
        context,
        key="biology_flashcards",
        title="Thẻ ghi nhớ Sinh học",
        description="Thẻ ôn nhanh tế bào học và sinh thái học.",
        subject_key="biology",
        uploaded_by_key="examiner1",
        file_name="the-ghi-nho-sinh-hoc.txt",
    )
    _create_material(
        context,
        key="candidate_handbook",
        title="Cẩm nang dự thi cho thí sinh",
        description="Hướng dẫn chung cho thí sinh trước khi vào thi.",
        subject_key="math",
        uploaded_by_key="admin",
        file_name="cam-nang-du-thi.txt",
    )


def _save_answers_for_session(session, *, objective_mode: str, essay_text: str, mark_first_for_review: bool = False):
    session_questions = list(
        session.questions.select_related(
            "question_revision__question",
            "question_revision__answer_key",
        ).order_by("sort_order")
    )
    for index, session_question in enumerate(session_questions):
        question_type = session_question.question_revision.question.question_type
        mark_for_review = mark_first_for_review and index == 0

        if question_type in {Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE}:
            correct_option_keys = list(session_question.question_revision.answer_key.correct_option_keys)
            selected_option_keys = correct_option_keys
            if objective_mode == "incorrect":
                option_keys = [option.key for option in session_question.question_revision.options.order_by("sort_order")]
                selected_option_keys = [
                    key for key in option_keys if key not in correct_option_keys
                ][:1]
            save_session_answer(
                session=session,
                session_question=session_question,
                selected_option_keys=selected_option_keys,
                is_marked_for_review=mark_for_review,
            )
        else:
            save_session_answer(
                session=session,
                session_question=session_question,
                answer_text=essay_text,
                is_marked_for_review=mark_for_review,
            )


def _seed_sessions_results_and_proctoring(context: DemoSeedContext):
    candidate1 = context.users["candidate01"]
    candidate2 = context.users["candidate02"]
    candidate3 = context.users["candidate03"]
    candidate4 = context.users["candidate04"]
    examiner1 = context.users["examiner1"]
    proctor1 = context.users["proctor1"]
    admin = context.users["admin"]

    math_submission_session = start_or_resume_session(exam=context.exams["math_open"], candidate=candidate1)
    _save_answers_for_session(
        math_submission_session,
        objective_mode="correct",
        essay_text="Em nhân hai vế để khử ẩn y, giải phương trình còn lại tìm x, rồi thế ngược tìm y và thử lại cặp nghiệm.",
    )
    create_autosave_snapshot(session=math_submission_session, payload={"step": "before-submit"})
    submit_session(session=math_submission_session, submitted_by=candidate1)
    for task in math_submission_session.manual_grading_tasks.all():
        grade_manual_task(
            task=task,
            grader=examiner1,
            score_awarded=task.max_points,
            feedback="Trình bày rõ ràng, các bước khử ẩn chính xác.",
        )
    math_submission_session.refresh_from_db()
    context.sessions["math_submitted"] = math_submission_session
    context.results["math_submitted"] = math_submission_session.result

    math_in_progress_session = start_or_resume_session(exam=context.exams["math_open"], candidate=candidate2)
    _save_answers_for_session(
        math_in_progress_session,
        objective_mode="correct",
        essay_text="Em đang viết dở phần trình bày phương pháp cộng.",
        mark_first_for_review=True,
    )
    create_autosave_snapshot(session=math_in_progress_session, payload={"checkpoint": "halfway"})
    register_client_capability(
        session=math_in_progress_session,
        client_type="web",
        client_version="demo-browser-1.0",
        capabilities={"fullscreen": True, "camera": True, "microphone": True},
        user_agent="EduExam Demo Browser",
    )
    record_heartbeat(
        session=math_in_progress_session,
        connection_status="stable",
        latency_ms=42,
        payload={"cpu": "normal"},
        reported_by=candidate2,
    )
    record_heartbeat(
        session=math_in_progress_session,
        connection_status="unstable",
        latency_ms=350,
        payload={"jitter": "high"},
        reported_by=candidate2,
    )
    warning_event = record_proctor_event(
        session=math_in_progress_session,
        event_type="tab_switch",
        severity="warning",
        metadata={"message": "Thí sinh rời khỏi tab bài thi một lần."},
        reported_by=candidate2,
    )
    critical_event = record_proctor_event(
        session=math_in_progress_session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Thí sinh thoát chế độ toàn màn hình khi đang thi có giám sát."},
        reported_by=candidate2,
    )
    evidence_file = ContentFile("Ảnh minh chứng mẫu".encode("utf-8"))
    evidence_file.name = f"{DEMO_MEDIA_PREFIX}/proctoring/fullscreen-exit-note.txt"
    create_proctor_evidence(
        session=math_in_progress_session,
        evidence_type="attachment",
        file=evidence_file,
        metadata={"source": "demo-seed"},
        uploaded_by=proctor1,
        event=critical_event,
    )
    warning_case = warning_event.violation_cases.order_by("-created_at").first()
    if warning_case is not None:
        resolve_violation_case(
            case=warning_case,
            reviewer=proctor1,
            decision="dismissed",
            notes="Chuyển tab một lần khi kiểm tra kết nối, đã xác nhận không vi phạm.",
        )
    context.sessions["math_in_progress"] = math_in_progress_session

    literature_pending_session = start_or_resume_session(exam=context.exams["literature_open"], candidate=candidate3)
    _save_answers_for_session(
        literature_pending_session,
        objective_mode="correct",
        essay_text="Truyện kể ở ngôi thứ ba nhưng điểm nhìn thường đặt vào nhân vật Tràng, giúp người đọc cảm nhận rõ niềm khát khao hạnh phúc.",
    )
    submit_session(session=literature_pending_session, submitted_by=candidate3)
    literature_pending_session.refresh_from_db()
    context.sessions["literature_pending"] = literature_pending_session
    context.results["literature_pending"] = literature_pending_session.result

    biology_final_session = start_or_resume_session(exam=context.exams["biology_closed"], candidate=candidate4)
    _save_answers_for_session(
        biology_final_session,
        objective_mode="incorrect",
        essay_text="",
    )
    submit_session(session=biology_final_session, submitted_by=candidate4)
    transition_exam_status(exam=context.exams["biology_closed"], next_status=Exam.Status.CLOSED, actor=admin)
    biology_final_session.refresh_from_db()
    context.sessions["biology_finalized"] = biology_final_session
    context.results["biology_finalized"] = biology_final_session.result


def _seed_extra_notifications(context: DemoSeedContext):
    create_notification(
        recipient=context.users["candidate04"],
        title="Đã có kết quả thi",
        message='Kết quả bài "Ôn tập Sinh học" của bạn đã được công bố.',
        category=Notification.Category.RESULT,
        priority=Notification.Priority.MEDIUM,
        action_url="/candidate/results",
        metadata={"exam_id": context.exams["biology_closed"].id},
    )
    create_notification(
        recipient=context.users["candidate02"],
        title="Tiếp tục bài thi đang làm",
        message='Bạn vẫn còn thời gian làm bài "Thi thử Toán lớp 10".',
        category=Notification.Category.EXAM,
        priority=Notification.Priority.HIGH,
        action_url="/candidate/practice",
        metadata={"session_id": context.sessions["math_in_progress"].id},
    )
    create_notification(
        recipient=context.users["admin"],
        title="Dữ liệu mẫu đã sẵn sàng",
        message="Bộ dữ liệu mẫu đã được tạo lại thành công.",
        category=Notification.Category.SYSTEM,
        priority=Notification.Priority.LOW,
        action_url="/notifications",
    )


def _seed_extra_audit(context: DemoSeedContext):
    admin = context.users["admin"]
    candidate12 = context.users["candidate12"]

    record_audit_event(
        actor=admin,
        action="user.login",
        category="authentication",
        description="Quản trị viên đăng nhập sau khi tạo lại dữ liệu mẫu.",
        metadata={"seeded": True},
    )
    record_audit_event(
        actor=admin,
        action="user.locked",
        category="security",
        severity="warning",
        description=f'Đã khoá tài khoản "{candidate12.email}".',
        metadata={"target_user_id": candidate12.id, "target_email": candidate12.email},
    )
    record_audit_event(
        actor=admin,
        action="role.updated",
        category="security",
        description='Cập nhật phân quyền mẫu cho vai trò "Examiner".',
        metadata={"role_slug": "examiner", "seeded": True},
    )


# Cuoc thi Olympiad: lenh flush xoa ca du lieu do migration tao, nen tao lai o day.
CYCLE_3_COMPETITIONS = [
    ("Olympic Quốc tế về Toán học", "IMO", date(2026, 5, 31)),
    ("Olympic Quốc tế về Lập trình", "ICO", date(2026, 5, 30)),
    ("Olympic Quốc tế về Khởi nghiệp & Đổi mới sáng tạo", "SCO IEIO", date(2026, 5, 30)),
    ("Olympic Quốc tế về Kiến thức Tài chính", "SCO IFKO", date(2026, 5, 30)),
    ("Olympic Quốc tế về Tiếng Anh", "SCO IEO", date(2026, 6, 7)),
    ("Olympic Quốc tế về Khoa học", "ISO", date(2026, 6, 7)),
]


def _seed_competitions(context: DemoSeedContext):
    for order, (name, code, exam_date) in enumerate(CYCLE_3_COMPETITIONS, start=10):
        Competition.objects.create(name=name, code=code, cycle="3", exam_date=exam_date, sort_order=order)

    # Chu ky 4: ngay tinh tu hom nay de luon co cuoc thi dang mo dang ky khi thu nghiem.
    today = timezone.localdate(context.now)
    imo = Competition.objects.create(
        name="Olympic Quốc tế về Toán học",
        code="IMO",
        cycle="4 (thử nghiệm)",
        exam_date=today + timedelta(days=60),
        registration_deadline=today + timedelta(days=30),
        sort_order=1,
    )
    ico = Competition.objects.create(
        name="Olympic Quốc tế về Lập trình",
        code="ICO",
        cycle="4 (thử nghiệm)",
        exam_date=today + timedelta(days=45),
        registration_deadline=today + timedelta(days=5),
        sort_order=2,
    )

    registrations = [
        ("Trần Minh Khang", date(2012, 3, 14), "Khối 8", "THCS Giảng Võ", "8A1", "001212000101", "khang.ph@example.com", "0912000101", [imo], "new"),
        ("Lê Phương Anh", date(2011, 9, 2), "Khối 9", "THCS Cầu Giấy", "9A3", "001211000102", "phuonganh.ph@example.com", "0912000102", [imo, ico], "confirmed"),
    ]
    for full_name, dob, grade, school, class_name, cccd, email, phone, competitions, status in registrations:
        registration = CompetitionRegistration.objects.create(
            full_name=full_name,
            date_of_birth=dob,
            grade=grade,
            school=school,
            class_name=class_name,
            cccd=cccd,
            address="1 Phố Giảng Võ",
            ward="Phường Giảng Võ",
            city="Hà Nội",
            email=email,
            guardian_phone=phone,
            status=status,
        )
        registration.competitions.set(competitions)
