<#
.SYNOPSIS
  Build the Oasyn backend image, push it to Amazon ECR, and (optionally) roll
  the ECS Express Mode service onto it.

.DESCRIPTION
  Requires: AWS CLI v2 (configured: `aws configure`), Docker Desktop running.
  Run from anywhere; paths are resolved relative to this script.

.EXAMPLE
  # First deploy: just build + push, then create the service (see DEPLOY_AWS.md).
  ./deploy/aws/push-backend.ps1 -Region us-east-1

.EXAMPLE
  # Later deploys: build + push + roll the running service onto the new image.
  ./deploy/aws/push-backend.ps1 -Region us-east-1 -ServiceArn arn:aws:ecs:us-east-1:123456789012:service/default/oasyn-backend
#>
param(
  [string]$Region = "us-east-1",
  [string]$Repository = "oasyn-backend",
  [string]$ServiceArn = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Native {
  param([scriptblock]$Command, [string]$What)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendDir = Join-Path $repoRoot "backend"
$containerJson = Join-Path $PSScriptRoot "container.json"

Write-Host "==> Checking tools"
Invoke-Native { aws --version } "aws --version"
Invoke-Native { docker info --format "{{.ServerVersion}}" } "docker info (is Docker Desktop running?)"

$account = (aws sts get-caller-identity --query Account --output text --region $Region)
if ($LASTEXITCODE -ne 0 -or -not $account) { throw "Could not read AWS account id. Run 'aws configure' first." }
$registry = "$account.dkr.ecr.$Region.amazonaws.com"

# Tag with the git commit so every deploy is traceable and immutable.
$sha = (git -C $repoRoot rev-parse --short HEAD).Trim()
$dirty = (git -C $repoRoot status --porcelain)
if ($dirty) { $sha = "$sha-dirty-$(Get-Date -Format yyyyMMddHHmmss)" }
$image = "$registry/${Repository}:$sha"

Write-Host "==> Ensuring ECR repository '$Repository' exists in $Region"
# Windows PowerShell turns redirected native stderr into terminating errors
# under "Stop", so relax it for this expected-to-fail probe.
$ErrorActionPreference = "Continue"
aws ecr describe-repositories --repository-names $Repository --region $Region *> $null
$repoMissing = $LASTEXITCODE -ne 0
$ErrorActionPreference = "Stop"
if ($repoMissing) {
  Invoke-Native {
    aws ecr create-repository --repository-name $Repository --region $Region `
      --image-scanning-configuration scanOnPush=true --output text --query repository.repositoryUri
  } "ecr create-repository"
}

Write-Host "==> Logging Docker in to $registry"
$password = aws ecr get-login-password --region $Region
if ($LASTEXITCODE -ne 0) { throw "ecr get-login-password failed" }
$password | docker login --username AWS --password-stdin $registry
if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

Write-Host "==> Building $image (linux/amd64)"
Invoke-Native { docker build --platform linux/amd64 -t $image $backendDir } "docker build"

Write-Host "==> Pushing $image"
Invoke-Native { docker push $image } "docker push"

Write-Host ""
Write-Host "IMAGE_URI=$image" -ForegroundColor Green

if ($ServiceArn) {
  if (-not (Test-Path $containerJson)) {
    throw "Missing $containerJson. Create it from container.template.json (see DEPLOY_AWS.md step 5)."
  }
  Write-Host "==> Rolling ECS Express service onto the new image"
  $cfg = Get-Content $containerJson -Raw | ConvertFrom-Json
  $cfg.image = $image
  # Write UTF-8 WITHOUT a BOM; the AWS CLI rejects JSON files that start with one.
  [System.IO.File]::WriteAllText($containerJson, ($cfg | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
  Invoke-Native {
    aws ecs update-express-gateway-service --region $Region `
      --service-arn $ServiceArn `
      --primary-container "file://$containerJson" `
      --monitor-resources
  } "ecs update-express-gateway-service"
}
