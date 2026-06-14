# Launch Spork in dev mode.
#
# On Windows, `cargo` often can't locate the MSVC linker / Windows SDK on its
# own, so this script pulls in the Visual Studio C++ developer environment
# first, then runs `npm run tauri dev`. Just run:  .\dev.ps1
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
  # Locate vcvars64.bat for whatever Visual Studio (2017+) is installed, via
  # vswhere — it ships at a fixed path with every VS installer and works across
  # years (2019/2022/...), editions (Community/Pro/Enterprise/BuildTools), and
  # install locations. Set $env:VCVARS64 to override with a specific one.
  $vcvars = $env:VCVARS64
  if (-not $vcvars) {
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
      $vcvars = & $vswhere -latest -prerelease -products * `
        -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
        -find VC\Auxiliary\Build\vcvars64.bat | Select-Object -First 1
    }
  }
  if (-not $vcvars -or -not (Test-Path $vcvars)) {
    throw "Could not find the Visual Studio C++ build tools (vcvars64.bat). Install the 'Desktop development with C++' workload, run from an 'x64 Native Tools Command Prompt for VS', or set the VCVARS64 environment variable to your vcvars64.bat."
  }
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
