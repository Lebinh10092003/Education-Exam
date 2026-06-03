from apps.identity.models import Permission, Role, RolePermission, UserRole


SYSTEM_PERMISSION_DEFINITIONS = (
    ("users.view", "users", "view"),
    ("users.manage", "users", "manage"),
    ("roles.view", "roles", "view"),
    ("roles.manage", "roles", "manage"),
    ("permissions.view", "permissions", "view"),
    ("schools.view", "schools", "view"),
    ("schools.manage", "schools", "manage"),
    ("groups.view", "groups", "view"),
    ("groups.manage", "groups", "manage"),
    ("subjects.view", "subjects", "view"),
    ("subjects.manage", "subjects", "manage"),
    ("questions.view", "questions", "view"),
    ("questions.manage", "questions", "manage"),
    ("exams.view", "exams", "view"),
    ("exams.manage", "exams", "manage"),
    ("grading.view", "grading", "view"),
    ("grading.manage", "grading", "manage"),
    ("results.view", "results", "view"),
    ("results.manage", "results", "manage"),
    ("discipline.view", "discipline", "view"),
    ("discipline.manage", "discipline", "manage"),
    ("proctoring.view", "proctoring", "view"),
    ("proctoring.manage", "proctoring", "manage"),
    ("materials.view", "materials", "view"),
    ("materials.manage", "materials", "manage"),
    ("notifications.view", "notifications", "view"),
    ("notifications.manage", "notifications", "manage"),
    ("audit.view", "audit", "view"),
    ("audit.manage", "audit", "manage"),
)

SYSTEM_ROLE_DEFINITIONS = {
    "administrator": {
        "name": "Administrator",
        "permission_codes": [definition[0] for definition in SYSTEM_PERMISSION_DEFINITIONS],
    },
    "examiner": {
        "name": "Examiner",
        "permission_codes": [
            "users.view",
            "schools.view",
            "groups.view",
            "subjects.view",
            "questions.view",
            "questions.manage",
            "exams.view",
            "exams.manage",
            "grading.view",
            "grading.manage",
            "results.view",
            "results.manage",
            "discipline.view",
            "discipline.manage",
            "proctoring.view",
            "proctoring.manage",
            "materials.view",
            "materials.manage",
        ],
    },
    "candidate": {
        "name": "Candidate",
        "permission_codes": [
            "notifications.view",
            "notifications.manage",
        ],
    },
    "proctor": {
        "name": "Proctor",
        "permission_codes": [
            "users.view",
            "groups.view",
            "subjects.view",
            "exams.view",
            "grading.view",
            "grading.manage",
            "results.view",
            "discipline.view",
            "proctoring.view",
            "materials.view",
        ],
    },
}


def seed_identity_access(*, admin_user=None):
    permissions = {}
    for code, module, action in SYSTEM_PERMISSION_DEFINITIONS:
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={
                "module": module,
                "action": action,
                "description": f"{action.title()} access for {module}.",
                "is_system": True,
            },
        )
        permissions[code] = permission

    roles = {}
    for slug, config in SYSTEM_ROLE_DEFINITIONS.items():
        role, _ = Role.objects.get_or_create(
            slug=slug,
            defaults={
                "name": config["name"],
                "is_system": True,
            },
        )
        role.is_system = True
        role.name = config["name"]
        role.save(update_fields=["is_system", "name"])
        for code in config["permission_codes"]:
            RolePermission.objects.get_or_create(role=role, permission=permissions[code])
        roles[slug] = role

    if admin_user is not None:
        UserRole.objects.get_or_create(user=admin_user, role=roles["administrator"])

    return {"permissions": permissions, "roles": roles}
