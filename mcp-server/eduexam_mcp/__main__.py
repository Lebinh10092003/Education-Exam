import argparse
import os

from .server import main as run_stdio


def cli() -> None:
    parser = argparse.ArgumentParser(description="EduExam MCP server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default=os.environ.get("EDUEXAM_MCP_TRANSPORT", "stdio"),
        help="stdio: chay tren may (Claude Code/Desktop). http: chay nhu dich vu web (vd. /mcp tren VPS).",
    )
    parser.add_argument("--host", default=os.environ.get("EDUEXAM_MCP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("EDUEXAM_MCP_PORT", "8765")))
    args = parser.parse_args()
    if args.transport == "http":
        from . import server  # noqa: F401 (dang ky tool)
        from .http_app import run_http

        run_http(args.host, args.port)
    else:
        run_stdio()


cli()
