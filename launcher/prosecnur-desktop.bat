@echo off
cd /d "%~dp0\.."
if not exist "desktop\node_modules\electron" (
  pnpm --dir desktop install
)
pnpm --dir desktop start
