; ============================================================
; NEXORA Browser - Chrome-style web installer stub
; Tiny Setup.exe: downloads the latest portable ZIP, extracts it,
; adds shortcuts + uninstaller, runs first-time setup, opens NEXORA.
; Per-user install (no admin needed). No URLs ever hard-code a version:
; the fixed asset name always resolves to the newest release.
; ============================================================
!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "NEXORA Browser"
OutFile "NEXORA-Setup.exe"
InstallDir "$LOCALAPPDATA\NEXORA Browser"
RequestExecutionLevel user
Icon "..\electron\assets\nexora-icon.ico"
UninstallIcon "..\electron\assets\nexora-icon.ico"
BrandingText "NEXORA Browser"
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "NEXORA Browser Setup"
VIAddVersionKey "CompanyName" "NEXORA"
VIAddVersionKey "FileDescription" "NEXORA Browser Setup"
VIAddVersionKey "FileVersion" "1.0"
VIAddVersionKey "LegalCopyright" "© 2026 NEXORA"

!ifndef APP_URL
!define APP_URL "https://github.com/khanhishan70-stack/NEXORA-Browser/releases/latest/download/NEXORA-Browser-Windows-x64.zip"
!endif
!define APP_EXE "NEXORA-win32-x64\NEXORA.exe"

; ---- pages ----
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Launch NEXORA Browser (first run sets everything up)"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function LaunchApp
  ExecShell "" "$INSTDIR\launch.bat"
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"

  DetailPrint "Downloading NEXORA (one time, ~350 MB)..."
  DetailPrint "Watch the progress below - leave this window open."
  Delete "$TEMP\nexora-dl.txt"
  Delete "$TEMP\nexora-app.zip"
  ; Kill any downloader left behind by a previous cancelled run (it would lock the file).
  nsExec::ExecToStack `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter 'Name = ''powershell.exe''' | Where-Object { $$_.CommandLine -like ''*nexora-app.zip*'' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0
  Pop $1
  ; Start the download detached (no window), then poll it with live MB + stall detection.
  nsExec::ExecToStack `cmd /c start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "try { $$drv = (Get-Item '$TEMP').PSDrive.Name; if (((Get-PSDrive $$drv).Free / 1GB) -lt 2) { 'NOSPACE' | Out-File '$TEMP\nexora-dl.txt' -Encoding ascii; return }; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${APP_URL}' -UseBasicParsing -OutFile '$TEMP\nexora-app.zip'; if ((Get-Item '$TEMP\nexora-app.zip').Length -gt 50000000) { 'OK' | Out-File '$TEMP\nexora-dl.txt' -Encoding ascii } else { 'SMALL' | Out-File '$TEMP\nexora-dl.txt' -Encoding ascii } } catch { ('FAIL:' + $$_.Exception.Message) | Out-File '$TEMP\nexora-dl.txt' -Encoding ascii }"`
  Pop $0
  Pop $1
  StrCpy $R8 -1
  StrCpy $R9 0
  StrCpy $R7 0
  dl_poll:
  Sleep 3000
  IfFileExists "$TEMP\nexora-dl.txt" dl_result
  FileOpen $R6 "$TEMP\nexora-app.zip" r
  IfErrors dl_nofile
  FileSeek $R6 0 END $R5
  FileClose $R6
  IntOp $R4 $R5 / 1048576
  StrCmp $R5 $R8 dl_samelen
  StrCpy $R8 $R5
  StrCpy $R9 0
  DetailPrint "Downloaded $R4 MB so far..."
  IntOp $R7 $R7 + 1
  IntCmp $R7 600 dl_toolong
  Goto dl_poll
  dl_samelen:
  IntOp $R9 $R9 + 1
  IntCmp $R9 40 dl_stalled
  IntOp $R7 $R7 + 1
  IntCmp $R7 600 dl_toolong
  Goto dl_poll
  dl_nofile:
  IntOp $R7 $R7 + 1
  IntCmp $R7 600 dl_toolong
  Goto dl_poll
  dl_stalled:
  DetailPrint "No data for 2 minutes - connection stalled."
  MessageBox MB_ICONSTOP "The download stalled (no data for 2 minutes). Check your connection and run Setup again."
  Abort
  dl_toolong:
  DetailPrint "Taking too long (30+ minutes)."
  MessageBox MB_ICONSTOP "The download is taking too long. Check your connection speed and try again later."
  Abort
  dl_result:
  FileOpen $2 "$TEMP\nexora-dl.txt" r
  IfErrors dl_fail
  FileRead $2 $3
  FileClose $2
  StrCmp $3 "OK$\r$\n" dl_ok
  StrCmp $3 "OK" dl_ok
  StrCpy $4 $3 7
  StrCmp $4 "NOSPACE" dl_nospace
  StrCpy $5 $3 220 5
  DetailPrint "Download failed: $5"
  MessageBox MB_ICONSTOP "Download failed:$\n$5$\nCheck your internet and try again."
  Abort
  dl_nospace:
  DetailPrint "Not enough disk space - free at least 2 GB and try again."
  MessageBox MB_ICONSTOP "Not enough disk space. Setup needs about 2 GB free. Free some space and try again."
  Abort
  dl_fail:
  DetailPrint "Download failed. Check your internet and try again."
  MessageBox MB_ICONSTOP "Download failed. Check your internet connection and run Setup again."
  Abort
  dl_ok:
  DetailPrint "Download complete. Installing files..."

  ; Extract (names are short now, no long-path risk) then lay out.
  ; The ZIP root holds one "NEXORA Browser" folder - merge its CONTENTS here.
  nsExec::ExecToStack `powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -LiteralPath '$TEMP\nexora-app.zip' -DestinationPath '$TEMP\nxu' -Force; 'OK' | Out-File '$TEMP\nexora-uz.txt' -Encoding ascii } catch { ('FAIL:' + $$_.Exception.Message) | Out-File '$TEMP\nexora-uz.txt' -Encoding ascii }"`
  Pop $0
  Pop $1
  FileOpen $2 "$TEMP\nexora-uz.txt" r
  IfErrors uz_fail
  FileRead $2 $3
  FileClose $2
  StrCmp $3 "OK$\r$\n" uz_ok
  StrCmp $3 "OK" uz_ok
  uz_fail:
  DetailPrint "Could not unpack the download. Free some disk space and try again."
  MessageBox MB_ICONSTOP "Could not unpack the download. Free some disk space and try again."
  Abort
  uz_ok:
  DetailPrint "Copying files into place..."
  nsExec::ExecToStack `powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Copy-Item -Recurse -Force '$TEMP\nxu\NEXORA Browser\*' '$INSTDIR'; 'OK' | Out-File '$TEMP\nexora-cp.txt' -Encoding ascii } catch { ('FAIL:' + $$_.Exception.Message) | Out-File '$TEMP\nexora-cp.txt' -Encoding ascii }"`
  Pop $0
  Pop $1
  FileOpen $2 "$TEMP\nexora-cp.txt" r
  IfErrors cp_fail
  FileRead $2 $3
  FileClose $2
  StrCmp $3 "OK$\r$\n" cp_ok
  StrCmp $3 "OK" cp_ok
  cp_fail:
  DetailPrint "Could not copy files. Free some disk space and try again."
  MessageBox MB_ICONSTOP "Could not copy files. Free some disk space and try again."
  Abort
  cp_ok:
  Delete "$TEMP\nexora-app.zip"
  RMDir /r "$TEMP\nxu"

  ; Shortcuts open the browser directly (first-run setup already ran via Finish).
  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\NEXORA Browser"
  CreateShortCut "$SMPROGRAMS\NEXORA Browser\NEXORA Browser.lnk" "$INSTDIR\${APP_EXE}" "--no-sandbox" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$DESKTOP\NEXORA Browser.lnk" "$INSTDIR\${APP_EXE}" "--no-sandbox" "$INSTDIR\${APP_EXE}" 0

  WriteUninstaller "$INSTDIR\Uninstall NEXORA.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "DisplayName" "NEXORA Browser"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "DisplayVersion" "1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "Publisher" "NEXORA"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "URLInfoAbout" "https://github.com/khanhishan70-stack/NEXORA-Browser"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "UninstallString" "$INSTDIR\Uninstall NEXORA.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser" "InstallLocation" "$INSTDIR"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\NEXORA Browser\NEXORA Browser.lnk"
  Delete "$DESKTOP\NEXORA Browser.lnk"
  RMDir "$SMPROGRAMS\NEXORA Browser"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NEXORA Browser"
  ; Your profile (history, logins, settings) is intentionally KEPT.
  ; /REBOOTOK: binaries still held by a just-closed browser are removed on reboot.
  RMDir /r /REBOOTOK "$INSTDIR"
SectionEnd
