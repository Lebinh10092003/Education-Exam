from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.platform_core.models import TimeStampedModel
from .utils import build_email_username, ensure_unique_username


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The email field must be set.")
        email = self.normalize_email(email)
        username = extra_fields.pop("username", "")
        if not username:
            username = build_email_username(email)
        username = ensure_unique_username(username)
        user = self.model(email=email, **extra_fields)
        user.username = username
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PENDING = "pending", "Pending"
        LOCKED = "locked", "Locked"

    username = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    last_login_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ("email",)

    def __str__(self):
        return self.username or self.email

    def has_platform_permission(self, code: str) -> bool:
        if self.is_superuser:
            return True
        if not self.is_active or self.status == self.Status.LOCKED:
            return False

        return self.user_roles.filter(
            is_active=True,
            role__is_active=True,
            role__permissions__code=code,
        ).exists()

    @property
    def active_roles(self):
        return Role.objects.filter(user_roles__user=self, user_roles__is_active=True).distinct()


class Profile(TimeStampedModel):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    phone_number = models.CharField(max_length=32, blank=True)
    avatar = models.FileField(upload_to="avatars/", blank=True)
    cccd = models.CharField(max_length=32, null=True, blank=True, unique=True)
    date_of_birth = models.DateField(null=True, blank=True)
    student_class = models.CharField(max_length=64, blank=True)
    school = models.ForeignKey(
        "institutions.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="profiles",
    )

    def __str__(self):
        return f"Profile<{self.user.email}>"


class Permission(TimeStampedModel):
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    code = models.CharField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ("module", "action")
        constraints = [
            models.UniqueConstraint(
                fields=("module", "action"),
                name="identity_unique_module_action_permission",
            )
        ]

    def __str__(self):
        return self.code


class Role(TimeStampedModel):
    name = models.CharField(max_length=128)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(
        Permission,
        through="RolePermission",
        related_name="roles",
    )

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class RolePermission(TimeStampedModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("role", "permission"),
                name="identity_unique_role_permission",
            )
        ]

    def __str__(self):
        return f"{self.role} -> {self.permission}"


class UserRole(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "role"),
                name="identity_unique_user_role",
            )
        ]

    def __str__(self):
        return f"{self.user} -> {self.role}"
