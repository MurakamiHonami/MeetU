import Foundation

/// 読書状態。バックエンドの ReadingStatus（UNREAD/READING/DONE）に対応する。
public enum ReadingStatus: String, Codable, CaseIterable, Sendable {
    case unread = "UNREAD"
    case reading = "READING"
    case done = "DONE"

    /// 日本語の表示名。
    public var label: String {
        switch self {
        case .unread: return "積読"
        case .reading: return "読書中"
        case .done: return "読了"
        }
    }
}

/// 本1冊。バックエンド `/api/reading` が返す ReadingItem の props に対応する。
public struct ReadingItem: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let ownerId: String
    public let isbn: String?
    public let title: String
    public let author: String?
    public let coverUrl: String?
    public let status: ReadingStatus
    public let note: String?
    /// 読了→譲る連携で作った交換カードの id。未出品なら nil。
    public let cardId: String?
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String,
        ownerId: String,
        isbn: String? = nil,
        title: String,
        author: String? = nil,
        coverUrl: String? = nil,
        status: ReadingStatus,
        note: String? = nil,
        cardId: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.ownerId = ownerId
        self.isbn = isbn
        self.title = title
        self.author = author
        self.coverUrl = coverUrl
        self.status = status
        self.note = note
        self.cardId = cardId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var isListedForTrade: Bool { cardId != nil }
}
