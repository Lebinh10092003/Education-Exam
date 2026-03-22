import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


@pytest.mark.django_db
def test_candidate_can_list_active_materials(api_client, candidate_user, admin_user, subject):
    from apps.materials.models import Material
    from rest_framework_simplejwt.tokens import RefreshToken

    Material.objects.create(
        title="Active Guide",
        description="Visible to candidates",
        subject=subject,
        file=SimpleUploadedFile("active.txt", b"payload", content_type="text/plain"),
        file_name="active.txt",
        file_size=7,
        mime_type="text/plain",
        uploaded_by=admin_user,
        is_active=True,
    )
    Material.objects.create(
        title="Archived Guide",
        description="Should stay hidden",
        subject=subject,
        file=SimpleUploadedFile("inactive.txt", b"payload", content_type="text/plain"),
        file_name="inactive.txt",
        file_size=7,
        mime_type="text/plain",
        uploaded_by=admin_user,
        is_active=False,
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/my-materials/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["title"] == "Active Guide"
