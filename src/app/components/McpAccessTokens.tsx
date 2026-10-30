import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";

import { ApiError, apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type ApiTokenRecord = {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
};

const EXPIRY_OPTIONS = [
  { days: 30, label: "30 ngày" },
  { days: 90, label: "90 ngày" },
  { days: 180, label: "180 ngày" },
  { days: 365, label: "1 năm" },
];

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.success("Đã sao chép.");
  } catch {
    notify.error("Không sao chép được, hãy chọn và sao chép thủ công.");
  }
};

export function McpAccessTokens() {
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("Claude");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const mcpUrl = `${window.location.origin}/mcp`;

  const load = async () => {
    setIsLoading(true);
    try {
      setTokens(await apiRequest<ApiTokenRecord[]>("/api/v1/api-tokens/"));
      setForbidden(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true);
      } else {
        notify.error(error instanceof Error ? error.message : "Không tải được danh sách mã.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createToken = async () => {
    if (!name.trim()) {
      notify.error("Hãy đặt tên cho mã (vd. Claude trên laptop).");
      return;
    }
    setIsCreating(true);
    try {
      const created = await apiRequest<ApiTokenRecord & { token: string }>("/api/v1/api-tokens/", {
        method: "POST",
        body: { name: name.trim(), expires_in_days: expiresInDays },
      });
      setNewToken(created.token);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Không tạo được mã.");
    } finally {
      setIsCreating(false);
    }
  };

  const revokeToken = async (token: ApiTokenRecord) => {
    const confirmed = await notify.confirm({
      title: "Thu hồi mã truy cập?",
      html: `Ứng dụng AI đang dùng mã <strong>${token.name}</strong> sẽ mất kết nối ngay.`,
      confirmText: "Thu hồi",
      cancelText: "Huỷ",
    });
    if (!confirmed) {
      return;
    }
    try {
      await apiRequest(`/api/v1/api-tokens/${token.id}/`, { method: "DELETE" });
      notify.success("Đã thu hồi mã.");
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Không thu hồi được mã.");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Đang tải...</p>;
  }

  if (forbidden) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Chỉ tài khoản quản trị mới kết nối được trợ lý AI (MCP).
      </p>
    );
  }

  const claudeCommand = `claude mcp add --transport http eduexam ${mcpUrl} --header "Authorization: Bearer ${
    newToken ?? "<MÃ_TRUY_CẬP>"
  }"`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Kết nối trợ lý AI (Claude, ...) với hệ thống qua MCP</p>
        <p className="mt-1">
          Địa chỉ MCP: <code className="rounded bg-white px-1.5 py-0.5">{mcpUrl}</code>. Mỗi mã truy cập thay cho
          mật khẩu của bạn: AI chỉ làm được những gì tài khoản này có quyền. Không chia sẻ mã cho người khác.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div>
          <Label htmlFor="mcp-token-name">Tên mã (để nhận biết)</Label>
          <Input
            id="mcp-token-name"
            className="mt-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="vd. Claude trên laptop"
          />
        </div>
        <div>
          <Label htmlFor="mcp-token-expiry">Hiệu lực</Label>
          <select
            id="mcp-token-expiry"
            className="mt-2 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void createToken()} disabled={isCreating}>
          <KeyRound className="mr-2 h-4 w-4" />
          {isCreating ? "Đang tạo..." : "Tạo mã truy cập"}
        </Button>
      </div>

      {newToken ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">Sao chép mã ngay — mã chỉ hiện một lần duy nhất.</p>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1.5" data-testid="new-mcp-token">
              {newToken}
            </code>
            <Button variant="outline" size="sm" onClick={() => void copyText(newToken)}>
              <Copy className="mr-1 h-4 w-4" />
              Sao chép
            </Button>
          </div>
          <p className="text-amber-900">Claude Code — chạy lệnh:</p>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1.5">{claudeCommand}</code>
            <Button variant="outline" size="sm" onClick={() => void copyText(claudeCommand)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-amber-900">
            Ứng dụng khác: địa chỉ <code>{mcpUrl}</code>, header <code>Authorization: Bearer &lt;mã&gt;</code>.
          </p>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 font-medium text-gray-900">Mã đã tạo</h3>
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có mã nào.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">
                    {token.name}{" "}
                    {token.is_active ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Đang dùng</Badge>
                    ) : (
                      <Badge variant="outline">{token.revoked_at ? "Đã thu hồi" : "Hết hạn"}</Badge>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {token.key_prefix}… · tạo {formatDate(token.created_at)} · hết hạn {formatDate(token.expires_at)} ·
                    dùng lần cuối {formatDate(token.last_used_at)}
                  </p>
                </div>
                {token.is_active ? (
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => void revokeToken(token)}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Thu hồi
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
