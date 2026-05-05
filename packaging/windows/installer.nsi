Unicode true
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"

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

!define APP_NAME "Prosecnur"
!define APP_PUBLISHER "Pulso"
!define APP_VERSION "0.2.1"
!define APP_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Prosecnur"
!define APP_PROGID "Prosecnur.Project"
!define APP_EXT ".pulso"

Name "${APP_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Prosecnur"
RequestExecutionLevel user
ShowInstDetails show
ShowUnInstDetails show

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

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "Spanish"

Function RefreshShell
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
FunctionEnd

Function un.RefreshShell
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
FunctionEnd

Section "Prosecnur" SecMain
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR"
  CreateDirectory "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

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

Section "Uninstall"
  Delete "$DESKTOP\Prosecnur.lnk"
  Delete "$SMPROGRAMS\Prosecnur\Prosecnur.lnk"
  Delete "$SMPROGRAMS\Prosecnur\Desinstalar Prosecnur.lnk"
  RMDir "$SMPROGRAMS\Prosecnur"

  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "Software\Classes\${APP_EXT}"
  DeleteRegKey HKCU "Software\Classes\${APP_PROGID}"

  RMDir /r "$LOCALAPPDATA\Prosecnur\R"
  RMDir /r "$LOCALAPPDATA\Prosecnur\r-library"
  Delete "$LOCALAPPDATA\Prosecnur\r-deps-offline-installed"
  Delete "$LOCALAPPDATA\Prosecnur\quarto-checked"
  RMDir "$LOCALAPPDATA\Prosecnur"

  RMDir /r "$INSTDIR"
  Call un.RefreshShell
SectionEnd
