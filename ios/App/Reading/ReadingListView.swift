import SwiftUI
import MeetUKit

struct ReadingListView: View {
    @StateObject var viewModel: ReadingListViewModel
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            List {
                if let error = viewModel.errorMessage {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }
                ForEach(viewModel.items) { item in
                    ReadingItemRow(item: item) { status in
                        Task { await viewModel.changeStatus(item, to: status) }
                    }
                }
                .onDelete { indexSet in
                    let targets = indexSet.map { viewModel.items[$0] }
                    Task { for item in targets { await viewModel.delete(item) } }
                }
            }
            .overlay {
                if viewModel.isLoading && viewModel.items.isEmpty {
                    ProgressView()
                }
            }
            .navigationTitle("本棚")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("状態", selection: $viewModel.filter) {
                        Text("すべて").tag(ReadingStatus?.none)
                        ForEach(ReadingStatus.allCases, id: \.self) { status in
                            Text(status.label).tag(ReadingStatus?.some(status))
                        }
                    }
                    .onChange(of: viewModel.filter) { _ in
                        Task { await viewModel.load() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAdd = true
                    } label: {
                        Image(systemName: "barcode.viewfinder")
                    }
                }
            }
            .sheet(isPresented: $showingAdd) {
                AddBookView { title, isbn, author in
                    Task { await viewModel.add(title: title, isbn: isbn, author: author) }
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

struct ReadingItemRow: View {
    let item: ReadingItem
    let onChangeStatus: (ReadingStatus) -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.headline)
                if let author = item.author {
                    Text(author).font(.subheadline).foregroundStyle(.secondary)
                }
                if item.isListedForTrade {
                    Text("【譲】出品中").font(.caption).foregroundStyle(.teal)
                }
            }
            Spacer()
            Menu {
                ForEach(ReadingStatus.allCases, id: \.self) { status in
                    Button(status.label) { onChangeStatus(status) }
                }
            } label: {
                Text(item.status.label)
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(statusColor)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch item.status {
        case .unread: return .orange
        case .reading: return .blue
        case .done: return .green
        }
    }
}
