# One-click Git init, commit, push for BizAgent
# Run: .\git-push.ps1
# With remote: .\git-push.ps1 "https://github.com/user/repo.git"

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

$gitExe = $null
$paths = @(
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
    "$env:ProgramFiles\Git\bin\git.exe"
)
foreach ($p in $paths) {
    if ($p -and (Test-Path $p -ErrorAction SilentlyContinue)) {
        $gitExe = $p
        break
    }
}
if (-not $gitExe) {
    $g = Get-Command git -ErrorAction SilentlyContinue
    if ($g) { $gitExe = $g.Source }
}
if (-not $gitExe) {
    Write-Host "Git not found. Install from https://git-scm.com/download/win"
    exit 1
}

& $gitExe --version
Write-Host ""

Set-Location $projectRoot

if (-not (Test-Path ".git")) {
    & $gitExe init
    Write-Host "Git repo initialized."
}

& $gitExe add .
$status = & $gitExe status --short
if ($status) {
    & $gitExe commit -m "feat: PRD comments follow doc, clear on new PRD, click to locate"
    Write-Host "Committed."
}
else {
    Write-Host "Nothing to commit."
}

$defaultRemote = "https://github.com/rytesdd/BizAgent.git"
$remoteUrl = $args[0]
$origin = & $gitExe remote get-url origin 2>$null
if ($remoteUrl) {
    if ($origin) { & $gitExe remote set-url origin $remoteUrl }
    else { & $gitExe remote add origin $remoteUrl }
    $origin = $remoteUrl
    Write-Host "Remote set: $origin"
}
elseif (-not $origin) {
    & $gitExe remote add origin $defaultRemote
    $origin = $defaultRemote
    Write-Host "Remote set (default): $origin"
}

$branch = & $gitExe rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { $branch = "main" }
Write-Host "Pushing to origin/$branch ..."
& $gitExe push -u origin $branch 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Try: git pull origin $branch --rebase; git push -u origin $branch"
    exit $LASTEXITCODE
}
Write-Host "Done."
