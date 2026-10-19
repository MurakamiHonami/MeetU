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
  - `Info.plist` — カメラ利用用途（`NSCameraUsageDescription`）と API ベース URL

## ビルド・テスト

MeetUKit（コア）は SwiftPM でビルド・テストできる:

```bash
cd ios
swift build          # MeetUKit のビルド
swift test           # XCTest（要: フル Xcode。CommandLineTools だけだと XCTest が無く失敗する）
```

アプリ本体（`App/`）は AVFoundation/SwiftUI/Keychain に依存するため iOS SDK が要る。
Xcode で iOS App ターゲットを作り、`App/` のファイル群と MeetUKit（ローカル SwiftPM）を
追加してビルドする。`Info.plist` の `NSCameraUsageDescription` は必須（カメラ権限）。

## 未対応（別PR）

- ISBN から書誌・書影の自動取得（openBD 等）
- 読了→譲る（`/api/reading/:id/list-for-trade`）の画面導線
- ログイン画面（現状 `TokenStore` にトークンがある前提）
- `.xcodeproj` / Xcode プロジェクト設定の同梱
