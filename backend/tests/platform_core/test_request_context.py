def test_response_contains_request_id_header(client):
    response = client.get("/api/v1/health/live/")
    assert "X-Request-ID" in response
