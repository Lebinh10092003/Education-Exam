from apps.platform_core.i18n import t


_CASE_TITLE_TRANSLATIONS = {
    "tab switch": {"vi": "Chuyển tab", "en": "Tab Switch"},
    "chuyển tab": {"vi": "Chuyển tab", "en": "Tab Switch"},
    "fullscreen exit": {"vi": "Thoát toàn màn hình", "en": "Fullscreen Exit"},
    "thoát toàn màn hình": {"vi": "Thoát toàn màn hình", "en": "Fullscreen Exit"},
    "connection unstable": {"vi": "Kết nối không ổn định", "en": "Connection Unstable"},
    "kết nối không ổn định": {"vi": "Kết nối không ổn định", "en": "Connection Unstable"},
    "webcam capture": {"vi": "Ghi nhận webcam", "en": "Webcam Capture"},
    "ghi nhận webcam": {"vi": "Ghi nhận webcam", "en": "Webcam Capture"},
    "screen capture": {"vi": "Ghi nhận màn hình", "en": "Screen Capture"},
    "ghi nhận màn hình": {"vi": "Ghi nhận màn hình", "en": "Screen Capture"},
    "manual alert": {"vi": "Cảnh báo thủ công", "en": "Manual Alert"},
    "cảnh báo thủ công": {"vi": "Cảnh báo thủ công", "en": "Manual Alert"},
}

_CASE_SUMMARY_TRANSLATIONS = {
    "candidate switched away from the exam tab.": {
        "vi": "Thí sinh đã rời khỏi tab bài thi.",
        "en": "Candidate switched away from the exam tab.",
    },
    "candidate switched away from the exam tab once.": {
        "vi": "Thí sinh đã rời khỏi tab bài thi một lần.",
        "en": "Candidate switched away from the exam tab once.",
    },
    "candidate exited fullscreen.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình.",
        "en": "Candidate exited fullscreen.",
    },
    "candidate exited fullscreen once.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình một lần.",
        "en": "Candidate exited fullscreen once.",
    },
    "candidate exited fullscreen mode.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình.",
        "en": "Candidate exited fullscreen mode.",
    },
    "candidate exited fullscreen during a protected exam.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ.",
        "en": "Candidate exited fullscreen during a protected exam.",
    },
    "screen sharing ended during the exam.": {
        "vi": "Việc chia sẻ màn hình đã kết thúc trong lúc làm bài.",
        "en": "Screen sharing ended during the exam.",
    },
    "thí sinh đã rời khỏi tab bài thi.": {
        "vi": "Thí sinh đã rời khỏi tab bài thi.",
        "en": "Candidate switched away from the exam tab.",
    },
    "thí sinh đã rời khỏi tab bài thi một lần.": {
        "vi": "Thí sinh đã rời khỏi tab bài thi một lần.",
        "en": "Candidate switched away from the exam tab once.",
    },
    "thí sinh đã thoát chế độ toàn màn hình.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình.",
        "en": "Candidate exited fullscreen.",
    },
    "thí sinh đã thoát chế độ toàn màn hình một lần.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình một lần.",
        "en": "Candidate exited fullscreen once.",
    },
    "thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ.": {
        "vi": "Thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ.",
        "en": "Candidate exited fullscreen during a protected exam.",
    },
    "việc chia sẻ màn hình đã kết thúc trong lúc làm bài.": {
        "vi": "Việc chia sẻ màn hình đã kết thúc trong lúc làm bài.",
        "en": "Screen sharing ended during the exam.",
    },
}

_SEVERITY_TRANSLATIONS = {
    "warning": {"vi": "Cảnh báo", "en": "Warning"},
    "critical": {"vi": "Nghiêm trọng", "en": "Critical"},
    "info": {"vi": "Thông tin", "en": "Info"},
}

_CASE_STATUS_TRANSLATIONS = {
    "open": {"vi": "Đang mở", "en": "Open"},
    "resolved": {"vi": "Đã xử lý", "en": "Resolved"},
    "dismissed": {"vi": "Đã bỏ qua", "en": "Dismissed"},
}

_PROPOSAL_STATUS_TRANSLATIONS = {
    "draft": {"vi": "Nháp", "en": "Draft"},
    "approved": {"vi": "Đã duyệt", "en": "Approved"},
    "rejected": {"vi": "Đã bác bỏ", "en": "Rejected"},
    "no_penalty": {"vi": "Không phạt", "en": "No Penalty"},
}

_CERTIFICATE_LEVEL_TRANSLATIONS = {
    "gold": {"vi": "Vàng", "en": "Gold"},
    "silver": {"vi": "Bạc", "en": "Silver"},
    "bronze": {"vi": "Đồng", "en": "Bronze"},
    "encouragement": {"vi": "Khuyến khích", "en": "Encouragement"},
    "participation": {"vi": "Tham gia", "en": "Participation"},
}


def _localize_lookup(value, lookup):
    normalized = (value or "").strip().lower()
    translated = lookup.get(normalized)
    if translated is None:
        return value
    return t(vi=translated["vi"], en=translated["en"])


def localize_discipline_case_title(value):
    return _localize_lookup(value, _CASE_TITLE_TRANSLATIONS) or ""


def localize_discipline_case_summary(value):
    return _localize_lookup(value, _CASE_SUMMARY_TRANSLATIONS) or ""


def localize_discipline_severity(value):
    return _localize_lookup(value, _SEVERITY_TRANSLATIONS) or value


def localize_discipline_case_status(value):
    return _localize_lookup(value, _CASE_STATUS_TRANSLATIONS) or value


def localize_discipline_proposal_status(value):
    return _localize_lookup(value, _PROPOSAL_STATUS_TRANSLATIONS) or value


def localize_discipline_certificate_level(value):
    return _localize_lookup(value, _CERTIFICATE_LEVEL_TRANSLATIONS) or value
