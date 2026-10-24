import Foundation

/// 書籍バーコード（ISBN-13 / EAN-13）の正規化と検証。
///
/// 書籍のバーコードは ISBN-13（978/979 始まりの EAN-13）。日本の書籍は
/// 2 段バーコードで、下段が価格コード（192〜 始まり）。上段の ISBN だけを本の識別に使う。
public enum ISBN {
    /// 数字以外を除いた文字列を返す。
    public static func digitsOnly(_ raw: String) -> String {
        raw.filter(\.isNumber)
    }

    /// ISBN-13 として妥当か（13桁・チェックディジット一致・978/979 始まり）。
    public static func isValidISBN13(_ raw: String) -> Bool {
        let digits = digitsOnly(raw)
        guard digits.count == 13 else { return false }
        guard digits.hasPrefix("978") || digits.hasPrefix("979") else { return false }
        return hasValidEAN13CheckDigit(digits)
    }

    /// バーコード読み取り結果から本の ISBN を取り出す。価格バーコード（192始まり）は弾く。
    /// 妥当な ISBN-13 でなければ nil。
    public static func fromScannedCode(_ raw: String) -> String? {
        let digits = digitsOnly(raw)
        guard isValidISBN13(digits) else { return nil }
        return digits
    }

    /// EAN-13 のチェックディジット検証。
    private static func hasValidEAN13CheckDigit(_ digits: String) -> Bool {
        let nums = digits.compactMap { $0.wholeNumberValue }
        guard nums.count == 13 else { return false }
        var sum = 0
        for (index, value) in nums.prefix(12).enumerated() {
            sum += (index % 2 == 0) ? value : value * 3
        }
        let check = (10 - (sum % 10)) % 10
        return check == nums[12]
    }
}
