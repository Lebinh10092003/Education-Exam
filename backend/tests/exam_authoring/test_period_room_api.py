import pytest


@pytest.mark.django_db
def test_admin_can_create_exam_period(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/exam-periods/",
        {
            "name": "Spring Finals",
            "description": "Main end-of-term period",
            "start_date": "2026-05-01",
            "end_date": "2026-05-15",
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Spring Finals"
    assert payload["start_date"] == "2026-05-01"
    assert payload["end_date"] == "2026-05-15"


@pytest.mark.django_db
def test_admin_can_create_exam_room(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/exam-rooms/",
        {
            "name": "Main Hall A",
            "location": "Building 1, Floor 2",
            "capacity": 120,
            "features": ["wifi", "projector"],
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Main Hall A"
    assert payload["capacity"] == 120
    assert payload["features"] == ["wifi", "projector"]


@pytest.mark.django_db
def test_exam_create_can_reference_period_and_room(api_client, admin_token, subject):
    from apps.exam_authoring.models import ExamPeriod, ExamRoom

    period = ExamPeriod.objects.create(
        name="Autumn Assessments",
        description="October period",
        start_date="2026-10-01",
        end_date="2026-10-21",
    )
    room = ExamRoom.objects.create(
        name="Computer Lab 1",
        location="Building 2",
        capacity=40,
        features=["computers", "wifi"],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(
        "/api/v1/exams/",
        {
            "name": "Mathematics Final Exam",
            "subject_id": subject.id,
            "description": "Room-aware exam",
            "duration_minutes": 120,
            "passing_score": 60,
            "max_attempts": 1,
            "manual_question_ids": [],
            "random_rules": [],
            "group_ids": [],
            "period_id": period.id,
            "room_id": room.id,
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["period"]["id"] == period.id
    assert payload["room"]["id"] == room.id
