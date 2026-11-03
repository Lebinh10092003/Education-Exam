import yaml
from django.core.management import call_command


def test_openapi_schema_includes_foundation_endpoints(client):
    response = client.get("/api/schema/")
    assert response.status_code == 200
    payload = yaml.safe_load(response.content)

    assert "/api/v1/health/live/" in payload["paths"]
    assert "/api/v1/health/ready/" in payload["paths"]
    assert "/api/v1/profile/" in payload["paths"]


def test_openapi_schema_generates_without_warnings(tmp_path):
    # Moi endpoint phai khai bao duoc schema; view moi thieu serializer/type hint se lam test nay fail.
    call_command("spectacular", "--fail-on-warn", "--file", str(tmp_path / "schema.yaml"))
