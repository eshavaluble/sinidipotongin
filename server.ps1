# server.ps1 - HTTP Server with COOP and COEP headers
$port = 8787
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Ensure COI ServiceWorker exists
if (-Not (Test-Path "coi-serviceworker.js")) {
    Write-Warning "coi-serviceworker.js tidak ditemukan! Ini diperlukan untuk FFmpeg WASM."
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host " SiniDipotongin Server " -ForegroundColor Yellow
    Write-Host " Server berjalan di: http://localhost:$port" -ForegroundColor Green
    Write-Host " Tekan Ctrl+C untuk menghentikan server" -ForegroundColor Gray
    Write-Host "======================================================" -ForegroundColor Cyan
    
    # Auto-open browser
    Start-Process "http://localhost:$port"
}
catch {
    Write-Host "Gagal memulai server di port $port. Port mungkin sedang digunakan." -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    exit
}

function Get-MimeType ($Extension) {
    switch ($Extension.ToLower()) {
        ".html" { return "text/html" }
        ".css" { return "text/css" }
        ".js" { return "application/javascript" }
        ".wasm" { return "application/wasm" }
        ".mp4" { return "video/mp4" }
        ".webm" { return "video/webm" }
        ".png" { return "image/png" }
        ".jpg" { return "image/jpeg" }
        ".svg" { return "image/svg+xml" }
        ".json" { return "application/json" }
        default { return "application/octet-stream" }
    }
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    
    $localPath = Join-Path $scriptPath $path
    
    # Required for FFmpeg SharedArrayBuffer
    $response.Headers.Add("Cross-Origin-Opener-Policy", "same-origin")
    $response.Headers.Add("Cross-Origin-Embedder-Policy", "require-corp")

    if (Test-Path $localPath -PathType Leaf) {
        $response.ContentType = Get-MimeType (Split-Path $localPath -Extension)
        $content = [System.IO.File]::ReadAllBytes($localPath)
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
        Write-Host "200 OK  $path" -ForegroundColor Green
    }
    else {
        $response.StatusCode = 404
        Write-Host "404 ERR $path" -ForegroundColor Red
    }
    
    $response.Close()
}
