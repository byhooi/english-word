param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "audio")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

$wordsFile = Join-Path $PSScriptRoot "words.js"
$source = Get-Content -LiteralPath $wordsFile -Raw -Encoding UTF8
$jsonBody = $source -replace '^\s*window\.WORD_UNITS\s*=\s*', ''
$jsonBody = $jsonBody -replace '\.map\(unit\s*=>[\s\S]*$', ''
$jsonBody = $jsonBody.Trim().TrimEnd(';')

# Use Node to evaluate words.js and return stable JSON.
$nodeScript = @"
global.window = {};
require(process.argv[1]);
process.stdout.write(JSON.stringify(window.WORD_UNITS));
"@
$unitsJson = & node -e $nodeScript $wordsFile
$units = $unitsJson | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Zira Desktop")
$synth.Rate = -1
$synth.Volume = 100

$manifest = @()
try {
  foreach ($unit in $units) {
    $safeName = if ($unit.id -eq "proper") { "proper-nouns" } else { $unit.id }
    $outputPath = Join-Path $OutputDirectory ($safeName + ".wav")
    $builder = New-Object System.Speech.Synthesis.PromptBuilder
    $builder.StartVoice("Microsoft Zira Desktop")

    foreach ($word in $unit.words) {
      $builder.AppendText($word.en)
      $builder.AppendBreak([System.Speech.Synthesis.PromptBreak]::Small)
      $builder.AppendText($word.en)
      $builder.AppendBreak([System.Speech.Synthesis.PromptBreak]::Large)
    }

    $builder.EndVoice()
    $synth.SetOutputToWaveFile($outputPath)
    $synth.Speak($builder)
    $synth.SetOutputToNull()

    $file = Get-Item -LiteralPath $outputPath
    $manifest += [pscustomobject]@{
      id = $unit.id
      label = $unit.label
      theme = $unit.theme
      words = $unit.words.Count
      file = $file.Name
      bytes = $file.Length
    }
    Write-Output ("Generated {0}: {1} words -> {2}" -f $unit.label, $unit.words.Count, $outputPath)
  }
}
finally {
  $synth.Dispose()
}

$manifestPath = Join-Path $OutputDirectory "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output ("Manifest -> " + $manifestPath)
