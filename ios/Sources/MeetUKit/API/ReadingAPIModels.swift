import Foundation

// バックエンド `/api/reading` のリクエスト/レスポンス DTO。

public struct AddReadingItemRequest: Codable, Sendable {
    public var isbn: String?
    public var title: String
    public var author: String?
    public var coverUrl: String?
    public var status: ReadingStatus?
    public var note: String?

    public init(
        isbn: String? = nil,
        title: String,
        author: String? = nil,
        coverUrl: String? = nil,
        status: ReadingStatus? = nil,
        note: String? = nil
    ) {
        self.isbn = isbn
        self.title = title
        self.author = author
        self.coverUrl = coverUrl
        self.status = status
        self.note = note
    }
}

public struct UpdateReadingItemRequest: Codable, Sendable {
    public var title: String?
    public var author: String?
    public var note: String?
    public var status: ReadingStatus?

    public init(
        title: String? = nil,
        author: String? = nil,
        note: String? = nil,
        status: ReadingStatus? = nil
    ) {
        self.title = title
        self.author = author
        self.note = note
        self.status = status
    }
}

public struct TagInput: Codable, Sendable {
    public var displayName: String
    public var category: String?

    public init(displayName: String, category: String? = nil) {
        self.displayName = displayName
        self.category = category
    }
}

public struct ListForTradeRequest: Codable, Sendable {
    public var tags: [TagInput]
    public var note: String?

    public init(tags: [TagInput], note: String? = nil) {
        self.tags = tags
        self.note = note
    }
}

struct ReadingListResponse: Codable {
    let items: [ReadingItem]
}

struct ReadingItemResponse: Codable {
    let item: ReadingItem
}
