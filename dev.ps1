# Launch Spoon in dev mode.
#
# On this machine `cargo` can't find the MSVC linker / Windows SDK on its own,
# so this script pulls in the Visual Studio 2019 developer environment first,
# then runs `npm run tauri dev`. Just run:  .\dev.ps1
$ErrorActionPreference = "Stop"

$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvars)) { throw "vcvars64.bat not found at $vcvars" }

# Import the VS developer environment (link.exe + Windows SDK on PATH/LIB/INCLUDE).
cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
}

# Ensure cargo is on PATH (it lives in the user profile, not the global PATH).
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path

Set-Location $PSScriptRoot
npm run tauri dev
