import pytest
from django.db import IntegrityError


@pytest.mark.django_db
def test_question_tags_are_unique_by_slug():
    from apps.question_bank.models import QuestionTag

    QuestionTag.objects.create(name="Calculus", slug="calculus")

    with pytest.raises(IntegrityError):
        QuestionTag.objects.create(name="Calculus 2", slug="calculus")
