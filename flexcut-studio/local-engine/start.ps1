$ErrorActionPreference = 'Stop'
$engineScript = Join-Path $PSScriptRoot 'server.py'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js belum terpasang. Kloning suara tetap bisa dipakai. Fitur Motion memerlukan Node.js LTS dari https://nodejs.org.'
}
function Add-UvPath {
    foreach ($dir in @("$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\uv", "$env:USERPROFILE\.cargo\bin")) {
        if ((Test-Path $dir) -and ($env:Path -notlike "*$dir*")) { $env:Path = "$dir;$env:Path" }
    }
}
Add-UvPath
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host 'Memasang uv (sekali saja, dari installer resmi Astral)...'
    try {
        powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
        Add-UvPath
    } catch {
        Write-Host 'Pemasangan otomatis uv gagal. Mencoba lewat Python...'
    }
}
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run --no-project --python 3.12 $engineScript
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m pip install --user uv
    if ($LASTEXITCODE -ne 0) { throw 'uv belum dapat dipasang.' }
    & python -m uv run --no-project --python 3.12 $engineScript
} else {
    Write-Host 'uv belum dapat dipasang otomatis. Pasang uv dari https://docs.astral.sh/uv/ atau Python dari https://python.org, lalu buka kembali Mulai FlexCut.cmd.'
    Read-Host 'Tekan Enter untuk menutup'
    exit 1
}
