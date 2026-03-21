from rest_framework.permissions import BasePermission


class HasAPIPermissionCode(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        permission_code = None
        if hasattr(view, "permission_codes"):
            permission_code = view.permission_codes.get(request.method)
        if permission_code is None:
            permission_code = getattr(view, "permission_code", None)

        if not permission_code:
            return True

        return request.user.has_platform_permission(permission_code)
