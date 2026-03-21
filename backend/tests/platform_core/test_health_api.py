def test_health_settings_loaded(client):
    response = client.get("/api/v1/health/live/")
    assert response.status_code == 200


def test_readiness_endpoint_returns_component_statuses(client):
    response = client.get("/api/v1/health/ready/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "components" in payload
