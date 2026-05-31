# show-config.ps1
# Displays current bot configuration from .env (tokens masked)
# Run from anywhere: .\scripts\show-config.ps1

$EnvFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot (Join-Path ".." ".env")))

if (-not (Test-Path $EnvFile)) {
  Write-Error ".env file not found at: $EnvFile"
  exit 1
}

function Get-EnvValue([string]$content, [string]$key) {
  $match = [regex]::Match($content, "(?m)^$key=(.*)$")
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return "(not set)"
}

function Mask([string]$value) {
  if ($value -eq "(not set)" -or $value.Length -le 4) { return "****" }
  return ("*" * ($value.Length - 4)) + $value.Substring($value.Length - 4)
}

$content = Get-Content $EnvFile -Raw

Write-Host ""
Write-Host "=== Rustbot Configuration ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Discord" -ForegroundColor Yellow
Write-Host "  Bot Token:   $(Mask (Get-EnvValue $content 'DISCORD_BOT_TOKEN'))"
Write-Host "  Client ID:   $(Get-EnvValue $content 'DISCORD_CLIENT_ID')"
Write-Host "  Guild ID:    $(Get-EnvValue $content 'DISCORD_GUILD_ID')"
Write-Host ""
Write-Host "Rust Server" -ForegroundColor Yellow
Write-Host "  IP:          $(Get-EnvValue $content 'RUST_SERVER_IP')"
Write-Host "  App Port:    $(Get-EnvValue $content 'RUST_SERVER_PORT')"
Write-Host "  Player ID:   $(Get-EnvValue $content 'RUST_PLAYER_ID')"
Write-Host "  Token:       $(Mask (Get-EnvValue $content 'RUST_PLAYER_TOKEN'))"
Write-Host ""
Write-Host "Options" -ForegroundColor Yellow
Write-Host "  Command Prefix:  $(Get-EnvValue $content 'RUST_CHAT_COMMAND_PREFIX')"
Write-Host "  Poll Interval:   $(Get-EnvValue $content 'RUST_MAP_MARKERS_POLL_SECONDS')s"
Write-Host "  Allowed IDs:     $(Get-EnvValue $content 'RUST_CHAT_ALLOWED_STEAM_IDS')"
Write-Host "  Log Level:       $(Get-EnvValue $content 'LOG_LEVEL')"
Write-Host ""
