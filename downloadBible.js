const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/maatheusgois/bible/main/versions/ko/ko.json', (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
        let ko = JSON.parse(raw);
        let bibleDataIds = ["gen","exo","lev","num","deu","jos","jdg","rut","1sa","2sa","1ki","2ki","1ch","2ch","ezr","neh","est","job","psa","pro","ecc","sng","isa","jer","lam","ezk","dan","hos","jol","amo","oba","jon","mic","nah","hab","zep","hag","zec","mal",
        "mat","mrk","luk","jhn","act","rom","1co","2co","gal","eph","php","col","1th","2th","1ti","2ti","tit","phm","heb","jas","1pe","2pe","1jn","2jn","3jn","jud","rev"];
        
        let output = {};
        for(let i=0; i<66; i++) {
            let bookId = bibleDataIds[i];
            output[bookId] = {};
            let chapters = ko[i].chapters;
            for(let c=0; c<chapters.length; c++) {
                output[bookId][c+1] = chapters[c];
            }
        }
        let jsSnippet = "window.bibleTextData = " + JSON.stringify(output) + ";";
        fs.writeFileSync('korean-bible-text.js', jsSnippet, 'utf8');
        console.log("Done extracting");
    });
});
