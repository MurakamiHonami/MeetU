import XCTest
@testable import MeetUKit

final class ISBNTests: XCTestCase {
    func testValidISBN13() {
        // リーダブルコード
        XCTAssertTrue(ISBN.isValidISBN13("9784873115658"))
        // 達人プログラマー
        XCTAssertTrue(ISBN.isValidISBN13("9784274226298"))
    }

    func testHyphenatedIsNormalized() {
        XCTAssertTrue(ISBN.isValidISBN13("978-4-87311-565-8"))
        XCTAssertEqual(ISBN.fromScannedCode("978-4-87311-565-8"), "9784873115658")
    }

    func testWrongCheckDigitRejected() {
        XCTAssertFalse(ISBN.isValidISBN13("9784873115659"))
    }

    func testNonBookPrefixRejected() {
        // 価格バーコード（192 始まり）は本の ISBN ではない
        XCTAssertNil(ISBN.fromScannedCode("1920000123456"))
    }

    func testTooShortRejected() {
        XCTAssertFalse(ISBN.isValidISBN13("97848731156"))
        XCTAssertNil(ISBN.fromScannedCode("12345"))
    }
}
