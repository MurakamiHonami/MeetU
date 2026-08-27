# ADR

## 言語

TypeScript : CloudFlare内で完結させたかったため。N:N交換の時に、TypeScriptだと実行速度に不安が残るが、CloudFlareのWorkerはTypeScriptしか使用できないため、TypeScriptを選択。
処理が大きくなるようであれば、RustをLambdaで使用することも検討する。

## データベース

D1 : CloudFlareのSQLデータベース。基本的なユーザー管理や、投稿の管理などを行う。

KV : CloudFlareのKey-Valueデータベース。トレンドを管理する。トレンドは、毎度計算するのではなく、定期的にCron Triggerで計算してKVに保存する。

R2 : CloudFlareのObject Storage。投稿された画像、DMの添付ファイルなどを保存する

## ソフトウェアアーキテクチャ

DDD : ドメイン駆動設計を採用する。特にN:N交換の部分は、ドメイン駆動設計を採用しないと、複雑なビジネスロジックを表現できない。
クリーンアーキテクト : ビジネスロジックはDBに依存せずテスト可能であるべき。
