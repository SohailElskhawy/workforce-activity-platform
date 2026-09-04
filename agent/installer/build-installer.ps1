[CmdletBinding()]
param(
    [string]$InnoSetupCompiler = ""
)

$ErrorActionPreference = 'Stop'
$agentRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $agentRoot 'dist/WorkLensAgent'
$installerScript = Join-Path $agentRoot 'installer/WorkLensAgent.iss'
$outputDir = Join-Path $agentRoot 'installer/output'

if (-not (Test-Path (Join-Path $sourceDir 'WorkLensAgent.exe'))) {
    throw 'Build WorkLensAgent.exe first using scripts/build-windows.ps1.'
}

# Auto-detect ISCC.exe if not explicitly specified
if (-not $InnoSetupCompiler) {
    $candidatePaths = @(
        (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($cand in $candidatePaths) {
        if ($cand -and (Test-Path $cand)) {
            $InnoSetupCompiler = $cand
            break
        }
    }
}

if (-not $InnoSetupCompiler -or -not (Test-Path $InnoSetupCompiler)) {
    throw "Inno Setup compiler (ISCC.exe) not found. Please install Inno Setup 6 (e.g. 'winget install JRSoftware.InnoSetup' or download from https://jrsoftware.org/isdl.php), or pass -InnoSetupCompiler 'path\to\ISCC.exe'."
}

New-Item -ItemType Directory -Force $outputDir | Out-Null
& $InnoSetupCompiler "/DSourceDir=$sourceDir" "/O$outputDir" $installerScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
