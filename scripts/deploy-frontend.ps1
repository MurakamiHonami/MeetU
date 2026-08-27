<#
.SYNOPSIS
  LIFF フロントをビルドして S3 にアップロードし、CloudFront のキャッシュを消す。

.DESCRIPTION
  sam deploy 済みのスタックから Outputs を読み取り、frontend/.env を自動生成してから
  ビルド・同期・キャッシュ削除までを一括で行う。

.EXAMPLE
  .\scripts\deploy-frontend.ps1 -StackName otaku-match -LiffId 1234567890-abcdefgh
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$StackName,

  # 省略時は frontend/.env に書かれている値を引き継ぐ
  [string]$LiffId
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"
$envFile = Join-Path $frontend ".env"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI が見つかりません。先にインストールしてください。"
}

Write-Host "スタックの Outputs を取得しています: $StackName" -ForegroundColor Cyan
$json = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output json
if ($LASTEXITCODE -ne 0) { throw "スタック $StackName の情報を取得できませんでした。" }
$outputs = $json | ConvertFrom-Json

function Get-StackOutput([string]$key) {
  $hit = $outputs | Where-Object { $_.OutputKey -eq $key }
  if (-not $hit) { throw "Outputs に $key がありません。sam deploy は完了していますか？" }
  return $hit.OutputValue
}

$apiBase = Get-StackOutput "ApiBaseUrl"
$bucket = Get-StackOutput "FrontendBucketName"
$distId = Get-StackOutput "FrontendDistributionId"
$frontUrl = Get-StackOutput "FrontendUrl"

# LIFF ID は引数優先、無ければ既存の .env から引き継ぐ
if (-not $LiffId) {
  if (Test-Path $envFile) {
    $line = Select-String -Path $envFile -Pattern "^VITE_LIFF_ID=(.+)$" | Select-Object -First 1
    if ($line) { $LiffId = $line.Matches[0].Groups[1].Value.Trim() }
  }
}
if (-not $LiffId) {
  throw "LIFF ID が未指定です。-LiffId で渡すか frontend/.env に VITE_LIFF_ID を書いてください。"
}

Write-Host "frontend/.env を書き出します" -ForegroundColor Cyan
$content = "VITE_LIFF_ID=$LiffId`nVITE_API_BASE=$apiBase`n"
# Vite は BOM を嫌うので ASCII で書く
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.ASCIIEncoding))

Set-Location $frontend
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Write-Host "依存をインストールします" -ForegroundColor Cyan
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install に失敗しました。" }
}

Write-Host "ビルドします" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "ビルドに失敗しました。" }

Write-Host "S3 に同期します: s3://$bucket" -ForegroundColor Cyan
# index.html はキャッシュさせない。ハッシュ付きの assets は長期キャッシュする
aws s3 sync dist "s3://$bucket" --delete --exclude "index.html" --cache-control "public,max-age=31536000,immutable"
if ($LASTEXITCODE -ne 0) { throw "S3 への同期に失敗しました。" }

aws s3 cp dist/index.html "s3://$bucket/index.html" --cache-control "no-cache,must-revalidate" --content-type "text/html; charset=utf-8"
if ($LASTEXITCODE -ne 0) { throw "index.html のアップロードに失敗しました。" }

Write-Host "CloudFront のキャッシュを削除します: $distId" -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" --output text --query "Invalidation.Id"
if ($LASTEXITCODE -ne 0) { throw "キャッシュ削除に失敗しました。" }

Set-Location $root

Write-Host ""
Write-Host "完了しました。" -ForegroundColor Green
Write-Host "  公開 URL : $frontUrl"
Write-Host "  API      : $apiBase"
Write-Host ""
Write-Host "この URL を LINE Developers の LIFF エンドポイント URL に設定してください。" -ForegroundColor Yellow
Write-Host "キャッシュ削除の反映には数分かかります。" -ForegroundColor Yellow
