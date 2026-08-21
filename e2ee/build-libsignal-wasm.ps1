[CmdletBinding()]
param(
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$crate = Join-Path $PSScriptRoot 'wasm'
$output = Join-Path $root 'web\src\lib\signal-wasm'

$wasmPack = Get-Command wasm-pack -ErrorAction SilentlyContinue
if (-not $wasmPack) {
  throw 'wasm-pack is required. Install it with: cargo install wasm-pack'
}

$protoc = $env:PROTOC
if (-not $protoc -or -not (Test-Path -LiteralPath $protoc)) {
  $protocCommand = Get-Command protoc -ErrorAction SilentlyContinue
  if ($protocCommand) {
    $protoc = $protocCommand.Source
  }
}
if (-not $protoc -or -not (Test-Path -LiteralPath $protoc)) {
  throw 'protoc is required by libsignal. Install Google Protobuf (winget install Google.Protobuf), then rerun this script, or set $env:PROTOC to protoc.exe.'
}

$env:PROTOC = $protoc

# Rust 1.96 on Windows may use the gnullvm host toolchain. That target needs
# a clang-shaped GNU linker even though the actual product target is WASM.
# Prefer the native linker when it is available; otherwise create a short
# ignored shim under target/ so a clean shell can still reproduce the build
# after LLVM/MinGW are installed.
$hostLine = (& rustc -vV | Select-String '^host:').ToString()
if ($hostLine -match 'x86_64-pc-windows-gnullvm') {
  $nativeLinker = Get-Command x86_64-w64-mingw32-clang -ErrorAction SilentlyContinue
  if (-not $nativeLinker) {
    $clangCommand = Get-Command clang -ErrorAction SilentlyContinue
    if (-not $clangCommand -and (Test-Path 'C:\Program Files\LLVM\bin\clang.exe')) {
      $clangCommand = Get-Item 'C:\Program Files\LLVM\bin\clang.exe'
    }
    if ($clangCommand) {
      $mingwGcc = Get-Command x86_64-w64-mingw32-gcc -ErrorAction SilentlyContinue
      $mingwBin = if ($mingwGcc) { Split-Path $mingwGcc.Source } else { $null }
      if ($mingwBin) { $env:PATH = "$mingwBin;$($clangCommand.Directory.FullName);$env:PATH" }
      $sysroot = (& rustc --print sysroot).Trim()
      $selfContained = Join-Path $sysroot 'lib\rustlib\x86_64-pc-windows-gnullvm\lib\self-contained'
      $shim = Join-Path $crate 'target\tb-gnullvm-clang.cmd'
      $clangPath = if ($clangCommand.Source) { $clangCommand.Source } else { $clangCommand.FullName }
      $shimBody = "@echo off`r`n`"$clangPath`" --target=x86_64-w64-windows-gnu -L `"$selfContained`" %*`r`nexit /b %ERRORLEVEL%`r`n"
      Set-Content -LiteralPath $shim -Value $shimBody -Encoding ascii
      $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER = $shim
    }
  }
}

Push-Location $crate
try {
  if ($Release) {
    & $wasmPack.Source build --target web --release --out-dir $output
  } else {
    & $wasmPack.Source build --target web --dev --out-dir $output
  }
  if ($LASTEXITCODE -ne 0) {
    throw "wasm-pack failed with exit code $LASTEXITCODE"
  }

  # wasm-pack writes a catch-all .gitignore into its output directory. Keep
  # the release package reproducible and reviewable while still excluding any
  # future auxiliary files it may generate.
  $generatedIgnore = @'
*
!.gitignore
!package.json
!thuebot_libsignal_wasm.js
!thuebot_libsignal_wasm.d.ts
!thuebot_libsignal_wasm_bg.wasm
!thuebot_libsignal_wasm_bg.wasm.d.ts
'@
  Set-Content -LiteralPath (Join-Path $output '.gitignore') -Value $generatedIgnore -Encoding utf8
} finally {
  Pop-Location
}
