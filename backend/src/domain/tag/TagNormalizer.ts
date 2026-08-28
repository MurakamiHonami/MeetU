export class TagNormalizer {
  static normalize(input: string): string {
    return input
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\t\n\r_,\-./#＃!！?？]/g, "");
  }
}
