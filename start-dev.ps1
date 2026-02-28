param(
    [switch]$SkipDocker,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

& "$PSScriptRoot\core\scripts\start-dev.ps1" `
    -ProjectName         "MusicasIgreja" `
    -ProjectRoot         $PSScriptRoot `
    -BackendPath         "backend" `
    -BackendCsproj       "MusicasIgreja.Api.csproj" `
    -FrontendPath        "frontend" `
    -FrontendRunner      "next" `
    -ApiPortDefault      "5000" `
    -FePortDefault       "3000" `
    -SwaggerPath         "/swagger" `
    -HealthPath          "/api/health" `
    -DockerMode          "external" `
    -DockerContainerName "homelab-postgres" `
    -SkipDocker:$SkipDocker `
    -BackendOnly:$BackendOnly `
    -FrontendOnly:$FrontendOnly
