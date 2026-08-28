import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "../lib/api";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setError("すべての項目を入力してください");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await signup({ email, password, displayName });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "会員登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">MeetU 会員登録</h1>
        <p className="auth-subtitle">アカウントを作成して推し活マッチングを始めよう</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label><PersonOutlinedIcon fontSize="small" /> お名前 (表示名)</label>
            <input
              type="text"
              placeholder="例: たかし@推し活中"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

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
              placeholder="8文字以上推奨"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "登録中..." : "会員登録してはじめる"}
          </button>
        </form>

        <div className="auth-footer">
          すでにアカウントをお持ちですか？ <Link to="/login">ログイン</Link>
        </div>
      </div>
    </div>
  );
}
