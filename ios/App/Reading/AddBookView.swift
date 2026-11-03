import SwiftUI
import MeetUKit

/// 本の追加画面。バーコード読み取りで ISBN を埋め、タイトル/著者は手入力。
/// （ISBN からの書誌自動取得は別PR。今は読み取った ISBN をそのまま保存する。）
struct AddBookView: View {
    let onAdd: (_ title: String, _ isbn: String?, _ author: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var author = ""
    @State private var isbn = ""
    @State private var showingScanner = false
    @State private var scanError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("バーコード") {
                    Button {
                        scanError = nil
                        showingScanner = true
                    } label: {
                        Label(isbn.isEmpty ? "バーコードを読み取る" : "ISBN: \(isbn)",
                              systemImage: "barcode.viewfinder")
                    }
                    if let scanError {
                        Text(scanError).font(.footnote).foregroundStyle(.red)
                    }
                }
                Section("本の情報") {
                    TextField("タイトル（必須）", text: $title)
                    TextField("著者", text: $author)
                }
            }
            .navigationTitle("本を追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("追加") {
                        onAdd(
                            title.trimmingCharacters(in: .whitespaces),
                            isbn.isEmpty ? nil : isbn,
                            author.isEmpty ? nil : author
                        )
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .sheet(isPresented: $showingScanner) {
                NavigationStack {
                    BarcodeScannerView(
                        onScan: { scanned in
                            isbn = scanned
                            showingScanner = false
                        },
                        onError: { message in
                            scanError = message
                            showingScanner = false
                        }
                    )
                    .ignoresSafeArea()
                    .navigationTitle("バーコードをかざす")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("閉じる") { showingScanner = false }
                        }
                    }
                }
            }
        }
    }
}
