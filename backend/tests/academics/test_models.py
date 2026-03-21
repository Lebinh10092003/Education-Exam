import pytest
from django.db import IntegrityError


@pytest.mark.django_db
def test_subject_code_is_unique():
    from apps.academics.models import Subject

    Subject.objects.create(name="Mathematics", code="MATH101")

    with pytest.raises(IntegrityError):
        Subject.objects.create(name="Math Clone", code="MATH101")
