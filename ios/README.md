# MeetU iOS（積読管理）

エンジニア向け技術書の積読管理・交換アプリの iOS クライアント。バックエンド
（`backend/` の Cloudflare Workers）の `/api/reading` を叩く。

## 構成

- `Sources/MeetUKit/` — プラットフォーム非依存のコア（SwiftUI/AVFoundation に非依存）
  - `Models/ReadingItem.swift` — バックエンドの ReadingItem に対応するモデル
  - `API/` — `MeetUAPIClient`（積読 API クライアント）、HTTP 抽象、DTO
  - `ISBN.swift` — 書籍バーコード（EAN-13 / ISBN-13）の正規化・検証
- `Tests/MeetUKitTests/` — MeetUKit の XCTest（ISBN 検証・API クライアント）
- `App/` — iOS アプリ本体（SwiftUI）
  - `MeetUApp.swift` — エントリポイント
  - `Reading/` — 積読リスト画面・追加画面・ViewModel
  - `Scanner/BarcodeScannerView.swift` — AVFoundation バーコード読み取り
  - `Support/TokenStore.swift` — アクセストークンの Keychain 保存
- `project.yml` — XcodeGen のプロジェクト定義（**これがソース**。`.xcodeproj` と
  `App/Info.plist` は生成物なので git 管理しない）

## ビルド・テスト

前提: フル Xcode を使う（CommandLineTools だけだと XCTest / simctl が無い）。
初回のみ `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`。

```bash
cd ios
# 1. .xcodeproj を生成（project.yml から。初回とプロジェクト構成変更時）
brew install xcodegen   # 未導入なら
xcodegen generate

# 2. コアだけなら SwiftPM でも回せる
swift build

# 3. アプリのビルド / テスト（シミュレータ）
xcodebuild -project MeetU.xcodeproj -scheme MeetU \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -project MeetU.xcodeproj -scheme MeetUKitTests \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

Xcode で開くときは `xcodegen generate` 後に `MeetU.xcodeproj` を開く。
`NSCameraUsageDescription`（カメラ権限）は `project.yml` の `info.properties` で定義済み。

## 未対応（別PR）

- ISBN から書誌・書影の自動取得（openBD 等）
- 読了→譲る（`/api/reading/:id/list-for-trade`）の画面導線
- ログイン画面（現状 `TokenStore` にトークンがある前提）
- `.xcodeproj` / Xcode プロジェクト設定の同梱
