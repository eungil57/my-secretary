$url = "https://raw.githubusercontent.com/maatheusgois/bible/main/versions/ko/ko.json"
$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8
$jsonText = $wc.DownloadString($url)
$output = "window.rawBibleJson = " + $jsonText + ";"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$PSScriptRoot\korean-bible-text.js", $output, $utf8NoBom)
Write-Host "Re-generated korean-bible-text.js successfully!"
