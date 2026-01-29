@echo off
chcp 65001 >nul
cd /d "%~dp0"

set REMOTE=https://github.com/rytesdd/BizAgent.git

where git >nul 2>&1
if errorlevel 1 (
    echo Git not found. Please install: https://git-scm.com/download/win
    echo Then double-click this file again to push to %REMOTE%
    pause
    exit /b 1
)

echo Pushing to %REMOTE% ...
if not exist ".git" (
    git init
    echo Initialized repo.
)
git add .
git status --short | findstr /r "." >nul 2>&1
if errorlevel 1 (
    echo Nothing new to commit.
) else (
    git commit -m "feat: PRD comments follow doc, clear on new PRD, click to locate"
    echo Committed.
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REMOTE%
    echo Remote added: %REMOTE%
) else (
    git remote set-url origin %REMOTE%
)

for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%b
if "%BRANCH%"=="" set BRANCH=main
echo Pushing to origin/%BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo.
    echo If first push failed, try: git pull origin %BRANCH% --rebase
    echo Then run this file again.
    pause
    exit /b 1
)
echo Done. Code is at https://github.com/rytesdd/BizAgent
pause
