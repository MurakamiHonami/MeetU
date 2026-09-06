import { useState } from "react";
import Link from "next/link";
import { useNavigate, useQueryParam } from "../../shared/lib/navigation";
import { login } from "../../features/auth/api";
import { API_BASE } from "../../shared/api";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import XIcon from "@mui/icons-material/X";

const X_LOGIN_ERROR_MESSAGES: Record<string, string> = {
  x_oauth_failed: "Xログインに失敗しました。もう一度お試しください",
  account_suspended: "このアカウントは停止されています",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const oauthError = useQueryParam("error");
  const [error, setError] = useState(
    oauthError ? (X_LOGIN_ERROR_MESSAGES[oauthError] ?? "ログインに失敗しました") : "",
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await login({ email, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">MeetU にログイン</h1>
        <p className="auth-subtitle">「推し活の“欲しい”と“会いたい”をつなぐ」</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>
              <EmailOutlinedIcon fontSize="small" /> メールアドレス
            </label>
            <input
              type="email"
              placeholder="example@meetu.staging.ruxel.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>
              <LockOutlinedIcon fontSize="small" /> パスワード
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="auth-divider">または</div>

        <a href={`${API_BASE}/api/auth/x/login`} className="btn-x">
          <XIcon fontSize="small" /> Xでログイン
        </a>

        <div className="auth-footer">
          アカウントをお持ちでないですか？ <Link href="/signup">新規会員登録</Link>
        </div>
      </div>
    </div>
  );
}
