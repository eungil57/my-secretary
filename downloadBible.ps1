[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$json = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/maatheusgois/bible/main/versions/ko/ko.json").Content
$ko = ConvertFrom-Json $json -Depth 20
$bibleDataIds = @("gen","exo","lev","num","deu","jos","jdg","rut","1sa","2sa","1ki","2ki","1ch","2ch","ezr","neh","est","job","psa","pro","ecc","sng","isa","jer","lam","ezk","dan","hos","jol","amo","oba","jon","mic","nah","hab","zep","hag","zec","mal","mat","mrk","luk","jhn","act","rom","1co","2co","gal","eph","php","col","1th","2th","1ti","2ti","tit","phm","heb","jas","1pe","2pe","1jn","2jn","3jn","jud","rev")
$sb = [System.Text.StringBuilder]::new()
$null = $sb.Append("window.bibleTextData = {`n")
for ($i=0; $i -lt 66; $i++) {
    $bookId = $bibleDataIds[$i]
    $null = $sb.Append("`"$bookId`": {`n")
    $chapters = $ko[$i].chapters
    for ($c=0; $c -lt $chapters.Count; $c++) {
        $null = $sb.Append("  `"$($c+1)`": ")
        $versesJson = $chapters[$c] | ConvertTo-Json -Compress
        $null = $sb.Append($versesJson)
        if ($c -lt $chapters.Count - 1) { $null = $sb.Append(",`n") } else { $null = $sb.Append("`n") }
    }
    if ($i -lt 65) { $null = $sb.Append("},`n") } else { $null = $sb.Append("}`n") }
}
$null = $sb.Append("};")
[System.IO.File]::WriteAllText("C:\Users\¹Úº¸°æ\.gemini\antigravity\scratch\study-planner\korean-bible-text.js", $sb.ToString(), [System.Text.Encoding]::UTF8)
