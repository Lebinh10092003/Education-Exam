from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

REG_URL = "/api/v1/public/competition-registrations/"


def _competition(**overrides):
    from apps.competitions.models import Competition

    params = {"name": "Olympic Toán", "code": "TEST", "cycle": "4", "exam_date": timezone.localdate() + timedelta(days=30)}
    params.update(overrides)
    return Competition.objects.create(**params)


def _registration_payload(competition_ids, **overrides):
    payload = {
        "full_name": "Nguyễn  Văn   An",
        "date_of_birth": "2012-05-01",
        "grade": "Khối 8",
        "school": "THCS Giảng Võ",
        "class_name": "8A1",
        "cccd": "001212000001",
        "email": "phuhuynh@example.com",
        "guardian_phone": "0912 345 678",
        "competition_ids": competition_ids,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_existing_hardcoded_competitions_are_migrated():
    from apps.competitions.models import Competition

    codes = set(Competition.objects.filter(cycle="3").values_list("code", flat=True))
    assert codes == {"IMO", "ICO", "SCO IEIO", "SCO IFKO", "SCO IEO", "ISO"}


@pytest.mark.django_db
def test_public_list_orders_by_status_and_limits_history():
    from apps.competitions.models import Competition

    Competition.objects.all().delete()
    today = timezone.localdate()
    _competition(code="NOW", exam_date=today)
    _competition(code="SOON", exam_date=today + timedelta(days=3))
    _competition(code="LATER", exam_date=today + timedelta(days=40))
    _competition(code="OLD1", exam_date=today - timedelta(days=5))
    _competition(code="OLD2", exam_date=today - timedelta(days=50))
    _competition(code="HIDDEN", exam_date=today + timedelta(days=1), is_active=False)
    _competition(code="NOTFEAT", exam_date=today + timedelta(days=2), is_featured=False)

    data = APIClient().get("/api/v1/public/competitions/?ended_limit=1").json()

    assert [(item["code"], item["status"]) for item in data] == [
        ("NOW", "ongoing"),
        ("SOON", "upcoming"),
        ("LATER", "upcoming"),
        ("OLD1", "ended"),
    ]
    all_codes = [item["code"] for item in APIClient().get("/api/v1/public/competitions/?all=1").json()]
    assert "NOTFEAT" in all_codes and "HIDDEN" not in all_codes


@pytest.mark.django_db
def test_public_registration_is_saved_and_notifies_admins(admin_user):
    from apps.competitions.models import CompetitionRegistration
    from apps.notifications.models import Notification

    cache.clear()
    competition = _competition()
    response = APIClient().post(REG_URL, _registration_payload([competition.id]), format="json")

    assert response.status_code == 201
    registration = CompetitionRegistration.objects.get()
    assert registration.full_name == "Nguyễn Văn An"
    assert list(registration.competitions.values_list("code", flat=True)) == ["TEST"]
    assert Notification.objects.filter(recipient=admin_user, metadata__registration_id=registration.id).exists()


@pytest.mark.django_db
def test_registration_rejects_closed_competitions_bots_and_bad_data():
    cache.clear()
    client = APIClient()
    past = _competition(code="PAST", exam_date=timezone.localdate() - timedelta(days=1))
    deadline_passed = _competition(code="LATE", registration_deadline=timezone.localdate() - timedelta(days=1))
    open_one = _competition(code="OPEN")

    assert client.post(REG_URL, _registration_payload([past.id]), format="json").status_code == 400
    assert client.post(REG_URL, _registration_payload([deadline_passed.id]), format="json").status_code == 400
    assert client.post(REG_URL, _registration_payload([open_one.id], website="spam"), format="json").status_code == 400
    assert client.post(REG_URL, _registration_payload([open_one.id], guardian_phone="abc"), format="json").status_code == 400
    assert client.post(REG_URL, _registration_payload([open_one.id], cccd="123"), format="json").status_code == 400
    assert client.post(REG_URL, _registration_payload([]), format="json").status_code == 400
    cache.clear()


@pytest.mark.django_db
def test_registration_is_rate_limited_per_ip():
    cache.clear()
    competition = _competition()
    client = APIClient()
    statuses = [
        client.post(REG_URL, _registration_payload([competition.id], email=f"p{i}@example.com"), format="json").status_code
        for i in range(11)
    ]
    assert statuses[:10] == [201] * 10
    assert statuses[10] == 429
    cache.clear()


@pytest.mark.django_db
def test_admin_manages_competitions_and_registrations(api_client, admin_token):
    cache.clear()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    created = api_client.post(
        "/api/v1/competitions/",
        {
            "name": "Olympic Tin học trẻ",
            "code": "OTHT",
            "cycle": "2027",
            "exam_date": "2027-03-15",
            "registration_deadline": "2027-03-01",
        },
        format="json",
    )
    assert created.status_code == 201
    competition_id = created.json()["id"]
    assert created.json()["status"] == "upcoming"

    bad = api_client.patch(
        f"/api/v1/competitions/{competition_id}/", {"registration_deadline": "2027-04-01"}, format="json"
    )
    assert bad.status_code == 400

    APIClient().post(REG_URL, _registration_payload([competition_id]), format="json")
    listed = api_client.get("/api/v1/competition-registrations/?status=new").json()
    registration_id = listed["results"][0]["id"]
    updated = api_client.patch(
        f"/api/v1/competition-registrations/{registration_id}/",
        {"status": "confirmed", "admin_note": "Đã gọi"},
        format="json",
    )
    assert updated.json()["status"] == "confirmed"
    assert updated.json()["handled_by_name"]

    export = api_client.get("/api/v1/competition-registrations/export/")
    assert export.status_code == 200
    assert export["Content-Type"].startswith("application/vnd.openxmlformats")

    assert api_client.delete(f"/api/v1/competitions/{competition_id}/").status_code == 400
    assert api_client.get("/api/v1/competitions/?search=OTHT").json()["results"][0]["registration_count"] == 1
    cache.clear()


@pytest.mark.django_db
def test_candidates_cannot_manage_competitions(api_client, candidate_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(candidate_user).access_token}")
    assert api_client.get("/api/v1/competition-registrations/").status_code == 403
    assert api_client.post("/api/v1/competitions/", {}, format="json").status_code == 403
