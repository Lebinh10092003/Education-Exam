import pytest
from rest_framework import generics


class DummyProtectedView(generics.GenericAPIView):
    permission_codes = {"GET": "users.manage"}


@pytest.mark.django_db
def test_manage_permission_class_allows_user_with_custom_code(api_rf, admin_user):
    from apps.identity.permissions import HasAPIPermissionCode

    request = api_rf.get("/api/v1/users/")
    request.user = admin_user
    view = DummyProtectedView()
    view.request = request
    permission = HasAPIPermissionCode()

    assert permission.has_permission(request, view) is True
