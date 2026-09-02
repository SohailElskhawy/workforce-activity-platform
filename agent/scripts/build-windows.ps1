[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$DefaultApiUrl
)

$ErrorActionPreference = 'Stop'
$agentRoot = Split-Path -Parent $PSScriptRoot
$defaultsPath = Join-Path $agentRoot 'build/runtime-defaults.json'

function Invoke-CheckedPython {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code $LASTEXITCODE: python $($Arguments -join ' ')"
    }
}

New-Item -ItemType Directory -Force (Split-Path -Parent $defaultsPath) | Out-Null
@{ apiUrl = $DefaultApiUrl.TrimEnd('/') } |
    ConvertTo-Json |
    Set-Content -Path $defaultsPath -Encoding utf8

Push-Location $agentRoot
try {
    Invoke-CheckedPython -m pip install -e ".[windows]"
    Invoke-CheckedPython -m pip install -r requirements-build.txt
    Invoke-CheckedPython -c "import win32gui; import win32process; print('pywin32 build dependency verified')"
    Invoke-CheckedPython -m PyInstaller --noconfirm --clean --windowed --onedir --name WorkLensAgent --paths . --hidden-import win32gui --hidden-import win32process --hidden-import pythoncom --hidden-import pywintypes --add-data "$defaultsPath;worklens_agent" worklens_agent/main.py
} finally {
    Pop-Location
}
