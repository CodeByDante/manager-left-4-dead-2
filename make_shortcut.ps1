$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\Gonzalo\Downloads\mod\mod calculadora\L4D2 Mod Manager.lnk")
$Shortcut.TargetPath = "C:\Users\Gonzalo\Downloads\mod\mod calculadora\dist-app\L4D2 Mod Manager-win32-x64\L4D2 Mod Manager.exe"
$Shortcut.WorkingDirectory = "C:\Users\Gonzalo\Downloads\mod\mod calculadora\dist-app\L4D2 Mod Manager-win32-x64"
$Shortcut.Save()
