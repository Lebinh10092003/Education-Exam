import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


@pytest.mark.django_db
def test_admin_can_create_and_list_materials(api_client, admin_token, subject):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    file = SimpleUploadedFile(
        "guide.txt",
        b"study guide content",
        content_type="text/plain",
    )

    create_response = api_client.post(
        "/api/v1/materials/",
        {
            "title": "Study Guide",
            "description": "Material for candidates",
            "subject_id": subject.id,
            "file": file,
        },
        format="multipart",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["title"] == "Study Guide"
    assert payload["subject"]["id"] == subject.id
    assert payload["file_name"] == "guide.txt"

    list_response = api_client.get("/api/v1/materials/")

    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1


@pytest.mark.django_db
def test_material_download_endpoint_increments_counter(api_client, admin_token, admin_user, subject):
    from apps.materials.models import Material

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    material = Material.objects.create(
        title="Download Me",
        description="",
        subject=subject,
        file=SimpleUploadedFile("download.txt", b"payload", content_type="text/plain"),
        file_name="download.txt",
        file_size=7,
        mime_type="text/plain",
        uploaded_by=admin_user,
    )

    response = api_client.get(f"/api/v1/materials/{material.id}/download/")

    assert response.status_code == 200
    assert response.json()["download_count"] == 1
    material.refresh_from_db()
    assert material.download_count == 1
