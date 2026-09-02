[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$DefaultApiUrl
)

$ErrorActionPreference = 'Stop'
$agentRoot = Split-Path -Parent $PSScriptRoot
$defaultsPath = Join-Path $agentRoot 'build/runtime-defaults.json'

New-Item -ItemType Directory -Force (Split-Path -Parent $defaultsPath) | Out-Null
@{ apiUrl = $DefaultApiUrl.TrimEnd('/') } |
    ConvertTo-Json |
    Set-Content -Path $defaultsPath -Encoding utf8

Push-Location $agentRoot
try {
    python -m pip install -e ".[windows]"
    python -m pip install -r requirements-build.txt
    python -c "import win32gui; import win32process; print('pywin32 build dependency verified')"
    python -m PyInstaller --noconfirm --clean --windowed --onedir --name WorkLensAgent --paths . --hidden-import win32gui --hidden-import win32process --hidden-import pythoncom --hidden-import pywintypes --add-data "$defaultsPath;worklens_agent" worklens_agent/main.py
} finally {
    Pop-Location
}
