from django.utils.translation import get_language


def get_current_locale() -> str:
    language = (get_language() or "vi").lower()
    if language.startswith("en"):
        return "en"
    return "vi"


def t(*, vi: str, en: str) -> str:
    return en if get_current_locale() == "en" else vi
