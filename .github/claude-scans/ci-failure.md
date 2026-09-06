# CI / デプロイ失敗の自動修正

対象リポジトリは環境変数 `FAILED_REPO`、失敗した run は `FAILED_RUN_ID`。
失敗した workflow 名は `FAILED_WORKFLOW`、head branch は `FAILED_HEAD_BRANCH`、
head SHA は `FAILED_HEAD_SHA`。

Claude / Claude Scan / この自動修正自身の失敗は、呼び出し側で既に除外されている。

## やること

1. `gh run view $FAILED_RUN_ID --log-failed` で失敗ログを読む。要約で終わらない
2. 原因がコード・設定・テストの変更で直せるなら、直して PR を出す
3. 直せない（秘密切れ、Cloudflare 側障害、権限不足、ログが空）なら PR は出さず、
   関連する PR か issue に原因とログ URL をコメントするだけ

## 守ること

- リポジトリ規約は AGENTS.md。読んでから着手する
- 作業ブランチは `dev` から切る。PR の base は必ず `dev`（main へは出さない）
- コミット前に `just ci` を通す
- 変更は今回の失敗を直す範囲に留める
- `.github/workflows/` は触らない（push が拒否される）
- 失敗しているのが「main 以外を base にした PR」の PR target チェックなら、
  それは仕様なので直さない。コメントもしない

## コードを直す場合

1. `git checkout -b <branch> dev`
2. 直して `just ci`
3. `git commit` して `git push -u origin <branch>`
4. `gh pr create --base dev`
5. 失敗の元が PR なら `gh pr comment`、issue なら `gh issue comment` で PR URL を残す。
   どちらも無ければ PR 本文に run URL を書く

## 重複

同じ run、または同じ head SHA に対する open な修正 PR が既にあるなら、
新しい PR は出さず、既存 PR に「まだ落ちている」とコメントするだけ。
