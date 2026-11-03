// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MeetU",
    platforms: [
        .iOS(.v16),
        .macOS(.v13), // MeetUKit（モデル + APIクライアント）を macOS でもビルド/テストできるようにする
    ],
    products: [
        // プラットフォーム非依存のコア。SwiftUI/AVFoundation に依存しないので `swift test` で検証できる。
        .library(name: "MeetUKit", targets: ["MeetUKit"]),
    ],
    targets: [
        .target(
            name: "MeetUKit",
            path: "Sources/MeetUKit"
        ),
        .testTarget(
            name: "MeetUKitTests",
            dependencies: ["MeetUKit"],
            path: "Tests/MeetUKitTests"
        ),
    ]
)
