def test_login_returns_access_and_refresh_tokens(api_client, user):
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "secret123"},
        format="json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload


def test_profile_endpoint_requires_authentication(api_client):
    response = api_client.get("/api/v1/profile/")
    assert response.status_code == 401
