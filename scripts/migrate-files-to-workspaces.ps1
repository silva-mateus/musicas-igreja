# Migrate existing organized files into workspace-scoped subdirectories.
# Before: organized/{category}/{file}.pdf
# After:  organized/igreja/{category}/{file}.pdf
#
# Run from the backend directory (where the "organized" folder lives)
# or pass the organized folder path as -OrganizedDir.

param(
    [string]$OrganizedDir = "organized"
)

$ErrorActionPreference = "Stop"

$DefaultWorkspaceSlug = "igreja"
$TargetDir = Join-Path $OrganizedDir $DefaultWorkspaceSlug

if (-not (Test-Path $OrganizedDir -PathType Container)) {
    Write-Error "Directory '$OrganizedDir' not found. Run from the backend directory or pass the path."
    exit 1
}

if ((Test-Path $TargetDir -PathType Container) -and (Get-ChildItem $TargetDir -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Write-Warning "'$TargetDir' already exists and is not empty. Files may have already been migrated. Aborting."
    exit 0
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$Moved = 0

# Move subdirectories (category folders)
Get-ChildItem -Path $OrganizedDir -Directory | Where-Object { $_.Name -ne $DefaultWorkspaceSlug } | ForEach-Object {
    $dest = Join-Path $TargetDir $_.Name
    Write-Host "Moving: $($_.FullName) -> $dest"
    Move-Item -Path $_.FullName -Destination $dest
    $script:Moved++
}

# Move any loose files at the root of organized/
Get-ChildItem -Path $OrganizedDir -File | ForEach-Object {
    Write-Host "Moving file: $($_.FullName) -> $TargetDir"
    Move-Item -Path $_.FullName -Destination $TargetDir
    $script:Moved++
}

Write-Host ""
Write-Host "Migration complete."
Write-Host "  Moved: $Moved items"
Write-Host "  Target: $TargetDir"
