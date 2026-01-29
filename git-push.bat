@echo off
chcp 65001 >nul
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo Git not found. Please install: https://git-scm.com/download/win
    echo Then run this file again.
    pause
    exit /b 1
)

echo Git found. Initializing and committing...
if not exist ".git" git init
git add .
git status --short | findstr /r "." >nul 2>&1
if errorlevel 1 (
    echo Nothing to commit.
) else (
    git commit -m "feat: PRD comments follow doc, clear on new PRD, click to locate"
    echo Committed.
)

if not "%~1"=="" (
    git remote get-url origin >nul 2>&1
    if errorlevel 1 (git remote add origin "%~1") else (git remote set-url origin "%~1")
    echo Remote set to %~1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo.
    echo No remote yet. Add your repo URL:
    echo   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
    echo Then run this file again to push.
    echo.
    echo Or double-click and drag your repo URL onto this .bat file.
    pause
    exit /b 0
)

for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%b
if "%BRANCH%"=="" set BRANCH=main
echo Pushing to origin/%BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo Push failed. Try: git pull origin %BRANCH% --rebase
    pause
    exit /b 1
)
echo Done.
pause
