$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectName = Split-Path $projectRoot -Leaf
if ($projectName -ne '驿程-vh-0.7') { throw 'Please package the intended vh-0.7 project only.' }
$parentDirectory = Split-Path $projectRoot -Parent
$archivePath = Join-Path $parentDirectory ($projectName + '.zip')
$stagePath = Join-Path $parentDirectory ($projectName + '-' + [guid]::NewGuid().ToString('N') + '.zip.next')
$skipDirectories = @('node_modules','.git','.codex','.agents','data','backups','uploads','.cache','test-results','playwright-report')
$pendingDirectories = [Collections.Generic.Stack[string]]::new()
$pendingDirectories.Push($projectRoot)
$stream = [IO.File]::Open($stagePath,[IO.FileMode]::CreateNew)
$zip = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
$count = 0
try {
  while ($pendingDirectories.Count) {
    $directory = $pendingDirectories.Pop()
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      if ($item.PSIsContainer) {
        if ($skipDirectories -notcontains $item.Name) { $pendingDirectories.Push($item.FullName) }
        continue
      }
      if (($item.Name.StartsWith('.env') -and $item.Name -ne '.env.example') -or $item.Name -match '[.](sqlite|db)(-|$)|[.](log|pem|key|zip|bak)$') { continue }
      $relative = $item.FullName.Substring($projectRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar,'/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$item.FullName,($projectName+'/'+$relative),[IO.Compression.CompressionLevel]::Optimal) | Out-Null
      $count++
    }
  }
} finally { $zip.Dispose(); $stream.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($stagePath)
try {
  foreach ($name in @('server/app.mjs','server/business.mjs','server/migrations/001_backend.sql','server/migrations/002_public_tasks.sql','server/backup.mjs','src/map/MapProviderBadge.jsx','src/pages/PlayTrip.jsx','docs/后端搭建说明.md','dist/index.html')) {
    $entry = $check.GetEntry($projectName+'/'+$name)
    if (!$entry) { throw ('Missing ZIP file: '+$name) }
    $entryStream=$entry.Open(); $sourceStream=[IO.File]::OpenRead((Join-Path $projectRoot $name))
    $sha=[Security.Cryptography.SHA256]::Create()
    try {
      $packed=[Convert]::ToBase64String($sha.ComputeHash($entryStream))
      $current=[Convert]::ToBase64String($sha.ComputeHash($sourceStream))
      if ($packed -ne $current) { throw ('ZIP content mismatch: '+$name) }
    } finally { $sha.Dispose(); $entryStream.Dispose(); $sourceStream.Dispose() }
  }
  foreach ($entry in $check.Entries) {
    if ($entry.FullName -match '/(data|node_modules|uploads)/|/[.]env$|[.]sqlite') { throw ('Private/runtime file in ZIP: '+$entry.FullName) }
  }
} finally { $check.Dispose() }
if (Test-Path -LiteralPath $archivePath) {
  $backupDirectory = Join-Path $projectRoot 'data/backups'
  New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
  $previousArchive = Join-Path $backupDirectory ('previous-package-'+[guid]::NewGuid().ToString('N')+'.zip')
  [IO.File]::Replace($stagePath,$archivePath,$previousArchive)
  Write-Output ('Previous package preserved: '+$previousArchive)
} else { Move-Item -LiteralPath $stagePath -Destination $archivePath }
Write-Output ('Package verified: '+$archivePath+' ('+$count+' files)')
