import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, setTokens } from "../lib/api";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
      const res = await login({ email, password });
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);
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
            <label><EmailOutlinedIcon fontSize="small" /> メールアドレス</label>
            <input
              type="email"
              placeholder="example@meetu.staging.ruxel.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label><LockOutlinedIcon fontSize="small" /> パスワード</label>
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

        <div className="auth-footer">
          アカウントをお持ちでないですか？ <Link to="/signup">新規会員登録</Link>
        </div>
      </div>
    </div>
  );
}
