from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth.password_validation import validate_password

from apps.identity.models import Permission, Profile, Role, User
from apps.institutions.models import School


class EduExamTokenObtainPairSerializer(TokenObtainPairSerializer):
    identifier = serializers.CharField(required=False, allow_blank=False, write_only=True)
    email = serializers.CharField(required=False, allow_blank=False, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"].required = False

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        identifier = (attrs.get("identifier") or attrs.get("email") or "").strip()
        password = attrs.get("password")

        if not identifier:
            raise serializers.ValidationError({"identifier": "This field is required."})

        user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        if user is None or not user.check_password(password) or not user.is_active:
            raise serializers.ValidationError("No active account found with the given credentials.")

        self.user = user
        data = super().validate({"email": user.email, "password": password})
        data["username"] = user.username
        return data


class SchoolSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField()


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(read_only=True)
    phone_number = serializers.SerializerMethodField()
    school = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "status",
            "is_active",
            "phone_number",
            "school",
            "roles",
            "avatar_url",
        )

    def get_phone_number(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return getattr(profile, "phone_number", "")

    @extend_schema_field(SchoolSummarySerializer(allow_null=True))
    def get_school(self, obj):
        profile = getattr(obj, "profile", None)
        school = getattr(profile, "school", None)
        if not school:
            return None
        return {"id": school.id, "name": school.name, "code": school.code}

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_roles(self, obj):
        return [user_role.role.slug for user_role in obj.user_roles.filter(is_active=True).select_related("role")]

    @extend_schema_field(serializers.CharField(allow_blank=True))
    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        avatar = getattr(profile, "avatar", None)
        if not avatar:
            return ""
        try:
            return avatar.url
        except ValueError:
            return ""


class ProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def update(self, instance, validated_data):
        if "full_name" in validated_data:
            instance.full_name = validated_data["full_name"]
            instance.save(update_fields=["full_name", "updated_at"])

        profile, _ = Profile.objects.get_or_create(user=instance)
        if "phone_number" in validated_data:
            profile.phone_number = validated_data["phone_number"]
            profile.save(update_fields=["phone_number", "updated_at"])
        return instance

    def create(self, validated_data):
        raise NotImplementedError


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "module", "action", "code", "description", "is_system")
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        queryset=Permission.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_system",
            "is_active",
            "permissions",
            "permission_ids",
        )


class UserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    school = serializers.SerializerMethodField(read_only=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    last_login = serializers.SerializerMethodField(read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )
    roles = RoleSerializer(many=True, read_only=True, source="active_roles")

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "status",
            "is_active",
            "is_staff",
            "password",
            "phone_number",
            "last_login",
            "school_id",
            "school",
            "role_ids",
            "roles",
        )
        read_only_fields = ("id", "school", "roles")

    @extend_schema_field(SchoolSummarySerializer(allow_null=True))
    def get_school(self, obj):
        profile = getattr(obj, "profile", None)
        school = getattr(profile, "school", None)
        if not school:
            return None
        return {"id": school.id, "name": school.name, "code": school.code}

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_last_login(self, obj):
        if obj.last_login is None:
            return None
        return obj.last_login.isoformat()

    def create(self, validated_data):
        username = validated_data.pop("username", "")
        password = validated_data.pop("password", None)
        school = validated_data.pop("school_id", None)
        phone_number = validated_data.pop("phone_number", "")
        roles = validated_data.pop("role_ids", [])
        user = User.objects.create_user(password=password, username=username, **validated_data)
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.phone_number = phone_number
        profile.school = school
        profile.save()
        if roles:
            user.user_roles.all().delete()
            for role in roles:
                user.user_roles.create(role=role)
        return user

    def update(self, instance, validated_data):
        username = validated_data.pop("username", None)
        password = validated_data.pop("password", None)
        school = validated_data.pop("school_id", None)
        phone_number = validated_data.pop("phone_number", None)
        roles = validated_data.pop("role_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if username is not None:
            instance.username = username
        if password:
            instance.set_password(password)
        instance.save()

        profile, _ = Profile.objects.get_or_create(user=instance)
        if phone_number is not None:
            profile.phone_number = phone_number
        if "school_id" in self.initial_data:
            profile.school = school
        profile.save()

        if roles is not None:
            instance.user_roles.all().delete()
            for role in roles:
                instance.user_roles.create(role=role)
        return instance
