# Fixed Income Portfolio Management Workstation - Built-in Windows Web Server
# Requires NO Node.js or external dependencies - Uses Windows built-in .NET HttpListener

param(
    [int]$Port = 3000,
    [string]$DistFolder = "$PSScriptRoot\dist"
)

$ErrorActionPreference = "Continue"

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "         FIXED INCOME PORTFOLIO MANAGEMENT WORKSTATION" -ForegroundColor Yellow
Write-Host "              Built-in Windows Standalone Server" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "$DistFolder\index.html")) {
    Write-Host "[ERROR] Distribution folder not found at: $DistFolder" -ForegroundColor Red
    Write-Host "Please ensure the app has been built or run_desktop.bat has been executed." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Enter to exit..."
    Read-Host
    exit 1
}

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".wasm" = "application/wasm"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
}

# Find an available port if 3000 is taken
$TestPort = $Port
$MaxPort = $Port + 10
$Bound = $false
$Listener = New-Object System.Net.HttpListener

while (-not $Bound -and $TestPort -le $MaxPort) {
    try {
        $Listener.Prefixes.Clear()
        $Listener.Prefixes.Add("http://127.0.0.1:$TestPort/")
        $Listener.Start()
        $Bound = $true
        $Port = $TestPort
    } catch {
        $TestPort++
    }
}

if (-not $Bound) {
    Write-Host "[ERROR] Could not bind to ports 3000-3010. Please check your firewall or close port 3000." -ForegroundColor Red
    Write-Host "Press Enter to exit..."
    Read-Host
    exit 1
}

$Url = "http://127.0.0.1:$Port/"
Write-Host "[+] Local Server successfully started!" -ForegroundColor Green
Write-Host "[+] Serving from: $DistFolder" -ForegroundColor Gray
Write-Host "[+] Access URL:   $Url" -ForegroundColor Green
Write-Host ""
Write-Host "Opening your browser now..." -ForegroundColor Cyan

# Open in Edge app mode if available, else default browser
$EdgePath1 = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$EdgePath2 = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
$ChromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"

if (Test-Path $EdgePath1) {
    Start-Process -FilePath $EdgePath1 -ArgumentList "--app=$Url"
} elseif (Test-Path $EdgePath2) {
    Start-Process -FilePath $EdgePath2 -ArgumentList "--app=$Url"
} elseif (Test-Path $ChromePath) {
    Start-Process -FilePath $ChromePath -ArgumentList "--app=$Url"
} else {
    Start-Process $Url
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host " WORKSTATION IS RUNNING. KEEP THIS WINDOW OPEN WHILE USING THE APPLICATION." -ForegroundColor Green
Write-Host " To stop the server, press Ctrl+C in this window or close it." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

# HTTP Request processing loop
while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $RawPath = $Request.Url.LocalPath
        if ($RawPath -eq "/" -or [string]::IsNullOrWhiteSpace($RawPath)) {
            $RawPath = "/index.html"
        }

        # Safe local path resolution
        $RelativePath = $RawPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $FilePath = [System.IO.Path]::Combine($DistFolder, $RelativePath)

        # SPA Routing: If file doesn't exist, fallback to index.html
        if (-not (Test-Path $FilePath -PathType Leaf)) {
            $FilePath = [System.IO.Path]::Combine($DistFolder, "index.html")
        }

        $Extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
        $ContentType = "application/octet-stream"
        if ($MimeTypes.ContainsKey($Extension)) {
            $ContentType = $MimeTypes[$Extension]
        }

        $Response.ContentType = $ContentType
        $Response.Headers.Add("Cache-Control", "no-cache")
        $Response.Headers.Add("Access-Control-Allow-Origin", "*")

        $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $Response.ContentLength64 = $Bytes.Length
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        $Response.OutputStream.Close()
    } catch {
        # Suppress closed socket errors on client disconnect
    }
}
