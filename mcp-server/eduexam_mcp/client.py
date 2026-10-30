"""Client goi REST API EduExam: tu dang nhap bang JWT, tu lam moi token khi het han."""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_API_URL = "http://127.0.0.1:8000"


class EduExamError(RuntimeError):
    """Loi tu API, kem ma HTTP va noi dung de AI/nguoi dung doc duoc."""

    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"EduExam API loi {status_code}: {detail}")


class EduExamClient:
    def __init__(
        self,
        base_url: str | None = None,
        *,
        identifier: str | None = None,
        password: str | None = None,
        access_token: str | None = None,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 120.0,
    ):
        self.base_url = (base_url or DEFAULT_API_URL).rstrip("/")
        self.identifier = identifier
        self.password = password
        self.access_token = access_token
        self.refresh_token: str | None = None
        self._http = httpx.Client(base_url=self.base_url, transport=transport, timeout=timeout)

    @classmethod
    def from_env(cls) -> "EduExamClient":
        return cls(
            os.environ.get("EDUEXAM_API_URL", DEFAULT_API_URL),
            identifier=os.environ.get("EDUEXAM_IDENTIFIER") or os.environ.get("EDUEXAM_USERNAME"),
            password=os.environ.get("EDUEXAM_PASSWORD"),
            access_token=os.environ.get("EDUEXAM_ACCESS_TOKEN"),
        )

    # --- Xac thuc -------------------------------------------------------------------
    def login(self) -> None:
        if not self.identifier or not self.password:
            raise EduExamError(
                401,
                "Chua cau hinh dang nhap. Dat EDUEXAM_IDENTIFIER + EDUEXAM_PASSWORD "
                "(hoac EDUEXAM_ACCESS_TOKEN) cho MCP server.",
            )
        response = self._http.post(
            "/api/v1/auth/login/", json={"identifier": self.identifier, "password": self.password}
        )
        data = self._decode(response)
        self.access_token = data["access"]
        self.refresh_token = data.get("refresh")

    def _refresh(self) -> bool:
        if not self.refresh_token:
            return False
        response = self._http.post("/api/v1/auth/refresh/", json={"refresh": self.refresh_token})
        if response.status_code != 200:
            return False
        data = response.json()
        self.access_token = data["access"]
        self.refresh_token = data.get("refresh", self.refresh_token)
        return True

    def _headers(self) -> dict[str, str]:
        if not self.access_token:
            self.login()
        return {"Authorization": f"Bearer {self.access_token}", "Accept-Language": "vi"}

    # --- Goi API ------------------------------------------------------------------------
    @staticmethod
    def _decode(response: httpx.Response) -> Any:
        if response.status_code >= 400:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:500]
            raise EduExamError(response.status_code, detail)
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        params = kwargs.get("params")
        if params:
            kwargs["params"] = {key: value for key, value in params.items() if value not in (None, "")}
        response = self._http.request(method, path, headers=self._headers(), **kwargs)
        if response.status_code == 401 and (self.access_token or "").startswith("eduexam_pat_"):
            raise EduExamError(401, "Ma truy cap MCP khong hop le, da het han hoac da bi thu hoi.")
        if response.status_code == 401:
            # Token het han: lam moi, khong duoc thi dang nhap lai, roi thu lai 1 lan.
            if not self._refresh():
                self.access_token = None
            response = self._http.request(method, path, headers=self._headers(), **kwargs)
        return self._decode(response)

    def get(self, path: str, **params: Any) -> Any:
        return self.request("GET", path, params=params)

    def post(self, path: str, json: Any = None, **kwargs: Any) -> Any:
        return self.request("POST", path, json=json, **kwargs)

    def patch(self, path: str, json: Any = None, **kwargs: Any) -> Any:
        return self.request("PATCH", path, json=json, **kwargs)

    def put(self, path: str, json: Any = None, **kwargs: Any) -> Any:
        return self.request("PUT", path, json=json, **kwargs)

    def delete(self, path: str, **params: Any) -> Any:
        return self.request("DELETE", path, params=params)

    def download(self, path: str, **params: Any) -> tuple[bytes, str]:
        """Tai file (Excel/CSV/tai lieu). Tra ve (noi dung, ten file goi y tu Content-Disposition)."""
        params = {key: value for key, value in params.items() if value not in (None, "")}
        response = self._http.request("GET", path, headers=self._headers(), params=params)
        if response.status_code == 401:
            if not self._refresh():
                self.access_token = None
            response = self._http.request("GET", path, headers=self._headers(), params=params)
        if response.status_code >= 400:
            self._decode(response)
        disposition = response.headers.get("content-disposition", "")
        file_name = ""
        if "filename=" in disposition:
            file_name = disposition.split("filename=", 1)[1].split(";")[0].strip().strip('"')
        return response.content, file_name

    def close(self) -> None:
        self._http.close()
