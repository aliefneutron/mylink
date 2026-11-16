$ErrorActionPreference = 'Stop'
$engineScript = Join-Path $PSScriptRoot 'server.py'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Pasang Node.js LTS dari https://nodejs.org lalu buka kembali Mulai FlexCut.cmd.'
    Read-Host 'Tekan Enter untuk menutup'
    exit 1
}
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run --no-project --python 3.12 $engineScript
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m pip install --user uv
    if ($LASTEXITCODE -ne 0) { throw 'uv belum dapat dipasang.' }
    & python -m uv run --no-project --python 3.12 $engineScript
} else {
    Write-Host 'Pasang Python dari https://python.org atau uv dari https://docs.astral.sh/uv/.'
    Read-Host 'Tekan Enter untuk menutup'
    exit 1
}
