@echo off
REM =============================================================================
REM Prosecnur - launcher Windows (doble click para abrir)
REM =============================================================================
REM Equivalente del Prosecnur.app de macOS. Detecta modo DEV (este .bat
REM vive en la raiz del repo) vs PACKAGED (dentro de dist.nosync\Prosecnur\
REM tras make package-local), verifica toolchain, auto-instala paquetes R
REM la primera vez, y lanza la ventana Electron.

setlocal EnableDelayedExpansion

REM ---------- Paths y deteccion de modo ----------------------------------------
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PACKAGED_INTERNALS=%SCRIPT_DIR%\Internals"
set "DEV_REPO_ROOT=%SCRIPT_DIR%"

if exist "%PACKAGED_INTERNALS%\api\R" (
  set "MODE=packaged"
  set "INTERNALS=%PACKAGED_INTERNALS%"
) else if exist "%DEV_REPO_ROOT%\api\R" if exist "%DEV_REPO_ROOT%\desktop" (
  set "MODE=dev"
  set "INTERNALS=%DEV_REPO_ROOT%"
) else (
  msg * /time:60 "Prosecnur.bat no encontro el codigo fuente. Debe vivir en la raiz del repo (modo dev) o dentro de dist.nosync\Prosecnur\ (modo packaged)."
  exit /b 1
)

set "LOG_DIR=%LOCALAPPDATA%\Prosecnur\logs"
set "LOG_FILE=%LOG_DIR%\desktop.log"
set "SETUP_LOG=%LOG_DIR%\setup.log"
set "RUNTIME_ROOT=%LOCALAPPDATA%\Prosecnur"
set "R_DEPS_SENTINEL=%RUNTIME_ROOT%\r-deps-installed"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%RUNTIME_ROOT%" mkdir "%RUNTIME_ROOT%"
echo [%date% %time%] Arranque en modo: %MODE% (INTERNALS=%INTERNALS%) >> "%LOG_FILE%"

REM ---------- 1. Toolchain checks ----------------------------------------------
where Rscript >nul 2>&1
if errorlevel 1 (
  msg * /time:60 "Prosecnur necesita R 4.1 o superior. Instala desde https://cran.r-project.org y abre Prosecnur nuevamente."
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  msg * /time:60 "Prosecnur necesita Node.js 20 o superior. Instala desde https://nodejs.org y abre Prosecnur nuevamente."
  exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1 && corepack enable >nul 2>&1
  where pnpm >nul 2>&1
  if errorlevel 1 (
    msg * /time:60 "Prosecnur necesita pnpm. En cmd: corepack enable (o npm install -g pnpm). Luego abre Prosecnur nuevamente."
    exit /b 1
  )
)

REM ---------- 2. Paquetes R (primera vez) --------------------------------------
if not exist "%R_DEPS_SENTINEL%" (
  echo [%date% %time%] Instalando paquetes R >> "%SETUP_LOG%"
  Rscript "%INTERNALS%\launcher\install-r-deps.R" >> "%SETUP_LOG%" 2>&1
  if errorlevel 1 (
    msg * /time:60 "No se pudieron instalar los paquetes de R. Revisa %SETUP_LOG%"
    exit /b 1
  )
  type nul > "%R_DEPS_SENTINEL%"
)

REM ---------- 2b. Quarto CLI (opcional, para reportes PDF de enumeradores) ----
REM Si falta, ofrecemos instalarlo via winget (built-in en Windows 10+).
REM Sentinel para no preguntar de nuevo despues de la decision del user.
set "QUARTO_SENTINEL=%RUNTIME_ROOT%\quarto-checked"
where quarto >nul 2>&1
if errorlevel 1 (
  if not exist "%QUARTO_SENTINEL%" (
    where winget >nul 2>&1
    if not errorlevel 1 (
      echo [%date% %time%] Quarto no encontrado, intentando winget install >> "%SETUP_LOG%"
      msg * /time:30 "Prosecnur va a instalar Quarto CLI (necesario para reportes PDF de enumeradores). Toma unos minutos."
      winget install --id Posit.Quarto -e --silent --accept-package-agreements --accept-source-agreements >> "%SETUP_LOG%" 2>&1
      if errorlevel 1 (
        msg * /time:60 "No se pudo instalar Quarto via winget. Instalalo manual desde https://quarto.org/docs/get-started/. Las demas fases funcionan sin Quarto."
      )
      type nul > "%QUARTO_SENTINEL%"
    ) else (
      msg * /time:60 "Falta Quarto CLI (necesario solo para reportes PDF de enumeradores). Instalalo desde https://quarto.org/docs/get-started/. Las demas fases funcionan sin Quarto."
      type nul > "%QUARTO_SENTINEL%"
    )
  )
)

REM ---------- 3. Preparar Electron segun modo ----------------------------------
if "%MODE%"=="dev" (
  set "DESKTOP_DIR=%INTERNALS%\desktop"
  set "FRONTEND_DIR=%INTERNALS%\frontend"

  if not exist "!DESKTOP_DIR!\node_modules\electron" (
    echo [%date% %time%] pnpm install en desktop\ >> "%SETUP_LOG%"
    pnpm --dir "!DESKTOP_DIR!" install >> "%SETUP_LOG%" 2>&1
    if errorlevel 1 (
      msg * /time:60 "pnpm install en desktop\ fallo. Revisa %SETUP_LOG%"
      exit /b 1
    )
  )
  if not exist "!FRONTEND_DIR!\node_modules" (
    echo [%date% %time%] pnpm install en frontend\ >> "%SETUP_LOG%"
    pnpm --dir "!FRONTEND_DIR!" install >> "%SETUP_LOG%" 2>&1
    if errorlevel 1 (
      msg * /time:60 "pnpm install en frontend\ fallo. Revisa %SETUP_LOG%"
      exit /b 1
    )
  )

  REM Rebuild frontend si el build no existe o es mas viejo que algun source.
  REM Comparamos timestamps con forfiles — si encuentra al menos uno mas nuevo,
  REM build=1.
  set "BUILD_INDEX=%INTERNALS%\api\inst\www\index.html"
  set "needs_build=0"
  if not exist "!BUILD_INDEX!" (
    set "needs_build=1"
  ) else (
    REM Compara: hay algun archivo en frontend\src mas nuevo que el build?
    for /f %%t in ('powershell -NoProfile -Command "if ((Get-ChildItem -Path '%INTERNALS%\frontend\src','%INTERNALS%\frontend\index.html','%INTERNALS%\frontend\package.json' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Item '!BUILD_INDEX!').LastWriteTime } | Select-Object -First 1) -ne $null) { Write-Output 1 } else { Write-Output 0 }"') do set "needs_build=%%t"
  )
  if "!needs_build!"=="1" (
    echo [%date% %time%] pnpm build en frontend\ >> "%SETUP_LOG%"
    pnpm --dir "!FRONTEND_DIR!" build >> "%SETUP_LOG%" 2>&1
    if errorlevel 1 (
      msg * /time:60 "pnpm build del frontend fallo. Revisa %SETUP_LOG%"
      exit /b 1
    )
  )

  set "PULSO_APP_ROOT=%INTERNALS%"
  cd /d "!DESKTOP_DIR!"
  echo [%date% %time%] Lanzando Electron (dev) >> "%LOG_FILE%"
  start "" /B pnpm --dir "!DESKTOP_DIR!" start >> "%LOG_FILE%" 2>&1

) else (
  REM PACKAGED
  set "RUNTIME_DESKTOP=%RUNTIME_ROOT%\desktop-runtime"
  if not exist "!RUNTIME_DESKTOP!" mkdir "!RUNTIME_DESKTOP!"
  robocopy "%INTERNALS%\desktop" "!RUNTIME_DESKTOP!" /MIR /XD node_modules /XF .DS_Store >> "%SETUP_LOG%" 2>&1
  REM robocopy devuelve 0-7 como exito; >=8 es error real.
  if errorlevel 8 (
    msg * /time:60 "Copia del runtime fallo. Revisa %SETUP_LOG%"
    exit /b 1
  )

  if not exist "!RUNTIME_DESKTOP!\node_modules\electron" (
    echo [%date% %time%] pnpm install en !RUNTIME_DESKTOP! >> "%SETUP_LOG%"
    pnpm --dir "!RUNTIME_DESKTOP!" install >> "%SETUP_LOG%" 2>&1
    if errorlevel 1 (
      msg * /time:60 "No se pudo instalar Electron. Revisa %SETUP_LOG%"
      exit /b 1
    )
  )

  set "PULSO_APP_ROOT=%INTERNALS%"
  cd /d "!RUNTIME_DESKTOP!"
  echo [%date% %time%] Lanzando Electron (packaged) >> "%LOG_FILE%"
  start "" /B pnpm --dir "!RUNTIME_DESKTOP!" start >> "%LOG_FILE%" 2>&1
)

endlocal
exit /b 0
