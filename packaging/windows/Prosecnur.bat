@echo off
REM =============================================================================
REM Prosecnur - Windows autosuficiente
REM =============================================================================
REM Este launcher vive dentro del bundle generado por:
REM   make package-windows-self-contained
REM
REM No requiere R, Node, pnpm ni internet en la computadora destino. Usa:
REM   runtime\electron\electron.exe
REM   runtime\r-installer\R-*-win.exe
REM   runtime\r-packages\*.zip

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "INTERNALS=%SCRIPT_DIR%\Internals"
set "RUNTIME=%SCRIPT_DIR%\runtime"
set "ELECTRON_EXE=%RUNTIME%\electron\electron.exe"
set "R_INSTALLER_DIR=%RUNTIME%\r-installer"
set "R_PACKAGES_DIR=%RUNTIME%\r-packages"
set "LOG_DIR=%LOCALAPPDATA%\Prosecnur\logs"
set "SETUP_LOG=%LOG_DIR%\setup-offline.log"
set "APP_LOG=%LOG_DIR%\desktop-offline.log"
set "USER_RUNTIME=%LOCALAPPDATA%\Prosecnur"
set "R_HOME_LOCAL=%USER_RUNTIME%\R"
set "R_LIBS_LOCAL=%USER_RUNTIME%\r-library"
set "R_DEPS_SENTINEL=%USER_RUNTIME%\r-deps-offline-installed"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%USER_RUNTIME%" mkdir "%USER_RUNTIME%"
echo [%date% %time%] Arranque Windows autosuficiente >> "%APP_LOG%"

if not exist "%INTERNALS%\api\R" (
  msg * /time:60 "No se encontro Internals\api\R dentro del bundle de Prosecnur."
  exit /b 1
)

if not exist "%ELECTRON_EXE%" (
  msg * /time:60 "No se encontro runtime\electron\electron.exe dentro del bundle de Prosecnur."
  exit /b 1
)

if not exist "%R_HOME_LOCAL%\bin\Rscript.exe" (
  echo [%date% %time%] Instalando R local en %R_HOME_LOCAL% >> "%SETUP_LOG%"
  for %%F in ("%R_INSTALLER_DIR%\R-*-win.exe") do set "R_INSTALLER=%%~fF"
  if not defined R_INSTALLER (
    msg * /time:60 "No se encontro el instalador de R en runtime\r-installer."
    exit /b 1
  )
  "%R_INSTALLER%" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="%R_HOME_LOCAL%" >> "%SETUP_LOG%" 2>&1
  if errorlevel 1 (
    msg * /time:60 "No se pudo instalar R local. Revisa %SETUP_LOG%"
    exit /b 1
  )
)

set "PULSO_RSCRIPT=%R_HOME_LOCAL%\bin\Rscript.exe"
set "R_LIBS_USER=%R_LIBS_LOCAL%"
set "PATH=%R_HOME_LOCAL%\bin;%PATH%"

if not exist "%R_DEPS_SENTINEL%" (
  echo [%date% %time%] Instalando paquetes R offline >> "%SETUP_LOG%"
  "%PULSO_RSCRIPT%" "%INTERNALS%\offline-r\install-r-deps-offline.R" "%R_PACKAGES_DIR%" "%R_LIBS_LOCAL%" >> "%SETUP_LOG%" 2>&1
  if errorlevel 1 (
    msg * /time:60 "No se pudieron instalar los paquetes R offline. Revisa %SETUP_LOG%"
    exit /b 1
  )
  type nul > "%R_DEPS_SENTINEL%"
)

REM Quarto CLI es opcional: si falta, solo se deshabilitan exportes PDF que lo
REM necesiten. El resto de Prosecnur queda completamente offline.
set "PULSO_APP_ROOT=%INTERNALS%"
cd /d "%INTERNALS%\desktop"
echo [%date% %time%] Lanzando Electron offline >> "%APP_LOG%"
start "" /B "%ELECTRON_EXE%" "%INTERNALS%\desktop" %* >> "%APP_LOG%" 2>&1

endlocal
exit /b 0
