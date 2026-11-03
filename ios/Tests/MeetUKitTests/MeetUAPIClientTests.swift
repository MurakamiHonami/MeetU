import XCTest
@testable import MeetUKit

/// 1リクエストを捕捉し、決められたレスポンスを返すモック。
final class MockHTTPClient: HTTPClient, @unchecked Sendable {
    struct Stub {
        let status: Int
        let body: Data
    }

    private(set) var lastRequest: URLRequest?
    private let stub: Stub

    init(status: Int, json: String) {
        self.stub = Stub(status: status, body: Data(json.utf8))
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lastRequest = request
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.status,
            httpVersion: nil,
            headerFields: nil
        )!
        return (stub.body, response)
    }
}

final class MeetUAPIClientTests: XCTestCase {
    private let baseURL = URL(string: "https://api.example.com")!

    func testListReadingItemsParsesAndSetsAuthHeader() async throws {
        let json = """
        {"items":[
          {"id":"a1","ownerId":"u1","title":"リーダブルコード","status":"UNREAD",
           "createdAt":"2026-10-18T00:00:00.000Z","updatedAt":"2026-10-18T00:00:00.000Z"}
        ]}
        """
        let mock = MockHTTPClient(status: 200, json: json)
        let client = MeetUAPIClient(baseURL: baseURL, http: mock) { "test-token" }

        let items = try await client.listReadingItems()

        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].title, "リーダブルコード")
        XCTAssertEqual(items[0].status, .unread)
        XCTAssertEqual(mock.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
        XCTAssertEqual(mock.lastRequest?.url?.path, "/api/reading")
    }

    func testListWithStatusAddsQuery() async throws {
        let mock = MockHTTPClient(status: 200, json: #"{"items":[]}"#)
        let client = MeetUAPIClient(baseURL: baseURL, http: mock) { "t" }

        _ = try await client.listReadingItems(status: .done)

        XCTAssertEqual(mock.lastRequest?.url?.query, "status=DONE")
    }

    func testAddReadingItemSendsBody() async throws {
        let json = """
        {"item":{"id":"a2","ownerId":"u1","title":"達人プログラマー","author":"Hunt",
          "status":"UNREAD","createdAt":"2026-10-18T00:00:00.000Z","updatedAt":"2026-10-18T00:00:00.000Z"}}
        """
        let mock = MockHTTPClient(status: 200, json: json)
        let client = MeetUAPIClient(baseURL: baseURL, http: mock) { "t" }

        let item = try await client.addReadingItem(
            AddReadingItemRequest(title: "達人プログラマー", author: "Hunt")
        )

        XCTAssertEqual(item.title, "達人プログラマー")
        XCTAssertEqual(mock.lastRequest?.httpMethod, "POST")
        let sentBody = try XCTUnwrap(mock.lastRequest?.httpBody)
        let sent = try JSONDecoder().decode(AddReadingItemRequest.self, from: sentBody)
        XCTAssertEqual(sent.title, "達人プログラマー")
        XCTAssertEqual(sent.author, "Hunt")
    }

    func testServerErrorIsSurfacedWithMessage() async {
        let mock = MockHTTPClient(status: 409, json: #"{"error":"この本は既に本棚に登録されています"}"#)
        let client = MeetUAPIClient(baseURL: baseURL, http: mock) { "t" }

        do {
            _ = try await client.addReadingItem(AddReadingItemRequest(title: "重複本"))
            XCTFail("should throw")
        } catch let APIError.server(status, message) {
            XCTAssertEqual(status, 409)
            XCTAssertEqual(message, "この本は既に本棚に登録されています")
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testNoTokenOmitsAuthHeader() async throws {
        let mock = MockHTTPClient(status: 200, json: #"{"items":[]}"#)
        let client = MeetUAPIClient(baseURL: baseURL, http: mock) { nil }

        _ = try await client.listReadingItems()

        XCTAssertNil(mock.lastRequest?.value(forHTTPHeaderField: "Authorization"))
    }
}
