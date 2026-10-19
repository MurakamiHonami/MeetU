import Foundation

/// URLSession を直接使わず差し替え可能にするための薄い抽象。テストで差し替える。
public protocol HTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

/// 本番用。URLSession 実装。
public struct URLSessionHTTPClient: HTTPClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("HTTP レスポンスではありません")
        }
        return (data, http)
    }
}

public enum APIError: Error, Equatable, Sendable {
    /// サーバーが返したエラー（DomainError 由来）。status と message。
    case server(status: Int, message: String)
    /// 通信・デコードなどクライアント側の失敗。
    case transport(String)

    public var message: String {
        switch self {
        case let .server(_, message): return message
        case let .transport(message): return message
        }
    }
}

/// バックエンドの handleError が返す { error: string, ... } を拾う。
struct ServerErrorBody: Decodable {
    let error: String
}
