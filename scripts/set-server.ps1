# set-server.ps1
# Updates Rust server credentials in .env
# Run from the repo root: .\scripts\set-server.ps1

param(
  [string]$Ip,
  [string]$Port,
  [string]$PlayerId,
  [string]$PlayerToken,
  [string]$MapSize
)

$EnvFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot (Join-Path ".." ".env")))

if (-not (Test-Path $EnvFile)) {
  Write-Error ".env file not found at: $EnvFile"
  exit 1
}

Write-Host ""
Write-Host "=== Rust Server Config Updater ===" -ForegroundColor Cyan
Write-Host "Editing: $EnvFile"
Write-Host ""

function Get-EnvValue([string]$content, [string]$key) {
  $match = [regex]::Match($content, "(?m)^$key=(.*)$")
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return ""
}

$content = Get-Content $EnvFile -Raw

$currentIp      = Get-EnvValue $content "RUST_SERVER_IP"
$currentPort    = Get-EnvValue $content "RUST_SERVER_PORT"
$currentId      = Get-EnvValue $content "RUST_PLAYER_ID"
$currentToken   = Get-EnvValue $content "RUST_PLAYER_TOKEN"
$currentMapSize = Get-EnvValue $content "RUST_MAP_SIZE"

$maskedToken = if ($currentToken.Length -gt 4) { ("*" * ($currentToken.Length - 4)) + $currentToken.Substring($currentToken.Length - 4) } else { "****" }
$mapSizeDisplay = if ($currentMapSize) { $currentMapSize } else { "(auto from server)" }

Write-Host "Current server:" -ForegroundColor Yellow
Write-Host "  IP:           $currentIp"
Write-Host "  Port:         $currentPort"
Write-Host "  Player ID:    $currentId"
Write-Host "  Player Token: $maskedToken"
Write-Host "  Map Size:     $mapSizeDisplay"
Write-Host ""

function Prompt-Value([string]$label, [string]$current, [string]$provided) {
  if ($provided) { return $provided }
  $input = Read-Host "$label (current: $current, press Enter to keep)"
  if ([string]::IsNullOrWhiteSpace($input)) { return $current }
  return $input.Trim()
}

function Prompt-Optional([string]$label, [string]$current, [string]$provided, [string]$hint) {
  if ($provided) { return $provided }
  Write-Host "  $hint" -ForegroundColor DarkGray
  $input = Read-Host "$label (current: $current, press Enter to keep, type 'auto' to remove)"
  if ([string]::IsNullOrWhiteSpace($input)) { return $current }
  if ($input.Trim() -eq 'auto') { return "" }
  return $input.Trim()
}

$newIp      = Prompt-Value    "Server IP"    $currentIp      $Ip
$newPort    = Prompt-Value    "App Port"     $currentPort    $Port
$newId      = Prompt-Value    "Player ID"    $currentId      $PlayerId
$newToken   = Prompt-Value    "Player Token" $currentToken   $PlayerToken
$newMapSize = Prompt-Optional "Map Size"     $mapSizeDisplay $MapSize "Leave blank/auto to let the bot fetch it from the server on startup"

# Validate required numeric fields
if ($newPort -notmatch '^\d+$') {
  Write-Error "Port must be a number. Got: $newPort"
  exit 1
}
if ($newToken -notmatch '^\-?\d+$') {
  Write-Error "Player Token must be a number. Got: $newToken"
  exit 1
}
if ($newMapSize -and $newMapSize -ne "(auto from server)" -and $newMapSize -notmatch '^\d+$') {
  Write-Error "Map Size must be a number (e.g. 3500, 4000, 4500). Got: $newMapSize"
  exit 1
}

Write-Host ""
Write-Host "New values to apply:" -ForegroundColor Green
Write-Host "  RUST_SERVER_IP=$newIp"
Write-Host "  RUST_SERVER_PORT=$newPort"
Write-Host "  RUST_PLAYER_ID=$newId"
$newMasked = if ($newToken.Length -gt 4) { ("*" * ($newToken.Length - 4)) + $newToken.Substring($newToken.Length - 4) } else { "****" }
Write-Host "  RUST_PLAYER_TOKEN=$newMasked"
$mapSizeOut = if ($newMapSize -and $newMapSize -ne "(auto from server)") { $newMapSize } else { "(auto from server)" }
Write-Host "  RUST_MAP_SIZE=$mapSizeOut"
Write-Host ""

$confirm = Read-Host "Apply these changes? (y/N)"
if ($confirm -notmatch '^[Yy]$') {
  Write-Host "Aborted. No changes made." -ForegroundColor Yellow
  exit 0
}

function Set-EnvValue([string]$content, [string]$key, [string]$value) {
  if ($value) {
    if ($content -match "(?m)^$key=") {
      return [regex]::Replace($content, "(?m)^$key=.*$", "$key=$value")
    } else {
      return $content.TrimEnd() + "`n$key=$value`n"
    }
  } else {
    # Remove the key entirely if value is empty (auto mode)
    return [regex]::Replace($content, "(?m)^$key=.*\r?\n?", "")
  }
}

$content = Set-EnvValue $content "RUST_SERVER_IP"    $newIp
$content = Set-EnvValue $content "RUST_SERVER_PORT"  $newPort
$content = Set-EnvValue $content "RUST_PLAYER_ID"    $newId
$content = Set-EnvValue $content "RUST_PLAYER_TOKEN" $newToken

$mapSizeToSave = if ($newMapSize -and $newMapSize -ne "(auto from server)") { $newMapSize } else { "" }
$content = Set-EnvValue $content "RUST_MAP_SIZE" $mapSizeToSave

[System.IO.File]::WriteAllText($EnvFile, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Done! .env updated successfully." -ForegroundColor Green
if (-not $mapSizeToSave) {
  Write-Host "Map size will be auto-fetched from the server on next bot startup." -ForegroundColor DarkCyan
}
Write-Host "Restart the bot for changes to take effect." -ForegroundColor Cyan
Write-Host ""
