# Usage: Run in PowerShell after installing gcloud and authenticating (gcloud init)
# This script sets CORS for the Firebase Storage bucket and then prints the result.
# Edit $Origins to include production domains when ready.

$Bucket = "fix-flow-45f6e.firebasestorage.app"
# Development + (add production later)
# Include both localhost variants so dev works regardless of port usage
$Origins = @("http://localhost","http://localhost:3000")
$Methods = @("GET","POST","PUT","DELETE","HEAD","OPTIONS")
$ResponseHeaders = @(
  "Content-Type",
  "Authorization",
  "x-goog-resumable",
  "x-goog-meta-*",
  "x-goog-upload-command",
  "x-goog-upload-header-content-length",
  "x-goog-upload-header-content-type",
  "x-goog-upload-protocol",
  "x-goog-upload-status",
  "x-goog-upload-url"
)
$MaxAgeSeconds = 3600

$CorsItem = [pscustomobject]@{
  origin = $Origins
  method = $Methods
  responseHeader = $ResponseHeaders
  maxAgeSeconds = $MaxAgeSeconds
}
$CorsObject = @($CorsItem)

$JsonPath = Join-Path $PSScriptRoot "cors.json"
# Write JSON as an explicit array and without BOM to avoid gsutil parsing issues
$CorsItemJson = $CorsItem | ConvertTo-Json -Depth 5
$CorsListJson = "[`n$CorsItemJson`n]"
Set-Content -Path $JsonPath -Value $CorsListJson -Encoding ASCII
Write-Host "Generated CORS file at $JsonPath" -ForegroundColor Cyan

# Verify bucket exists before attempting to set CORS
$bucketExists = $false
if (Get-Command gsutil -ErrorAction SilentlyContinue) {
  gsutil ls gs://$Bucket > $null 2> $null
  if ($LASTEXITCODE -eq 0) { $bucketExists = $true } else { $bucketExists = $false }
} elseif (Get-Command gcloud -ErrorAction SilentlyContinue) {
  try {
    $names = gcloud storage buckets list --format="value(name)"
    if ($names -contains "gs://$Bucket") { $bucketExists = $true } else { $bucketExists = $false }
  } catch {
    $bucketExists = $false
  }
}

if (-not $bucketExists) {
  Write-Host "Bucket gs://$Bucket not found. Ensure Firebase Storage is enabled for the project and verify the bucket name." -ForegroundColor Yellow
  Write-Host "If needed, create it: gcloud storage buckets create gs://$Bucket --location=us-central1" -ForegroundColor Yellow
  exit 1
}

# Apply using gsutil if available, otherwise try gcloud storage
if (Get-Command gsutil -ErrorAction SilentlyContinue) {
  Write-Host "Applying CORS via gsutil..." -ForegroundColor Yellow
  gsutil cors set $JsonPath gs://$Bucket
  Write-Host "Current CORS config (gsutil get):" -ForegroundColor Green
  gsutil cors get gs://$Bucket
} elseif (Get-Command gcloud -ErrorAction SilentlyContinue) {
  Write-Host "gsutil not found, using gcloud storage..." -ForegroundColor Yellow
  gcloud storage buckets update gs://$Bucket --cors-file=$JsonPath
  Write-Host "Current CORS config (gcloud describe):" -ForegroundColor Green
  gcloud storage buckets describe gs://$Bucket --format="json(cors_config)"
} else {
  Write-Host "Neither gsutil nor gcloud found in PATH. Install Google Cloud SDK first." -ForegroundColor Red
  exit 1
}

Write-Host "Done. Reload your app and test avatar upload." -ForegroundColor Cyan
