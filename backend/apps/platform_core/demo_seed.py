from __future__ import annotations

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
from apps.exam_authoring.services import create_exam
from apps.exam_delivery.services import create_autosave_snapshot, save_session_answer, start_or_resume_session, submit_session
from apps.grading.models import Result
from apps.grading.services import grade_manual_task, publish_result
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

from .audit import record_audit_event

DEMO_PASSWORD = "admin123456"
DEMO_MEDIA_PREFIX = "demo-seed"


@dataclass
class DemoSeedContext:
    now: object
    users: dict[str, object] = field(default_factory=dict)
    schools: dict[str, School] = field(default_factory=dict)
    groups: dict[str, CandidateGroup] = field(default_factory=dict)
    subjects: dict[str, Subject] = field(default_factory=dict)
    questions: dict[str, Question] = field(default_factory=dict)
    exams: dict[str, Exam] = field(default_factory=dict)
    materials: dict[str, Material] = field(default_factory=dict)
    sessions: dict[str, object] = field(default_factory=dict)
    results: dict[str, Result] = field(default_factory=dict)


def seed_full_demo_data():
    _purge_demo_seed_media()

    context = DemoSeedContext(now=timezone.now())
    _seed_users_and_roles(context)
    _seed_institutions(context)
    _seed_subjects(context)
    _seed_question_bank(context)
    _seed_exams(context)
    _seed_materials(context)
    _seed_sessions_results_and_proctoring(context)
    _seed_extra_notifications(context)
    _seed_extra_audit(context)

    return {
        "password": DEMO_PASSWORD,
        "credentials": [
            {"label": "Administrator", "email": "admin@example.com", "password": DEMO_PASSWORD},
            {"label": "Examiner", "email": "examiner1@example.com", "password": DEMO_PASSWORD},
            {"label": "Proctor", "email": "proctor1@example.com", "password": DEMO_PASSWORD},
            {"label": "Candidate", "email": "candidate01@example.com", "password": DEMO_PASSWORD},
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
        password=DEMO_PASSWORD,
        full_name=full_name,
        status=status,
        is_staff=is_staff,
        is_superuser=is_superuser,
        is_active=status != user_model.Status.LOCKED,
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
        password=DEMO_PASSWORD,
        full_name="EduExam Administrator",
        is_staff=True,
        is_superuser=True,
        status=user_model.Status.ACTIVE,
    )
    Profile.objects.create(user=admin, phone_number="0900000000")
    seed_identity_access(admin_user=admin)
    context.users["admin"] = admin

    north = School.objects.create(
        name="North Valley High School",
        code="NVHS",
        description="Primary demo school for grade 10 candidates.",
    )
    south = School.objects.create(
        name="South City College",
        code="SCC",
        description="Secondary demo school for senior candidates.",
    )
    context.schools["north"] = north
    context.schools["south"] = south

    _create_user(
        context,
        key="examiner1",
        email="examiner1@example.com",
        username="examiner1",
        full_name="Tran Minh Examiner",
        role_slugs=["examiner"],
        phone_number="0901000001",
        is_staff=True,
    )
    _create_user(
        context,
        key="examiner2",
        email="examiner2@example.com",
        username="examiner2",
        full_name="Nguyen Ha Examiner",
        role_slugs=["examiner"],
        phone_number="0901000002",
        is_staff=True,
    )
    _create_user(
        context,
        key="proctor1",
        email="proctor1@example.com",
        username="proctor1",
        full_name="Le Tuan Proctor",
        role_slugs=["proctor"],
        phone_number="0901000003",
        is_staff=True,
    )

    candidate_specs = [
        ("candidate01", "candidate01@example.com", "candidate01", "Pham Gia An", north, "10A", "100000000001", date(2008, 1, 10), "active"),
        ("candidate02", "candidate02@example.com", "candidate02", "Do Minh Chau", north, "10A", "100000000002", date(2008, 2, 11), "active"),
        ("candidate03", "candidate03@example.com", "candidate03", "Vu Lan Chi", south, "11A", "100000000003", date(2007, 3, 12), "active"),
        ("candidate04", "candidate04@example.com", "candidate04", "Bui Quoc Dat", south, "11A", "100000000004", date(2007, 4, 13), "active"),
        ("candidate05", "candidate05@example.com", "candidate05", "Nguyen Ngoc Em", north, "10A", "100000000005", date(2008, 5, 14), "active"),
        ("candidate06", "candidate06@example.com", "candidate06", "Tran Hoang Phuc", north, "10B", "100000000006", date(2008, 6, 15), "active"),
        ("candidate07", "candidate07@example.com", "candidate07", "Le Bao Gia", north, "10B", "100000000007", date(2008, 7, 16), "active"),
        ("candidate08", "candidate08@example.com", "candidate08", "Phan Khai Huy", north, "10B", "100000000008", date(2008, 8, 17), "active"),
        ("candidate09", "candidate09@example.com", "candidate09", "Vo Nha Linh", south, "11A", "100000000009", date(2007, 9, 18), "active"),
        ("candidate10", "candidate10@example.com", "candidate10", "Dang Minh Long", south, "11A", "100000000010", date(2007, 10, 19), "active"),
        ("candidate11", "candidate11@example.com", "candidate11", "Hoang Thu Mai", south, "Retake", "100000000011", date(2007, 11, 20), "pending"),
        ("candidate12", "candidate12@example.com", "candidate12", "Nguyen Quang Nam", north, "Retake", "100000000012", date(2007, 12, 21), "locked"),
    ]
    for key, email, username, full_name, school, student_class, cccd, date_of_birth, status in candidate_specs:
        _create_user(
            context,
            key=key,
            email=email,
            username=username,
            full_name=full_name,
            role_slugs=["candidate", "student"],
            school=school,
            phone_number=f"09{cccd[-8:]}",
            student_class=student_class,
            cccd=cccd,
            date_of_birth=date_of_birth,
            status=getattr(user_model.Status, status.upper()),
        )


def _seed_institutions(context: DemoSeedContext):
    context.groups["north_10a"] = CandidateGroup.objects.create(
        name="North Valley - Grade 10A",
        description="Main mathematics practice group.",
    )
    context.groups["north_10b"] = CandidateGroup.objects.create(
        name="North Valley - Grade 10B",
        description="Secondary science group.",
    )
    context.groups["south_11a"] = CandidateGroup.objects.create(
        name="South City - Grade 11A",
        description="Senior literature and biology candidates.",
    )
    context.groups["retake"] = CandidateGroup.objects.create(
        name="Cross-School Retake Group",
        description="Shared remediation group across schools.",
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
        ("math", "Mathematics", "MATH101", "Core mathematics for objective and essay delivery.", "bg-blue-600"),
        ("physics", "Physics", "PHYS101", "Core physics concepts for scheduled quizzes.", "bg-violet-600"),
        ("literature", "Literature", "LIT201", "Essay-heavy literature assessment content.", "bg-emerald-600"),
        ("biology", "Biology", "BIO105", "Objective biology practice content.", "bg-rose-600"),
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
        question_text="What is the value of x in 2x + 4 = 10?",
        tags=["algebra", "linear"],
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
        question_text="Solve for x: 2x + 4 = 10.",
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
        question_text="Which coordinate lies on the line y = 2x + 1?",
        tags=["algebra", "graph"],
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
        question_text="A triangle can have two right angles.",
        tags=["geometry"],
        options=[
            {"key": "A", "text": "False"},
            {"key": "B", "text": "True"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["math_essay"] = create_question(
        subject=context.subjects["math"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.ESSAY,
        question_text="Explain how you would solve a system of two linear equations using elimination.",
        tags=["algebra", "essay"],
        essay_rubric="Mention elimination steps, equivalent equations, and verification.",
        sample_answer="Eliminate one variable, solve, substitute back, and verify the pair.",
    )

    context.questions["physics_force"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="What is the SI unit of force?",
        tags=["mechanics"],
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
        question_text="Velocity is a vector quantity because it has both magnitude and direction.",
        tags=["motion"],
        options=[
            {"key": "A", "text": "True"},
            {"key": "B", "text": "False"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["physics_energy"] = create_question(
        subject=context.subjects["physics"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Which formula calculates kinetic energy?",
        tags=["energy"],
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
        question_text="Sound waves can travel through a vacuum.",
        tags=["waves"],
        options=[
            {"key": "A", "text": "False"},
            {"key": "B", "text": "True"},
        ],
        correct_option_keys=["A"],
    )

    context.questions["literature_essay"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.ESSAY,
        question_text="Analyze the narrator's point of view in the assigned short story.",
        tags=["analysis", "essay"],
        essay_rubric="Discuss point of view, reliability, and effect on reader interpretation.",
        sample_answer="A strong answer identifies the narration style and its influence on understanding events.",
    )
    context.questions["literature_theme"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Which theme best matches a coming-of-age novel?",
        tags=["theme"],
        options=[
            {"key": "A", "text": "Industrial optimization"},
            {"key": "B", "text": "Personal growth"},
            {"key": "C", "text": "Planetary motion"},
            {"key": "D", "text": "Cell division"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["literature_poetry"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Alliteration repeats which sound pattern?",
        tags=["poetry"],
        options=[
            {"key": "A", "text": "Initial consonant sounds"},
            {"key": "B", "text": "Sentence length"},
            {"key": "C", "text": "Paragraph spacing"},
            {"key": "D", "text": "Plot twists"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["literature_reflection"] = create_question(
        subject=context.subjects["literature"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.ESSAY,
        question_text="Write a short reflection on how setting influences tone.",
        tags=["setting", "essay"],
        essay_rubric="Connect details of setting to emotional tone with at least one example.",
        sample_answer="A good response links environmental details to reader mood.",
    )

    context.questions["biology_cells"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.EASY,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Which organelle is known as the powerhouse of the cell?",
        tags=["cells"],
        options=[
            {"key": "A", "text": "Mitochondrion"},
            {"key": "B", "text": "Ribosome"},
            {"key": "C", "text": "Nucleus"},
            {"key": "D", "text": "Golgi apparatus"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["biology_genetics"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="DNA stands for deoxyribonucleic acid.",
        tags=["genetics"],
        options=[
            {"key": "A", "text": "True"},
            {"key": "B", "text": "False"},
        ],
        correct_option_keys=["A"],
    )
    context.questions["biology_ecology"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.MEDIUM,
        question_type=Question.Type.MULTIPLE_CHOICE,
        question_text="Which relationship is an example of mutualism?",
        tags=["ecology"],
        options=[
            {"key": "A", "text": "Tick and dog"},
            {"key": "B", "text": "Bee and flowering plant"},
            {"key": "C", "text": "Lion and zebra"},
            {"key": "D", "text": "Mold on bread"},
        ],
        correct_option_keys=["B"],
    )
    context.questions["biology_respiration"] = create_question(
        subject=context.subjects["biology"],
        created_by=author,
        difficulty=Question.Difficulty.HARD,
        question_type=Question.Type.TRUE_FALSE,
        question_text="Cellular respiration occurs only in animal cells.",
        tags=["respiration"],
        options=[
            {"key": "A", "text": "False"},
            {"key": "B", "text": "True"},
        ],
        correct_option_keys=["A"],
    )
def _seed_exams(context: DemoSeedContext):
    now = context.now
    examiner1 = context.users["examiner1"]

    context.exams["math_open"] = create_exam(
        name="Mathematics Mock Exam",
        subject=context.subjects["math"],
        created_by=examiner1,
        description="Live demo exam with proctoring and manual grading.",
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
        name="Literature Essay Assessment",
        subject=context.subjects["literature"],
        created_by=examiner1,
        description="Essay-focused assessment for manual grading review.",
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
        name="Physics Readiness Quiz",
        subject=context.subjects["physics"],
        created_by=examiner1,
        description="Scheduled future quiz for unstarted candidate views.",
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
        name="Biology Practice Review",
        subject=context.subjects["biology"],
        created_by=examiner1,
        description="Objective exam used for auto-published candidate results.",
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
        name="Physics Learning Class",
        mode=Exam.Mode.CLASS,
        subject=context.subjects["physics"],
        created_by=examiner1,
        description="Draft learning container that unlocks subject materials and practice access.",
        status=Exam.Status.DRAFT,
        shuffle_questions=False,
        show_results_immediately=False,
        enable_proctoring=False,
        group_ids=[context.groups["retake"].id],
    )


def _create_material(context: DemoSeedContext, *, key: str, title: str, description: str, subject_key: str, uploaded_by_key: str, file_name: str):
    content = f"{title}\n\n{description}\nGenerated at {context.now.isoformat()}.\n".encode("utf-8")
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
        title="Math Formula Sheet",
        description="Quick reference for algebra and geometry formulas.",
        subject_key="math",
        uploaded_by_key="examiner1",
        file_name="math-formula-sheet.txt",
    )
    _create_material(
        context,
        key="math_samples",
        title="Math Worked Examples",
        description="Sample worked solutions for linear equations.",
        subject_key="math",
        uploaded_by_key="examiner2",
        file_name="math-worked-examples.txt",
    )
    _create_material(
        context,
        key="physics_notes",
        title="Physics Revision Notes",
        description="Mechanics and energy revision notes for the scheduled quiz.",
        subject_key="physics",
        uploaded_by_key="examiner1",
        file_name="physics-revision-notes.txt",
    )
    _create_material(
        context,
        key="literature_rubric",
        title="Literature Essay Rubric",
        description="Criteria for the literature essay assessment.",
        subject_key="literature",
        uploaded_by_key="examiner2",
        file_name="literature-essay-rubric.txt",
    )
    _create_material(
        context,
        key="biology_flashcards",
        title="Biology Flashcards",
        description="Cell biology and ecology flashcards for quick review.",
        subject_key="biology",
        uploaded_by_key="examiner1",
        file_name="biology-flashcards.txt",
    )
    _create_material(
        context,
        key="candidate_handbook",
        title="Candidate Exam Handbook",
        description="General instructions for all demo candidates before the exam.",
        subject_key="math",
        uploaded_by_key="admin",
        file_name="candidate-exam-handbook.txt",
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
        essay_text="I would eliminate one variable, solve the reduced equation, then substitute back and verify the pair.",
    )
    create_autosave_snapshot(session=math_submission_session, payload={"step": "before-submit"})
    submit_session(session=math_submission_session, submitted_by=candidate1)
    for task in math_submission_session.manual_grading_tasks.all():
        grade_manual_task(
            task=task,
            grader=examiner1,
            score_awarded=task.max_points,
            feedback="Clear explanation and valid elimination steps.",
        )
    math_submission_session.refresh_from_db()
    context.sessions["math_submitted"] = math_submission_session
    context.results["math_submitted"] = publish_result(
        result=math_submission_session.result,
        published_by=admin,
    )

    math_in_progress_session = start_or_resume_session(exam=context.exams["math_open"], candidate=candidate2)
    _save_answers_for_session(
        math_in_progress_session,
        objective_mode="correct",
        essay_text="Started drafting an elimination response.",
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
        metadata={"message": "Candidate switched away from the exam tab once."},
        reported_by=candidate2,
    )
    critical_event = record_proctor_event(
        session=math_in_progress_session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Candidate exited fullscreen during a protected exam."},
        reported_by=candidate2,
    )
    evidence_file = ContentFile(b"demo evidence snapshot")
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
            notes="Single tab switch acknowledged during connectivity check.",
        )
    context.sessions["math_in_progress"] = math_in_progress_session

    literature_pending_session = start_or_resume_session(exam=context.exams["literature_open"], candidate=candidate3)
    _save_answers_for_session(
        literature_pending_session,
        objective_mode="correct",
        essay_text="The first-person narration limits outside knowledge and increases emotional closeness.",
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
    biology_final_session.refresh_from_db()
    context.sessions["biology_finalized"] = biology_final_session
    context.results["biology_finalized"] = biology_final_session.result

    context.exams["biology_closed"].status = Exam.Status.CLOSED
    context.exams["biology_closed"].save(update_fields=["status", "updated_at"])


def _seed_extra_notifications(context: DemoSeedContext):
    create_notification(
        recipient=context.users["candidate01"],
        title="Published result available",
        message='Your result for "Mathematics Mock Exam" is now available.',
        category=Notification.Category.RESULT,
        priority=Notification.Priority.MEDIUM,
        action_url="/candidate/results",
        metadata={"exam_id": context.exams["math_open"].id},
    )
    create_notification(
        recipient=context.users["candidate02"],
        title="Resume your active exam",
        message='You still have time remaining for "Mathematics Mock Exam".',
        category=Notification.Category.EXAM,
        priority=Notification.Priority.HIGH,
        action_url="/candidate/practice",
        metadata={"session_id": context.sessions["math_in_progress"].id},
    )
    create_notification(
        recipient=context.users["admin"],
        title="Demo environment ready",
        message="The end-to-end local demo dataset has been rebuilt successfully.",
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
        description="Administrator signed in after demo data reset.",
        metadata={"seeded": True},
    )
    record_audit_event(
        actor=admin,
        action="user.locked",
        category="security",
        severity="warning",
        description=f'Locked user "{candidate12.email}".',
        metadata={"target_user_id": candidate12.id, "target_email": candidate12.email},
    )
    record_audit_event(
        actor=admin,
        action="role.updated",
        category="security",
        description='Updated role "Examiner" demo assignments.',
        metadata={"role_slug": "examiner", "seeded": True},
    )
