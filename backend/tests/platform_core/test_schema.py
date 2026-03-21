import yaml


def test_openapi_schema_includes_foundation_endpoints(client):
    response = client.get("/api/schema/")
    assert response.status_code == 200
    payload = yaml.safe_load(response.content)

    assert "/api/v1/health/live/" in payload["paths"]
    assert "/api/v1/health/ready/" in payload["paths"]
    assert "/api/v1/profile/" in payload["paths"]
