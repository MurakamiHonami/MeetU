import Foundation

/// MeetU バックエンド（Cloudflare Workers）の積読管理 API を叩くクライアント。
///
/// 認証は Bearer アクセストークン。トークンは `TokenStore` から取得し、
/// このクライアント自体は保存場所を知らない（テスト容易性のため）。
public actor MeetUAPIClient {
    private let baseURL: URL
    private let http: HTTPClient
    private let tokenProvider: @Sendable () async -> String?
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(
        baseURL: URL,
        http: HTTPClient = URLSessionHTTPClient(),
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.http = http
        self.tokenProvider = tokenProvider
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }

    // MARK: - 積読リスト

    public func listReadingItems(status: ReadingStatus? = nil) async throws -> [ReadingItem] {
        var path = "/api/reading"
        if let status { path += "?status=\(status.rawValue)" }
        let (data, _) = try await perform("GET", path)
        return try decode(ReadingListResponse.self, from: data).items
    }

    public func addReadingItem(_ req: AddReadingItemRequest) async throws -> ReadingItem {
        let (data, _) = try await perform("POST", "/api/reading", body: req)
        return try decode(ReadingItemResponse.self, from: data).item
    }

    public func updateReadingItem(id: String, _ req: UpdateReadingItemRequest) async throws -> ReadingItem {
        let (data, _) = try await perform("PATCH", "/api/reading/\(id)", body: req)
        return try decode(ReadingItemResponse.self, from: data).item
    }

    public func deleteReadingItem(id: String) async throws {
        _ = try await perform("DELETE", "/api/reading/\(id)")
    }

    public func listForTrade(id: String, _ req: ListForTradeRequest) async throws -> ReadingItem {
        let (data, _) = try await perform("POST", "/api/reading/\(id)/list-for-trade", body: req)
        return try decode(ReadingItemResponse.self, from: data).item
    }

    // MARK: - 内部

    private func perform<Body: Encodable>(
        _ method: String,
        _ path: String,
        body: Body
    ) async throws -> (Data, HTTPURLResponse) {
        try await perform(method, path, bodyData: try encoder.encode(body))
    }

    private func perform(_ method: String, _ path: String) async throws -> (Data, HTTPURLResponse) {
        try await perform(method, path, bodyData: nil)
    }

    private func perform(
        _ method: String,
        _ path: String,
        bodyData: Data?
    ) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.transport("不正な URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token = await tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, http): (Data, HTTPURLResponse)
        do {
            (data, http) = try await self.http.send(request)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(ServerErrorBody.self, from: data))?.error
                ?? "サーバーエラー (\(http.statusCode))"
            throw APIError.server(status: http.statusCode, message: message)
        }
        return (data, http)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.transport("レスポンスの解析に失敗しました: \(error.localizedDescription)")
        }
    }
}
