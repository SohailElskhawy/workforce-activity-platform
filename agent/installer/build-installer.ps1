[CmdletBinding()]
param(
    [string]$InnoSetupCompiler = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = 'Stop'
$agentRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $agentRoot 'dist/WorkLensAgent'
$installerScript = Join-Path $agentRoot 'installer/WorkLensAgent.iss'
$outputDir = Join-Path $agentRoot 'installer/output'

if (-not (Test-Path (Join-Path $sourceDir 'WorkLensAgent.exe'))) {
    throw 'Build WorkLensAgent.exe first.'
}
if (-not (Test-Path $InnoSetupCompiler)) {
    throw "Inno Setup compiler not found: $InnoSetupCompiler"
}

New-Item -ItemType Directory -Force $outputDir | Out-Null
& $InnoSetupCompiler "/DSourceDir=$sourceDir" "/O$outputDir" $installerScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
