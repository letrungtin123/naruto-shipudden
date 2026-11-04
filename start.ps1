$ErrorActionPreference = 'Stop'
$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

Write-Host ''
Write-Host '  SHINOBI SIEGE' -ForegroundColor Green
Write-Host '  Dang khoi dong tai http://localhost:8080' -ForegroundColor Cyan
Write-Host '  Nhan Ctrl+C de dung server.' -ForegroundColor DarkGray
Write-Host ''

if (Get-Command node -ErrorAction SilentlyContinue) {
  $env:SHINOBI_OPEN_BROWSER = '1'
  node server.js
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  Start-Process 'http://localhost:8080'
  py -m http.server $port
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  Start-Process 'http://localhost:8080'
  python -m http.server $port
} else {
  Write-Host 'Khong tim thay Node.js hoac Python. Dang mo truc tiep index.html.' -ForegroundColor Yellow
  Start-Process (Join-Path $root 'index.html')
  Read-Host 'Nhan Enter de thoat'
}
