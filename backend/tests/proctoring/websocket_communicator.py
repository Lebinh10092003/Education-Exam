import json
from urllib.parse import unquote, urlparse

from asgiref.testing import ApplicationCommunicator


class WebsocketCommunicator(ApplicationCommunicator):
    def __init__(self, application, path, headers=None, subprotocols=None, spec_version=None):
        if not isinstance(path, str):
            raise TypeError(f"Expected str, got {type(path)}")

        parsed = urlparse(path)
        scope = {
            "type": "websocket",
            "path": unquote(parsed.path),
            "query_string": parsed.query.encode("utf-8"),
            "headers": headers or [],
            "subprotocols": subprotocols or [],
        }
        if spec_version:
            scope["spec_version"] = spec_version
        super().__init__(application, scope)
        self.response_headers = None

    async def connect(self, timeout=1):
        await self.send_input({"type": "websocket.connect"})
        response = await self.receive_output(timeout)
        if response["type"] == "websocket.close":
            return False, response.get("code", 1000)

        assert response["type"] == "websocket.accept"
        self.response_headers = response.get("headers", [])
        return True, response.get("subprotocol", None)

    async def receive_from(self, timeout=1):
        response = await self.receive_output(timeout)
        assert response["type"] == "websocket.send"
        assert ("text" in response) != ("bytes" in response)
        if "text" in response:
            assert isinstance(response["text"], str)
            return response["text"]
        assert isinstance(response["bytes"], bytes)
        return response["bytes"]

    async def receive_json_from(self, timeout=1):
        payload = await self.receive_from(timeout)
        assert isinstance(payload, str)
        return json.loads(payload)

    async def disconnect(self, code=1000, timeout=1):
        await self.send_input({"type": "websocket.disconnect", "code": code})
        await self.wait(timeout)
