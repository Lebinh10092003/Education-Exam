"""Phan dung chung cua MCP server: instance FastMCP, client, xu ly loi, che do an toan, file vao/ra."""

from __future__ import annotations

import functools
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from mcp.server.fastmcp import FastMCP

from .client import EduExamClient, EduExamError

mcp = FastMCP(
    "eduexam",
    instructions=(
        "Cong cu quan tri he thong thi EduExam (toan bo phia quan tri, khong gom phia thi sinh). "
        "Quy trinh import cau hoi an toan: question_import_guide -> validate_* -> import_*. "
        "Truoc khi mo de luon goi check_exam. Cham tu luan bang AI: dung prompt cham_tu_luan. "
        "Thao tac ghi anh huong du lieu that: xac nhan voi nguoi dung truoc. Cac thao tac xoa/khoa/"
        "cong bo hang loat can confirm=true; neu thieu, tool chi mo ta se lam gi."
    ),
)

_client: EduExamClient | None = None

# EDUEXAM_MCP_MODE:
#   full     : day du (mac dinh)
#   readonly : chi doc, chan moi thao tac ghi
#   no-admin : day du tru quan ly tai khoan, vai tro, phan quyen
MODE = os.environ.get("EDUEXAM_MCP_MODE", "full").strip().lower()


# Che do HTTP (remote, vd. https://khaothi.fermat.vn/mcp): moi request mang ma truy cap rieng cua nguoi dung,
# KHONG dung tai khoan/mat khau luu tren server.
_http_mode = False
_token_clients: dict[str, EduExamClient] = {}
_client_factory: Callable[[str], EduExamClient] | None = None
PAT_PREFIX = "eduexam_pat_"


def enable_http_mode(client_factory: Callable[[str], EduExamClient] | None = None) -> None:
    global _http_mode, _client_factory
    _http_mode = True
    _client_factory = client_factory
    _token_clients.clear()


def disable_http_mode() -> None:
    global _http_mode, _client_factory
    _http_mode = False
    _client_factory = None
    _token_clients.clear()


def bearer_from_request(headers) -> str | None:
    header = headers.get("authorization", "") if headers is not None else ""
    parts = header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].startswith(PAT_PREFIX):
        return parts[1]
    return None


def _current_request_token() -> str | None:
    try:
        request = mcp.get_context().request_context.request
    except (LookupError, ValueError, AttributeError):
        return None
    return bearer_from_request(getattr(request, "headers", None))


def client_for_token(token: str) -> EduExamClient:
    client = _token_clients.get(token)
    if client is None:
        if _client_factory is not None:
            client = _client_factory(token)
        else:
            client = EduExamClient(os.environ.get("EDUEXAM_API_URL"), access_token=token)
        if len(_token_clients) > 200:
            _token_clients.clear()
        _token_clients[token] = client
    return client


def get_client() -> EduExamClient:
    global _client
    if _http_mode:
        token = _current_request_token()
        if not token:
            raise ValueError("Thieu ma truy cap MCP (Authorization: Bearer eduexam_pat_...).")
        return client_for_token(token)
    if _client is None:
        _client = EduExamClient.from_env()
    return _client


def set_client(client: EduExamClient | None) -> None:
    """Dung trong test de thay client that bang client gia."""
    global _client
    _client = client


def current_mode() -> str:
    return os.environ.get("EDUEXAM_MCP_MODE", MODE).strip().lower() or "full"


def call(fn: Callable, *args: Any, **kwargs: Any) -> Any:
    try:
        return fn(*args, **kwargs)
    except EduExamError as exc:
        hint = {
            400: "Du lieu khong hop le, xem chi tiet loi.",
            401: "Sai tai khoan/mat khau hoac token het han.",
            403: "Tai khoan MCP khong co quyen cho thao tac nay.",
            404: "Khong tim thay doi tuong (sai ID?).",
        }.get(exc.status_code, "")
        raise ValueError(f"{exc}" + (f" -> {hint}" if hint else "")) from exc


def guard_write(*, admin: bool = False):
    """Chan thao tac ghi theo EDUEXAM_MCP_MODE (readonly / no-admin)."""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            mode = current_mode()
            if mode == "readonly":
                raise ValueError("MCP dang o che do chi doc (EDUEXAM_MCP_MODE=readonly): khong cho phep thao tac ghi.")
            if admin and mode == "no-admin":
                raise ValueError(
                    "MCP dang o che do no-admin: khong cho phep quan ly tai khoan, vai tro, phan quyen."
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def needs_confirmation(confirm: bool, action: str, **details: Any) -> dict | None:
    """Thao tac nguy hiem: neu chua confirm thi tra ve mo ta, KHONG thuc hien."""
    if confirm:
        return None
    return {
        "executed": False,
        "requires_confirmation": True,
        "action": action,
        "details": details,
        "message": f"Chua thuc hien: {action}. Hoi y nguoi dung, neu dong y goi lai voi confirm=true.",
    }


def clean(payload: dict[str, Any]) -> dict[str, Any]:
    """Bo cac truong None de PATCH chi gui truong can doi."""
    return {key: value for key, value in payload.items() if value is not None}


# ------------------------------ File vao / ra -------------------------------------------
CONTENT_TYPES = {
    ".json": "application/json",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp4": "video/mp4",
    ".zip": "application/zip",
}


def read_local_file(file_path: str) -> tuple[str, bytes, str]:
    path = Path(os.path.expanduser(file_path)).resolve()
    if not path.is_file():
        raise ValueError(f"Khong tim thay file: {path}")
    return path.name, path.read_bytes(), CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")


def export_dir() -> Path:
    base = os.environ.get("EDUEXAM_EXPORT_DIR") or str(Path.home() / "Downloads" / "eduexam-exports")
    path = Path(os.path.expanduser(base))
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_download(content: bytes, suggested_name: str, fallback_name: str, save_dir: str = "") -> dict:
    name = re.sub(r'[\\/:*?"<>|]+', "_", suggested_name or fallback_name).strip() or fallback_name
    target_dir = Path(os.path.expanduser(save_dir)) if save_dir else export_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / name
    if target.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = target_dir / f"{target.stem}-{stamp}{target.suffix}"
    target.write_bytes(content)
    return {"saved_to": str(target), "size_bytes": len(content)}


def run_sync_tools_in_threads() -> int:
    """
    FastMCP goi tool dong bo ngay tren event loop: 1 lenh goi backend cham se chan moi nguoi dung khac
    (nghiem trong khi chay HTTP cho nhieu nguoi). Boc moi tool dong bo de chay trong thread rieng.
    anyio sao chep contextvars sang thread nen get_client() van biet ma truy cap cua request hien tai.
    """
    import anyio

    wrapped = 0
    for tool in mcp._tool_manager.list_tools():
        if tool.is_async:
            continue
        original = tool.fn

        async def runner(*args, __fn=original, **kwargs):
            return await anyio.to_thread.run_sync(functools.partial(__fn, *args, **kwargs))

        tool.fn = runner
        tool.is_async = True
        wrapped += 1
    return wrapped
