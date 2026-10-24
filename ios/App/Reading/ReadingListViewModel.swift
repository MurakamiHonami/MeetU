import Foundation
import MeetUKit

@MainActor
final class ReadingListViewModel: ObservableObject {
    @Published var items: [ReadingItem] = []
    @Published var filter: ReadingStatus? = nil
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client: MeetUAPIClient

    init(client: MeetUAPIClient) {
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            items = try await client.listReadingItems(status: filter)
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func add(title: String, isbn: String?, author: String?) async {
        do {
            let item = try await client.addReadingItem(
                AddReadingItemRequest(isbn: isbn, title: title, author: author)
            )
            items.insert(item, at: 0)
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func changeStatus(_ item: ReadingItem, to status: ReadingStatus) async {
        do {
            let updated = try await client.updateReadingItem(
                id: item.id,
                UpdateReadingItemRequest(status: status)
            )
            replace(updated)
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ item: ReadingItem) async {
        do {
            try await client.deleteReadingItem(id: item.id)
            items.removeAll { $0.id == item.id }
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func replace(_ item: ReadingItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = item
        }
    }
}
