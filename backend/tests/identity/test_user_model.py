from django.contrib.auth import get_user_model


def test_create_user_uses_email_as_identifier(db):
    user = get_user_model().objects.create_user(
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )
    assert user.email == "admin@example.com"
    assert user.check_password("secret123")
