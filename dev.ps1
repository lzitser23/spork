# Launch Spork in dev mode.
#
# On this machine `cargo` can't find the MSVC linker / Windows SDK on its own,
# so this script pulls in the Visual Studio 2019 developer environment first,
# then runs `npm run tauri dev`. Just run:  .\dev.ps1
#
# Safe to run repeatedly in the same shell: the VS env is sourced only once and
# cargo is added to PATH only once. (Re-sourcing vcvars every run would keep
# growing PATH until it overflows Windows' length limit, at which point
# node_modules\.bin drops off and `npm run tauri dev` fails with
# "'tauri' is not recognized" even though the CLI is installed.)
$ErrorActionPreference = "Stop"

# 1. Import the VS developer environment (link.exe + Windows SDK on PATH/LIB/INCLUDE),
#    but only if it isn't already present in this session. vcvars sets VSCMD_VER,
#    so its presence means the environment is already loaded.
if (-not $env:VSCMD_VER) {
  $vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
  if (-not (Test-Path $vcvars)) { throw "vcvars64.bat not found at $vcvars" }
  cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
  }
} else {
  Write-Host "VS environment already loaded (VSCMD_VER=$env:VSCMD_VER) - skipping vcvars."
}

# 2. Ensure cargo is on PATH (it lives in the user profile, not the global PATH),
#    without adding a duplicate entry on repeat runs.
$cargoBin = "$env:USERPROFILE\.cargo\bin"
if (($env:Path -split ';') -notcontains $cargoBin) {
  $env:Path = "$cargoBin;" + $env:Path
}

Set-Location $PSScriptRoot
npm run tauri dev
