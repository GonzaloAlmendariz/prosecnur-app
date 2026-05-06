Unicode true
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!ifndef SOURCE_DIR
  !error "SOURCE_DIR no definido"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE no definido"
!endif
!ifndef ICON_FILE
  !error "ICON_FILE no definido"
!endif
!ifndef WIZARD_BITMAP
  !error "WIZARD_BITMAP no definido"
!endif
!ifndef HEADER_BITMAP
  !error "HEADER_BITMAP no definido"
!endif
!ifndef APP_VERSION
  !error "APP_VERSION no definido (debe venir de api/DESCRIPTION via build-self-contained.sh)"
!endif

!define APP_NAME "Prosecnur"
!define APP_PUBLISHER "Pulso"
!define APP_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Prosecnur"
!define APP_PROGID "Prosecnur.Project"
!define APP_EXT ".pulso"

Name "${APP_NAME}"
OutFile "${OUTPUT_FILE}"
; InstallDir fijo: el instalador es single-user y no exponemos pagina de
; directorio. Asi evitamos que el usuario apunte a una carpeta arbitraria
; y que el RMDir borre cosas que no son nuestras.
InstallDir "$LOCALAPPDATA\Programs\Prosecnur"
RequestExecutionLevel user

!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${WIZARD_BITMAP}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${WIZARD_BITMAP}"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${HEADER_BITMAP}"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Prosecnur.bat"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Prosecnur"

; Brand text en lugar del default "Nullsoft Install System".
BrandingText "Prosecnur ${APP_VERSION} — Pulso"

; Texto de la pagina Welcome (mas amigable que el default de NSIS).
!define MUI_WELCOMEPAGE_TITLE "Bienvenido al instalador de Prosecnur"
!define MUI_WELCOMEPAGE_TEXT "Este asistente te guiara en la instalacion de Prosecnur ${APP_VERSION}.$\r$\n$\r$\nProsecnur traera todo lo que necesita para funcionar — incluyendo R 4.5.1 y los paquetes que usa el motor analitico — asi que no tienes que instalar nada por separado.$\r$\n$\r$\nLa instalacion no requiere permisos de administrador y se realiza por usuario.$\r$\n$\r$\nHaz click en Siguiente para empezar."

!define MUI_FINISHPAGE_TITLE "Listo para usar Prosecnur"
!define MUI_FINISHPAGE_TEXT "Prosecnur ${APP_VERSION} se instalo correctamente, junto con R y todas sus dependencias.$\r$\n$\r$\nPuedes abrirlo desde el acceso directo del Escritorio o el menu Inicio. Tambien puedes hacer doble click sobre cualquier archivo .pulso."

; Detalles del log tecnico colapsados por default. El usuario solo ve la barra
; de progreso y los DetailPrint que escribimos abajo en espanol — si quiere
; ver el log crudo, expande "Mostrar detalles".
ShowInstDetails hide
ShowUnInstDetails hide

; Sin MUI_PAGE_DIRECTORY: el path es fijo en $LOCALAPPDATA\Programs\Prosecnur.
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "Spanish"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "Instalador de ${APP_NAME}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "${APP_PUBLISHER}"

Function RefreshShell
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
FunctionEnd

Function un.RefreshShell
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
FunctionEnd

; -----------------------------------------------------------------------------
; KillRunningProcesses — mata procesos Prosecnur/Electron que esten corriendo
; antes de tocar archivos del bundle. Sin esto, los .dll y .exe quedan
; lockeados por Windows y la instalacion falla con "no se puede escribir".
;
; /F = force (no preguntar), /T = matar arbol entero (procesos hijos).
; nsExec::Exec (no ExecToLog) evita que la salida moleste el detail log.
; >nul oculta el "ERROR: not found" cuando el proceso no esta corriendo
; (que es lo normal en el caso happy path).
; -----------------------------------------------------------------------------
Function KillRunningProcesses
  DetailPrint "Cerrando instancias previas de Prosecnur..."
  nsExec::Exec 'cmd /C taskkill /F /IM electron.exe /T 2>nul'
  Pop $R0
  nsExec::Exec 'cmd /C taskkill /F /IM Prosecnur.exe /T 2>nul'
  Pop $R0
  ; Pausa breve para que Windows libere los file handles que el proceso
  ; matado pueda haber tenido abiertos. Sin esto, RMDir /r y File /r del
  ; runtime/electron pueden fallar con "archivo en uso".
  Sleep 1500
FunctionEnd

Function un.KillRunningProcesses
  DetailPrint "Cerrando instancias previas de Prosecnur..."
  nsExec::Exec 'cmd /C taskkill /F /IM electron.exe /T 2>nul'
  Pop $R0
  nsExec::Exec 'cmd /C taskkill /F /IM Prosecnur.exe /T 2>nul'
  Pop $R0
  Sleep 1500
FunctionEnd

; -----------------------------------------------------------------------------
; .onInit: chequeos previos a instalar.
;   1) Arquitectura x64 (el bundle trae R y Electron x64).
;   2) Si hay una instalacion previa, correr su uninstaller silenciosamente
;      para tener un upgrade limpio sin restos huerfanos.
; -----------------------------------------------------------------------------
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Prosecnur requiere Windows de 64 bits (x64). Esta computadora reporta una arquitectura distinta y la instalacion no puede continuar."
    Abort
  ${EndIf}

  ; Matar procesos Prosecnur que puedan estar corriendo. Cubre el caso de
  ; instalar mientras la app esta abierta y tambien el caso de un install
  ; previo que crasheo dejando un electron.exe huerfano.
  Call KillRunningProcesses

  ReadRegStr $0 HKCU "${APP_REGKEY}" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 HKCU "${APP_REGKEY}" "DisplayVersion"
    MessageBox MB_OKCANCEL|MB_ICONQUESTION \
      "Prosecnur $1 ya esta instalado.$\r$\n$\r$\nVamos a desinstalar la version anterior antes de instalar ${APP_VERSION}. Tus proyectos .pulso y los datos en %LOCALAPPDATA%\Prosecnur (R, paquetes, logs) se conservan." \
      IDOK uninstall_previous
    Abort
    uninstall_previous:
      ReadRegStr $2 HKCU "${APP_REGKEY}" "InstallLocation"
      ; /UPGRADE le indica al uninstaller que estamos en upgrade in-place
      ; y NO debe borrar el runtime compartido en %LOCALAPPDATA%\Prosecnur
      ; (R local + paquetes offline). _?=$2 hace que el uninstaller NO se
      ; relance desde temp y que ExecWait realmente espere a que termine.
      ExecWait '"$0" /S /UPGRADE _?=$2' $3
      ${If} $3 != 0
        MessageBox MB_ICONSTOP "No se pudo desinstalar la version anterior (codigo $3). Desinstalala manualmente desde 'Aplicaciones y caracteristicas' y vuelve a ejecutar este instalador."
        Abort
      ${EndIf}
      ; Tras /S _?=$2, el uninstaller no se borra a si mismo: lo limpiamos.
      Delete "$2\Uninstall.exe"
      ; Sleep extra: aunque ExecWait espera a que el proceso del uninstaller
      ; termine, Windows puede tardar 1-2s mas en soltar handles a los .dll
      ; del bundle viejo. Sin este Sleep, el File /r de la nueva version
      ; encuentra archivos lockeados y aborta con "no se puede escribir".
      Sleep 2000
  ${EndIf}
FunctionEnd

; -----------------------------------------------------------------------------
; Seccion 1: archivos del programa (Electron, motor R, frontend, runtime).
; -----------------------------------------------------------------------------
Section "Archivos del programa" SecFiles
  DetailPrint ""
  DetailPrint "Copiando archivos del programa..."
  ; Borrado selectivo: solo subdirectorios que el bundle escribe. Asi nunca
  ; tocamos nada que el usuario haya puesto manualmente en $INSTDIR.
  RMDir /r "$INSTDIR\Internals"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\assets"
  Delete "$INSTDIR\Prosecnur.bat"
  Delete "$INSTDIR\LEEME_PRIMERO.md"
  Delete "$INSTDIR\README_DESARROLLO.md"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\Uninstall.exe"

  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  DetailPrint "Creando accesos directos..."
  CreateDirectory "$SMPROGRAMS\Prosecnur"
  CreateShortcut "$SMPROGRAMS\Prosecnur\Prosecnur.lnk" "$INSTDIR\Prosecnur.bat" "" "$INSTDIR\assets\prosecnur.ico"
  CreateShortcut "$SMPROGRAMS\Prosecnur\Desinstalar Prosecnur.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\assets\prosecnur.ico"
  CreateShortcut "$DESKTOP\Prosecnur.lnk" "$INSTDIR\Prosecnur.bat" "" "$INSTDIR\assets\prosecnur.ico"

  WriteRegStr HKCU "${APP_REGKEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_REGKEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayIcon" "$INSTDIR\assets\prosecnur.ico"
  WriteRegStr HKCU "${APP_REGKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${APP_REGKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoRepair" 1

  WriteRegStr HKCU "Software\Classes\${APP_EXT}" "" "${APP_PROGID}"
  WriteRegStr HKCU "Software\Classes\${APP_EXT}" "Content Type" "application/x-prosecnur-project"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}" "" "Proyecto Prosecnur"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}\DefaultIcon" "" "$INSTDIR\assets\prosecnur.ico"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}\shell\open\command" "" '"$INSTDIR\Prosecnur.bat" "%1"'

  Call RefreshShell
SectionEnd

; -----------------------------------------------------------------------------
; Seccion 2: instalar R 4.5.1 en %LOCALAPPDATA%\Prosecnur\R (silencioso, sin
; permisos de admin). Skip si ya existe — caso tipico en upgrade in-place.
; -----------------------------------------------------------------------------
Section "Motor estadistico R" SecR
  DetailPrint ""
  ${If} ${FileExists} "$LOCALAPPDATA\Prosecnur\R\bin\Rscript.exe"
    DetailPrint "R ya esta instalado en %LOCALAPPDATA%\Prosecnur\R, se omite."
    Goto r_done
  ${EndIf}

  DetailPrint "Instalando R 4.5.1 (puede tomar 1-2 minutos)..."
  CreateDirectory "$LOCALAPPDATA\Prosecnur"

  ; Buscar el R-*-win.exe que el bundle copio a $INSTDIR\runtime\r-installer.
  FindFirst $0 $1 "$INSTDIR\runtime\r-installer\R-*-win.exe"
  ${If} $1 == ""
    FindClose $0
    MessageBox MB_ICONSTOP "El bundle no incluye el instalador de R en $INSTDIR\runtime\r-installer. La instalacion no puede continuar."
    Abort
  ${EndIf}
  StrCpy $2 "$INSTDIR\runtime\r-installer\$1"
  FindClose $0

  ; Inno Setup flags: silencioso total, sin reinicio, ruta forzada.
  ExecWait '"$2" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="$LOCALAPPDATA\Prosecnur\R"' $3
  ${If} $3 != 0
    MessageBox MB_ICONSTOP "No se pudo instalar R (codigo $3). Revisa que tu antivirus no haya bloqueado el instalador y vuelve a intentar."
    Abort
  ${EndIf}
  DetailPrint "R 4.5.1 instalado correctamente."

  r_done:
SectionEnd

; -----------------------------------------------------------------------------
; Seccion 3: instalar paquetes R offline desde $INSTDIR\runtime\r-packages a
; %LOCALAPPDATA%\Prosecnur\r-library. Skip si el sentinel ya existe.
; -----------------------------------------------------------------------------
Section "Paquetes R" SecRPackages
  DetailPrint ""
  ${If} ${FileExists} "$LOCALAPPDATA\Prosecnur\r-deps-offline-installed"
    DetailPrint "Paquetes R ya estaban instalados, se omite."
    Goto packages_done
  ${EndIf}

  DetailPrint "Instalando paquetes R desde el bundle local (puede tomar 2-3 minutos)..."
  ; nsExec::ExecToLog corre sin ventana de consola y vuelca el stdout/stderr al
  ; log de detalles del instalador, asi el usuario que abra "Mostrar detalles"
  ; ve el progreso real de R sin parpadeos de cmd.
  nsExec::ExecToLog '"$LOCALAPPDATA\Prosecnur\R\bin\Rscript.exe" "$INSTDIR\Internals\offline-r\install-r-deps-offline.R" "$INSTDIR\runtime\r-packages" "$LOCALAPPDATA\Prosecnur\r-library"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "No se pudieron instalar los paquetes R (codigo $0). Abre Prosecnur una vez para reintentar; el motor reintentara al primer arranque."
    ; No abortamos: el .bat tiene fallback que reintenta al primer arranque.
    Goto packages_done
  ${EndIf}

  ; Sentinel para que el .bat sepa que ya esta listo y no reintente.
  FileOpen $1 "$LOCALAPPDATA\Prosecnur\r-deps-offline-installed" w
  FileClose $1
  DetailPrint "Paquetes R instalados correctamente."

  packages_done:
SectionEnd

; -----------------------------------------------------------------------------
; un.onInit: detecta si el uninstaller fue invocado por el instalador con el
; flag /UPGRADE. En ese caso preservamos el runtime compartido (R local y
; paquetes offline) para que el upgrade sea rapido.
; -----------------------------------------------------------------------------
Var IS_UPGRADE
Function un.onInit
  StrCpy $IS_UPGRADE "0"
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/UPGRADE" $R1
  ${IfNot} ${Errors}
    StrCpy $IS_UPGRADE "1"
  ${EndIf}
  ; Cerrar instancias antes de borrar archivos. Importante en upgrade in-place
  ; (el instalador nuevo nos invoca con /UPGRADE) y en uninstall manual.
  Call un.KillRunningProcesses
FunctionEnd

Section "Uninstall"
  Delete "$DESKTOP\Prosecnur.lnk"
  Delete "$SMPROGRAMS\Prosecnur\Prosecnur.lnk"
  Delete "$SMPROGRAMS\Prosecnur\Desinstalar Prosecnur.lnk"
  RMDir "$SMPROGRAMS\Prosecnur"

  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "Software\Classes\${APP_EXT}"
  DeleteRegKey HKCU "Software\Classes\${APP_PROGID}"

  ; Borrado selectivo de subdirectorios del bundle, igual que en la instalacion.
  RMDir /r "$INSTDIR\Internals"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\assets"
  Delete "$INSTDIR\Prosecnur.bat"
  Delete "$INSTDIR\LEEME_PRIMERO.md"
  Delete "$INSTDIR\README_DESARROLLO.md"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  ${If} $IS_UPGRADE == "1"
    ; Upgrade in-place: conservamos R local (no cambia entre versiones de la
    ; app) pero borramos el sentinel de paquetes para que el nuevo Setup
    ; reinstale los paquetes R del bundle nuevo encima de la library existente.
    ; install.packages() es idempotente y maneja overwrite de versiones.
    Delete "$LOCALAPPDATA\Prosecnur\r-deps-offline-installed"
  ${Else}
    ; Desinstalacion completa: limpiar todo el runtime compartido.
    RMDir /r "$LOCALAPPDATA\Prosecnur\R"
    RMDir /r "$LOCALAPPDATA\Prosecnur\r-library"
    Delete "$LOCALAPPDATA\Prosecnur\r-deps-offline-installed"
    Delete "$LOCALAPPDATA\Prosecnur\r-deps-installed"
    Delete "$LOCALAPPDATA\Prosecnur\quarto-checked"
    RMDir "$LOCALAPPDATA\Prosecnur"
  ${EndIf}

  Call un.RefreshShell
SectionEnd
