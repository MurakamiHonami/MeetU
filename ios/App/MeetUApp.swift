import SwiftUI
import MeetUKit

@main
struct MeetUApp: App {
    private let viewModel: ReadingListViewModel

    init() {
        // API のベース URL。Info.plist の MEETU_API_BASE_URL で上書きできる。
        let base = (Bundle.main.object(forInfoDictionaryKey: "MEETU_API_BASE_URL") as? String)
            .flatMap(URL.init(string:))
            ?? URL(string: "https://api-meetu-staging.ruxel.net")!
        let client = MeetUAPIClient(baseURL: base) {
            TokenStore.shared.read()
        }
        viewModel = ReadingListViewModel(client: client)
    }

    var body: some Scene {
        WindowGroup {
            ReadingListView(viewModel: viewModel)
        }
    }
}
