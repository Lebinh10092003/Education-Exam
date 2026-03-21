from rest_framework import serializers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field

from ..models import Material


class MaterialSubjectSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField()


class MaterialUploadedBySerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    email = serializers.CharField(allow_blank=True)
    full_name = serializers.CharField(allow_blank=True)


class MaterialSerializer(serializers.ModelSerializer):
    subject = MaterialSubjectSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Material._meta.get_field("subject").remote_field.model.objects.order_by("name"),
        source="subject",
        write_only=True,
    )
    uploaded_by = serializers.SerializerMethodField(read_only=True)
    file_url = serializers.SerializerMethodField(read_only=True)
    file = serializers.FileField(required=False)

    class Meta:
        model = Material
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "subject_id",
            "file",
            "file_url",
            "file_name",
            "file_size",
            "mime_type",
            "uploaded_by",
            "download_count",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "file_url",
            "file_name",
            "file_size",
            "mime_type",
            "uploaded_by",
            "download_count",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(MaterialUploadedBySerializer)
    def get_uploaded_by(self, obj):
        user = obj.uploaded_by
        if not user:
            return {"id": None, "email": "", "full_name": ""}
        return {"id": user.id, "email": user.email, "full_name": user.full_name}

    @extend_schema_field(OpenApiTypes.URI)
    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else ""
        except ValueError:
            return ""

    def create(self, validated_data):
        uploaded_file = validated_data.get("file")
        request = self.context.get("request")
        if uploaded_file is not None:
            validated_data["file_name"] = uploaded_file.name
            validated_data["file_size"] = getattr(uploaded_file, "size", 0) or 0
            validated_data["mime_type"] = getattr(uploaded_file, "content_type", "") or ""
        if request is not None and request.user.is_authenticated:
            validated_data["uploaded_by"] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        uploaded_file = validated_data.get("file")
        if uploaded_file is not None:
            validated_data["file_name"] = uploaded_file.name
            validated_data["file_size"] = getattr(uploaded_file, "size", 0) or 0
            validated_data["mime_type"] = getattr(uploaded_file, "content_type", "") or ""
        return super().update(instance, validated_data)


class MaterialDownloadSerializer(serializers.Serializer):
    file_url = serializers.CharField()
    download_count = serializers.IntegerField()
