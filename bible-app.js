class BibleTracker {
    constructor() {
        this.loadState();
    }
    loadState() {
        let sc = localStorage.getItem('bible_progress_state');
        if (sc) {
            this.state = JSON.parse(sc);
            if (!this.state.sermons) this.state.sermons = [];
            if (!this.state.chapterComments) this.state.chapterComments = {};
        }
        else this.state = { readChapters: {}, sermons: [], chapterComments: {} };
    }
    saveState() {
        localStorage.setItem('bible_progress_state', JSON.stringify(this.state));
        if (window.firebaseSync && window.firebaseSync.saveBible) window.firebaseSync.saveBible(this.state);
    }
    isRead(bookId, chap) {
        return !!this.state.readChapters[`${bookId}-${chap}`];
    }
    markReadRange(bookId, start, end) {
        const todayStr = new Date().toISOString().split('T')[0];
        for(let i=start; i<=end; i++) {
            if (!this.state.readChapters[`${bookId}-${i}`]) {
                this.state.readChapters[`${bookId}-${i}`] = todayStr;
            }
        }
        this.saveState();
    }
    markUnread(bookId, chap) {
        delete this.state.readChapters[`${bookId}-${chap}`];
        this.saveState();
    }
}
const bibleEngine = new BibleTracker();
window.bibleEngine = bibleEngine;
window.bibleWeekOffset = 0;
window.bibleMonthOffset = 0;

function getMonday(offsetWeeks = 0) {
    let d = new Date();
    d.setDate(d.getDate() - (offsetWeeks * 7));
    let day = d.getDay();
    let diff = d.getDate() - day + (day === 0 ? -6 : 1);
    let monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function getMonthStart(offsetMonths = 0) {
    let d = new Date();
    d.setMonth(d.getMonth() - offsetMonths, 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Initialize local Bible data mapping
window.bibleTextData = {};
if (window.rawBibleJson) {
   let bibleDataIds = ["gen","exo","lev","num","deu","jos","jdg","rut","1sa","2sa","1ki","2ki","1ch","2ch","ezr","neh","est","job","psa","pro","ecc","sng","isa","jer","lam","ezk","dan","hos","jol","amo","oba","jon","mic","nah","hab","zep","hag","zec","mal","mat","mrk","luk","jhn","act","rom","1co","2co","gal","eph","php","col","1th","2th","1ti","2ti","tit","phm","heb","jas","1pe","2pe","1jn","2jn","3jn","jud","rev"];
   for(let i=0; i<66; i++) {
        let bookId = bibleDataIds[i];
        window.bibleTextData[bookId] = {};
        let chapters = window.rawBibleJson[i]? window.rawBibleJson[i].chapters : [];
        for(let c=0; c<chapters.length; c++) {
            window.bibleTextData[bookId][c+1] = chapters[c];
        }
   }
}

window.initBibleDashboard = () => {
    let container = document.getElementById('bible-view-section');
    
    // Stats calculation
    let totalOT = 0, readOT = 0;
    let totalNT = 0, readNT = 0;
    let weeklyCount = 0;
    let monthlyCount = 0;
    
    let nowTimestamp = Date.now();
    let oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    let oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    
    let dailyHistory = {};
    let readDetailsList = [];
    
    window.bibleData.forEach(b => {
        let isOT = b.type === 'ot';
        if (isOT) totalOT += b.chapters; else totalNT += b.chapters;
        
        let bookReadCount = 0;
        for (let i=1; i<=b.chapters; i++) {
            let val = bibleEngine.state.readChapters[`${b.id}-${i}`];
            if (val) {
                if(isOT) readOT++; else readNT++;
                bookReadCount++;
                
                let readDateStr = typeof val === 'string' ? val.split('T')[0] : '';
                if (readDateStr) {
                    dailyHistory[readDateStr] = (dailyHistory[readDateStr] || 0) + 1;
                }
            }
        }
        if (bookReadCount > 0) {
            readDetailsList.push(`${b.name} ${bookReadCount}장`);
        }
    });
    
    let total = totalOT + totalNT;
    let readAll = readOT + readNT;
    let totalPct = total > 0 ? Math.round((readAll/total)*100) : 0;
    let otPct = totalOT > 0 ? Math.round((readOT/totalOT)*100) : 0;
    let ntPct = totalNT > 0 ? Math.round((readNT/totalNT)*100) : 0;

    let readDetailsText = readDetailsList.length > 0 ? readDetailsList.join(', ') : '아직 읽은 말씀이 없습니다.';
    
    // Weekly Stats Logic (Monday to Sunday)
    let mon = getMonday(window.bibleWeekOffset);
    let weekDays = [];
    let weekMax = 1;
    let periodWeeklyTotal = 0;
    for (let i = 0; i < 7; i++) {
        let d = new Date(mon);
        d.setDate(mon.getDate() + i);
        let dtStr = d.toISOString().split('T')[0];
        let cnt = dailyHistory[dtStr] || 0;
        if (cnt > weekMax) weekMax = cnt;
        periodWeeklyTotal += cnt;
        let dayNames = ['일','월','화','수','목','금','토'];
        weekDays.push({ label: `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`, count: cnt });
    }
    
    let weekBarsHtml = weekDays.map(item => {
        let hPct = (item.count / weekMax) * 100;
        if (hPct < 5 && item.count > 0) hPct = 5;
        let color = item.count > 0 ? '#60a5fa' : '#e2e8f0';
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100px; gap: 4px; flex: 1;">
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">${item.count > 0 ? item.count : ''}</span>
                <div style="width: 100%; max-width: 24px; background: ${color}; height: ${hPct}%; border-radius: 4px 4px 0 0; transition: height 0.5s;"></div>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${item.label}</span>
            </div>
        `;
    }).join('');

    // Monthly Stats Logic (1st to Last Day)
    let monthStart = getMonthStart(window.bibleMonthOffset);
    let monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    let monthDaysCount = monthEnd.getDate();
    let monthDays = [];
    let monthMax = 1;
    let periodMonthlyTotal = 0;
    for (let i = 0; i < monthDaysCount; i++) {
        let d = new Date(monthStart);
        d.setDate(monthStart.getDate() + i);
        let dtStr = d.toISOString().split('T')[0];
        let cnt = dailyHistory[dtStr] || 0;
        if (cnt > monthMax) monthMax = cnt;
        periodMonthlyTotal += cnt;
        monthDays.push({ date: d, count: cnt });
    }
    
    let svgWidth = 600;
    let svgHeight = 90;
    
    let points = monthDays.map((md, i) => {
        let x = (i / (monthDaysCount - 1)) * svgWidth;
        let y = svgHeight - ((md.count / monthMax) * (svgHeight - 10)); 
        return `${x},${y}`;
    });
    
    let areaPoints = `0,${svgHeight} ` + points.join(' ') + ` ${svgWidth},${svgHeight}`;

    let xLabelsHtml = '';
    monthDays.forEach((md, i) => {
        if (i === 0 || i === monthDaysCount - 1 || i % 7 === 0) {
            let x = (i / (monthDaysCount - 1)) * svgWidth;
            let label = `${md.date.getMonth()+1}/${md.date.getDate()}`;
            let anchor = i === monthDaysCount-1 ? 'end' : (i === 0 ? 'start' : 'middle');
            let weight = i === monthDaysCount-1 || i === 0 ? 'bold' : 'normal';
            let clr = '#94a3b8';
            xLabelsHtml += `<text x="${x}" y="${svgHeight + 20}" font-size="12" fill="${clr}" font-weight="${weight}" text-anchor="${anchor}">${label}</text>`;
        }
    });

    let monthBarsHtml = `
        <svg viewBox="-10 -10 ${svgWidth+20} ${svgHeight+35}" style="width: 100%; height: 100%; overflow: visible text-rendering: optimizeLegibility;">
            <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="rgba(16, 185, 129, 0.4)" />
                    <stop offset="100%" stop-color="rgba(16, 185, 129, 0.0)" />
                </linearGradient>
            </defs>
            <polyline fill="url(#areaGradient)" stroke="none" points="${areaPoints}" />
            <polyline fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" />
            ${xLabelsHtml}
        </svg>
    `;

    let html = `
        <div class="top-header">
            <div>
                <h1>성경 통독표</h1>
                <p class="subtitle" style="margin-bottom: 0.5rem;">전체 ${total}장 중 ${readAll}장 완료 (${totalPct}%)</p>
                <div style="font-size: 0.9rem; color: var(--text-muted); background: var(--glass-bg); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); max-height: 80px; overflow-y: auto;">
                    <strong>📖 상세 진도:</strong> ${readDetailsText}
                </div>
            </div>
        </div>

        <!-- Weekly & Monthly Stats -->
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <div class="glass-panel" style="flex: 1; padding: 1.5rem; border-radius: 16px; border-left: 6px solid #3b82f6; display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-main);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: var(--text-muted); font-size: 0.95rem;">🔥 ${window.bibleWeekOffset === 0 ? '이번 주' : '지난주 기록'} : 총 ${periodWeeklyTotal}장</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.changeBibleWeekOffset(1)">◀</button>
                        <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.changeBibleWeekOffset(-1)" ${window.bibleWeekOffset <= 0 ? 'disabled' : ''}>▶</button>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 120px; padding-top: 10px; border-bottom: 1px solid #e2e8f0;">
                    ${weekBarsHtml}
                </div>
            </div>
            <div class="glass-panel" style="flex: 1; padding: 1.5rem; border-radius: 16px; border-left: 6px solid #10b981; display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-main);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: var(--text-muted); font-size: 0.95rem;">📈 ${monthStart.getFullYear()}년 ${monthStart.getMonth()+1}월 : 총 ${periodMonthlyTotal}장</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.changeBibleMonthOffset(1)">◀</button>
                        <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.changeBibleMonthOffset(-1)" ${window.bibleMonthOffset <= 0 ? 'disabled' : ''}>▶</button>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 120px; padding-top: 10px; border-bottom: 1px solid #e2e8f0; width: 100%;">
                    ${monthBarsHtml}
                </div>
            </div>
        </div>

        <!-- Graph -->
        <div class="glass-panel" style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 16px;">
            <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-main); margin-bottom: 1.5rem; text-align: center;">통독 전체 진행률 (Overall: <span style="color:var(--color-primary); font-weight:800">${totalPct}%</span>)</div>
            
            <div style="display: flex; justify-content: center; gap: 4rem; flex-wrap: wrap;">
                
                <!-- 구약 (OT) Circle -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 140px;">
                    <svg viewBox="0 0 36 36" class="circular-chart" style="width: 100%; border-radius: 50%; background: white; box-shadow: inset 0 0 10px rgba(0,0,0,0.05);">
                        <path class="circle-bg" fill="none" stroke="#f1f5f9" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="circle" fill="none" stroke="#93c5fd" stroke-width="4" stroke-linecap="round" stroke-dasharray="${otPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.5" class="percentage" style="fill: #3b82f6; font-size: 0.55rem; font-weight: 800; text-anchor: middle;">${otPct}%</text>
                    </svg>
                    <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 700;">구약 (${readOT}/${totalOT}장)</span>
                </div>

                <!-- 신약 (NT) Circle -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 140px;">
                    <svg viewBox="0 0 36 36" class="circular-chart" style="width: 100%; border-radius: 50%; background: white; box-shadow: inset 0 0 10px rgba(0,0,0,0.05);">
                        <path class="circle-bg" fill="none" stroke="#f1f5f9" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="circle" fill="none" stroke="#f9a8d4" stroke-width="4" stroke-linecap="round" stroke-dasharray="${ntPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.5" class="percentage" style="fill: #ec4899; font-size: 0.55rem; font-weight: 800; text-anchor: middle;">${ntPct}%</text>
                    </svg>
                    <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 700;">신약 (${readNT}/${totalNT}장)</span>
                </div>

            </div>
        </div>

        <!-- Sermon Notes -->
        <div class="glass-panel" style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 16px; background: var(--glass-bg);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--text-main);">📝 주일 설교 / 묵상 노트</h3>
                <button class="btn btn-primary" onclick="window.toggleSermonForm()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">+ 새 노트 작성</button>
            </div>
            
            <div id="inline-sermon-form" style="display: none; flex-direction: column; gap: 0.8rem; margin-bottom: 1.5rem; padding: 1.2rem; background: var(--bg-variant); border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <input type="hidden" id="sermon-edit-idx" value="">
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <input type="date" id="sermon-date" class="form-input" onclick="if(this.showPicker) this.showPicker();" style="flex: 1; min-width: 120px; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: inherit; cursor: pointer;">
                    <input type="text" id="sermon-range" class="form-input" placeholder="성경 본문 (예: 요한복음 3:16)" style="flex: 2; min-width: 200px; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: inherit;">
                </div>
                <textarea id="sermon-comment" class="form-input" placeholder="말씀 내용 및 깨달음, 묵상 노트..." style="padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: inherit; resize: none; min-height: 80px;"></textarea>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="window.toggleSermonForm(false)">취소</button>
                    <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="window.saveSermon()">저장하기</button>
                </div>
            </div>

            <div id="sermon-list" style="display: flex; flex-direction: column; gap: 0.8rem; max-height: 350px; overflow-y: auto;">
                ${renderSermonList()}
            </div>
        </div>

        <div style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 16px; background: var(--glass-bg); border: 1px solid var(--glass-border);" class="glass-panel">
            <h3 style="margin-bottom: 1rem; color: var(--text-main);">새 진도 입력 (범위 읽기)</h3>
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <select id="bible-book-select" style="padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); font-family: inherit;">
                    <optgroup label="구약 (Old Testament)">
                        ${window.bibleData.filter(b=>b.type==='ot').map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                    </optgroup>
                    <optgroup label="신약 (New Testament)">
                        ${window.bibleData.filter(b=>b.type==='nt').map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                    </optgroup>
                </select>
                <span style="color: var(--text-muted);">장부터</span>
                <input type="number" id="bible-start-chap" min="1" placeholder="시작장" style="width: 80px; padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); font-family: inherit;">
                <span style="color: var(--text-muted);">~</span>
                <input type="number" id="bible-end-chap" min="1" placeholder="끝장" style="width: 80px; padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); font-family: inherit;">
                <span style="color: var(--text-muted);">장까지</span>
                <button class="btn btn-primary" onclick="window.markBibleRange()">완료 처리</button>
                <button class="btn btn-secondary" onclick="window.resetBibleData()" style="margin-left: auto;">초기화</button>
            </div>
        </div>

        <h2 style="margin-bottom:1rem; color: #3b82f6;">📖 구약 성경</h2>
        ${renderBibleTable('ot')}

        <h2 style="margin-bottom:1rem; margin-top:2rem; color: #ec4899;">✝️ 신약 성경</h2>
        ${renderBibleTable('nt')}
    `;

    container.innerHTML = html;
};

function renderBibleTable(type) {
    let data = window.bibleData.filter(b => b.type === type);
    
    let html = `<div class="bible-table-container" style="padding: 2rem; border-radius: 16px; background: #faf8f5; border: 1px solid #f0e6d2; display: flex; flex-direction: column; gap: 1.5rem; overflow-x: auto; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">`;
    
    data.forEach(b => {
        let chaptersHtml = '';
        for (let i = 1; i <= b.chapters; i++) {
            let read = bibleEngine.isRead(b.id, i);
            let hasComment = !!bibleEngine.state.chapterComments[`${b.id}-${i}`];
            
            let chapText = i < 10 ? `0${i}` : `${i}`;
            
            let bg = read ? '#d9bfa4' : '#ffffff';
            let color = read ? '#ffffff' : '#9c8c7c';
            let border = read ? '1px solid #d9bfa4' : '1px solid #e8decb';
            let fw = read ? '800' : '600';
            let shadow = read ? '0 3px 6px rgba(217, 191, 164, 0.5)' : '0 1px 3px rgba(0,0,0,0.03)';
            
            let iconStr = hasComment ? `<div style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #facc15; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>` : '';
            chaptersHtml += `<div style="position: relative; width: 38px; height: 38px; min-width: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${bg}; color: ${color}; border: ${border}; font-weight: ${fw}; font-size: 0.85rem; cursor: pointer; box-shadow: ${shadow}; transition: all 0.2s; user-select: none;" 
            onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'"
            onclick="window.toggleBibleChapter('${b.id}', ${i})" oncontextmenu="window.openInlineChapterComment('${b.id}', ${i}, event); return false;" title="${i}장">${chapText}${iconStr}</div>`;
        }
        
        html += `
            <div style="display: flex; gap: 1rem; align-items: stretch; width: 100%;">
                <div style="flex-shrink: 0; width: 140px; max-width: 140px; background: #ebdcc9; border-radius: 12px; padding: 1.2rem 1rem; display: flex; align-items: flex-start; justify-content: flex-start; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#e3d2bd'" onmouseout="this.style.background='#ebdcc9'" onclick="window.promptBibleReader('${b.id}')">
                    <span style="font-weight: 800; font-size: 0.95rem; color: #5a4b41; text-transform: uppercase; letter-spacing: 0.5px;">${b.name}</span>
                </div>
                <div style="flex: 1; background: #ffffff; border-radius: 12px; padding: 1.2rem 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-content: flex-start; box-shadow: 0 4px 10px rgba(0,0,0,0.02); min-height: 70px;">
                    ${chaptersHtml}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

window.toggleBibleChapter = (bookId, chap) => {
    if (bibleEngine.isRead(bookId, chap)) {
        bibleEngine.markUnread(bookId, chap);
    } else {
        bibleEngine.markReadRange(bookId, chap, chap);
    }
    window.initBibleDashboard();
};

window.promptBibleReader = (bookId) => {
    let book = window.bibleData.find(b => b.id === bookId);
    let color = book.type === 'ot' ? '#A3B18A' : '#D4A373'; // Sage Green vs Terracotta
    let accent = book.type === 'ot' ? '#3A5A40' : '#A04000';
    let lightBg = book.type === 'ot' ? '#F6F7F4' : '#FDF7F2';
    
    let modal = document.getElementById('bible-chapter-selector-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bible-chapter-selector-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    let gridHtml = '';
    for (let i = 1; i <= book.chapters; i++) {
        let isRead = bibleEngine.isRead(bookId, i);
        let bg = isRead ? color : '#ffffff';
        let txtCol = isRead ? '#ffffff' : accent;
        let border = isRead ? `1px solid ${color}` : `1px solid ${color}55`;
        let shadow = isRead ? 'none' : '0 2px 5px rgba(0,0,0,0.05)';
        gridHtml += `<div style="padding: 1rem; background: ${bg}; text-align: center; border-radius: 12px; cursor: pointer; border: ${border}; font-weight: 800; font-size: 1.15rem; color: ${txtCol}; box-shadow: ${shadow}; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="window.selectBibleChapter('${bookId}', ${i})">${i}</div>`;
    }
    
    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 550px; max-height: 85vh; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border-top: 6px solid ${color};">
            <div style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed ${color}55; background: ${lightBg};">
                <h3 style="margin: 0; color: ${accent}; font-size: 1.4rem; display: flex; align-items: center; gap: 0.5rem;">📖 ${book.name} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">몇 장을 읽을까요?</span></h3>
                <button class="btn btn-secondary" style="border: none; background: transparent; font-size: 1.2rem; color: ${accent};" onclick="document.getElementById('bible-chapter-selector-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 1rem; background: var(--glass-bg);">
                ${gridHtml}
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.selectBibleChapter = (bookId, chap) => {
    document.getElementById('bible-chapter-selector-modal').style.display = 'none';
    window.openBibleReader(bookId, chap);
};

window.openInlineChapterComment = (bookId, chap, event) => {
    if (event) event.stopPropagation();
    let book = window.bibleData.find(b => b.id === bookId);
    let existingComment = bibleEngine.state.chapterComments[`${bookId}-${chap}`] || '';
    
    let modal = document.getElementById('inline-chapter-comment-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inline-chapter-comment-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 200000; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 400px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <div style="padding: 1rem 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: var(--color-primary); font-size: 1.1rem;">💬 ${book.name} ${chap}장 묵상 코멘트</h3>
                <button style="border: none; background: transparent; cursor: pointer; font-size: 1.2rem; color: var(--text-muted);" onclick="document.getElementById('inline-chapter-comment-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--bg-variant);">
                <textarea id="inline-chapter-textarea" style="width: 100%; height: 150px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 1rem; resize: none; font-family: inherit; font-size: 0.95rem; box-sizing: border-box;" placeholder="이 장에 대한 메모나 묵상 내용을 적어보세요...">${existingComment}</textarea>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;">
                    ${existingComment ? `<button class="btn btn-secondary" style="margin-right: auto; color: #ef4444; border-color: #fca5a5; background: #fef2f2;" onclick="window.deleteInlineChapterComment('${bookId}', ${chap})">삭제</button>` : ''}
                    <button class="btn btn-secondary" onclick="document.getElementById('inline-chapter-comment-modal').style.display='none'">닫기</button>
                    <button class="btn btn-primary" onclick="window.saveInlineChapterComment('${bookId}', ${chap})">저장하기</button>
                </div>
            </div>
        </div>
    `;
};

window.deleteInlineChapterComment = (bookId, chap) => {
    window.customConfirm('이 묵상 코멘트를 삭제하시겠습니까?', () => {
        delete bibleEngine.state.chapterComments[`${bookId}-${chap}`];
        bibleEngine.saveState();
        document.getElementById('inline-chapter-comment-modal').style.display = 'none';
        window.initBibleDashboard();
    });
};

window.saveInlineChapterComment = (bookId, chap) => {
    let txt = document.getElementById('inline-chapter-textarea').value.trim();
    if (txt) {
        bibleEngine.state.chapterComments[`${bookId}-${chap}`] = txt;
    } else {
        delete bibleEngine.state.chapterComments[`${bookId}-${chap}`];
    }
    bibleEngine.saveState();
    document.getElementById('inline-chapter-comment-modal').style.display = 'none';
    window.initBibleDashboard();
};

window.openBibleReader = (bookId, chap) => {
    let book = window.bibleData.find(b => b.id === bookId);
    let title = `${book.name} ${chap}장`;
    let existingComment = bibleEngine.state.chapterComments[`${bookId}-${chap}`] || '';
    
    let modal = document.getElementById('bible-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bible-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    modal.style.zIndex = '99999';
    
    modal.innerHTML = `
        <style>
          .bible-modal-layout { flex: 1; display: flex; min-height: 0; position: relative; flex-direction: column; }
          .bible-modal-content { flex: 1; padding: 1.5rem 2.5rem; overflow-y: auto; background: white; font-size: 1.15rem; line-height: 2.1; color: #1e293b; box-sizing: border-box; scroll-behavior: smooth; }
          .bible-modal-comment-overlay { display: none; position: absolute; bottom: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98); backdrop-filter: blur(15px); z-index: 100; flex-direction: column; padding: 2rem; box-sizing: border-box; animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          .bible-nav-footer { padding: 2rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: center; gap: 1.5rem; background: #fafafa; }
          .nav-btn-bottom { flex: 1; max-width: 200px; padding: 1rem; border-radius: 12px; font-weight: 700; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
          
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          
          @media (max-width: 600px) {
              .bible-modal-content { padding: 1.2rem; font-size: 1.05rem; line-height: 1.9; }
              .bible-modal-header { padding: 0.8rem 1rem !important; flex-wrap: wrap; gap: 0.5rem; }
              .bible-modal-title { font-size: 1.1rem !important; width: 100%; }
              .bible-header-btns { width: 100%; justify-content: space-between; display: flex; }
              .bible-header-btns .btn { flex: 1; padding: 0.5rem !important; font-size: 0.8rem !important; }
              .bible-nav-footer { padding: 1.5rem 1rem; gap: 0.8rem; }
              .nav-btn-bottom { font-size: 0.9rem; padding: 0.8rem; }
              #fab-comment { bottom: 15px !important; right: 15px !important; padding: 10px 18px !important; font-size: 0.9rem !important; }
          }
        </style>
        <div class="glass-panel modal-content" style="width: 100%; max-width: 850px; height: 95vh; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; background: white; position: relative; border: none; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div class="bible-modal-header" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; background: white; z-index: 10;">
                <h3 id="bible-modal-title" class="bible-modal-title" style="margin: 0; font-size: 1.4rem; display: flex; align-items: center; gap: 0.6rem; color: var(--color-primary); font-weight: 800;">📖 <span id="bible-modal-title-text">${title}</span></h3>
                <div class="bible-header-btns" style="display: flex; gap: 0.6rem; align-items: center;">
                    <button class="btn btn-secondary" onclick="window.navigateBible(-1)" style="padding: 0.6rem 1rem; border-radius: 10px;">◀ 이전</button>
                    <button class="btn btn-secondary" onclick="window.navigateBible(1)" style="padding: 0.6rem 1rem; border-radius: 10px;">다음 ▶</button>
                    <button class="btn btn-secondary" onclick="window.closeBibleModal()" style="border: 1px solid #e2e8f0; border-radius: 10px; background: #fff;">✕ 닫기</button>
                </div>
            </div>
            <div class="bible-modal-layout">
                <div id="bible-native-container" class="bible-modal-content">
                    <div style="text-align: center; color: var(--text-muted); margin-top: 2rem;">성경 본문을 불러오는 중... ⏳</div>
                </div>
                
                <button id="fab-comment" style="position: absolute; bottom: 20px; right: 20px; z-index: 50; background: var(--color-primary); color: white; border: none; border-radius: 50px; padding: 12px 24px; font-size: 1.05rem; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="document.getElementById('bible-comment-overlay').style.display='flex'; document.getElementById('fab-comment').style.display='none'; setTimeout(()=>document.getElementById('bible-comment-area').focus(), 100);">
                    💬 묵상 코멘트 쓰기
                </button>

                <div id="bible-comment-overlay" class="bible-modal-comment-overlay">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0; color: var(--color-primary); font-size: 1.2rem;">💬 묵상 / 코멘트 노트</h4>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <span style="font-size: 0.85rem; font-weight: 600; color: #10b981;">✓ 자동 저장됨</span>
                            <button class="btn btn-secondary" onclick="document.getElementById('bible-comment-overlay').style.display='none'; document.getElementById('fab-comment').style.display='inline-block';">요약창 닫기 ↓</button>
                        </div>
                    </div>
                    <textarea id="bible-comment-area" style="flex: 1; border-radius: 12px; border: 1px solid #cbd5e1; padding: 1.2rem; resize: none; font-family: inherit; font-size: 1.05rem; background: #ffffff; box-shadow: inset 0 2px 6px rgba(0,0,0,0.03); line-height: 1.6;" placeholder="이 장을 읽으면서 느낀 점, 은혜받은 구절, 생각 등을 자유롭게 다이어리처럼 적어보세요...">${existingComment}</textarea>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    // Inject LOCAL text immediately
    setTimeout(() => {
        let verses = window.bibleTextData ? window.bibleTextData[bookId][chap] : null;
        if (!verses) {
            document.getElementById('bible-native-container').innerHTML = `<div style="text-align: center; color: #ef4444; margin-top: 2rem;">성경 데이터를 불러오지 못했습니다.<br>잠시 후 다시 시도해주세요.</div>`;
            return;
        }
        
        let flatVerses = verses;
        if (verses.length > 0 && Array.isArray(verses[0])) flatVerses = verses[0];
        
        let cleanHtml = flatVerses.map((v, idx) => {
            if (typeof v === 'string') {
                return `<span style="color: #6366f1; font-weight: 800; font-size: 0.85rem; margin-right: 8px; user-select: none;">${idx+1}</span><span style="margin-right: 0.5rem;">${v}</span><br><br>`;
            }
            return '';
        }).join('');
        
        document.getElementById('bible-native-container').innerHTML = `
            <div style="max-width: 650px; margin: 0 auto; padding-bottom: 1rem;">
                <h2 style="color: var(--color-primary); border-bottom: 3px solid #f1f5f9; padding-bottom: 1.2rem; margin-bottom: 1.5rem; text-align: center; font-size: 1.8rem; letter-spacing: 2px;">${title}</h2>
                <div style="text-align: justify; word-break: keep-all;">
                    ${cleanHtml}
                </div>
            </div>
            <div class="bible-nav-footer">
                <button class="btn btn-secondary nav-btn-bottom" onclick="window.navigateBible(-1)">
                    <span>◀ 이전 장</span>
                </button>
                <button class="btn btn-primary nav-btn-bottom" onclick="window.navigateBible(1)" style="background: #6366f1;">
                    <span>다음 장으로 ▶</span>
                </button>
            </div>
        `;
        document.getElementById('bible-native-container').scrollTop = 0;
    }, 50);
    
    // Auto-save logic
    const textArea = document.getElementById('bible-comment-area');
    textArea.addEventListener('input', () => {
        let txt = textArea.value.trim();
        if (txt) {
            bibleEngine.state.chapterComments[`${bookId}-${chap}`] = txt;
        } else {
            delete bibleEngine.state.chapterComments[`${bookId}-${chap}`];
        }
        bibleEngine.saveState();
    });

    window.currentBibleReaderBook = bookId;
    window.currentBibleReaderChap = chap;
};

window.closeBibleModal = () => {
    let modal = document.getElementById('bible-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    window.initBibleDashboard(); // Refresh to update 💬 bubbles
};

window.navigateBible = (direction) => {
    let currentBookId = window.currentBibleReaderBook;
    let currentCol = window.currentBibleReaderChap;
    
    let bookIndex = window.bibleData.findIndex(b => b.id === currentBookId);
    let book = window.bibleData[bookIndex];
    
    let nextChap = currentCol + direction;
    let nextBookId = currentBookId;
    
    if (nextChap > book.chapters) {
        // Go to next book
        if (bookIndex < window.bibleData.length - 1) {
            nextBookId = window.bibleData[bookIndex + 1].id;
            nextChap = 1;
        } else {
            window.customAlert('성경의 마지막 장입니다.');
            return;
        }
    } else if (nextChap < 1) {
        // Go to previous book
        if (bookIndex > 0) {
            let prevBook = window.bibleData[bookIndex - 1];
            nextBookId = prevBook.id;
            nextChap = prevBook.chapters;
        } else {
            window.customAlert('성경의 첫 장입니다.');
            return;
        }
    }
    
    window.openBibleReader(nextBookId, nextChap);
};

window.markBibleRange = () => {
    let bId = document.getElementById('bible-book-select').value;
    let s = parseInt(document.getElementById('bible-start-chap').value);
    let e = parseInt(document.getElementById('bible-end-chap').value);
    
    let book = window.bibleData.find(b => b.id === bId);
    if (!book || isNaN(s) || isNaN(e) || s > e || s < 1 || e > book.chapters) {
        window.customAlert('올바른 범위(장 번호)를 입력해주세요.');
        return;
    }
    
    bibleEngine.markReadRange(bId, s, e);
    window.initBibleDashboard();
};

window.resetBibleData = () => {
    window.customConfirm('성경 통독 내역과 묵상 코멘트를 모두 초기화할까요?', () => {
        bibleEngine.state.readChapters = {};
        bibleEngine.state.chapterComments = {};
        bibleEngine.state.sermons = [];
        bibleEngine.saveState();
        window.initBibleDashboard();
    });
};

/* --- Sermon Notes Logic --- */

function renderSermonList() {
    let list = bibleEngine.state.sermons || [];
    if (list.length === 0) {
        return `<div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;">아직 추가된 주일 설교 / 말씀 노트가 없습니다. 새 노트를 작성해보세요!</div>`;
    }
    let html = '';
    for(let i = list.length - 1; i >= 0; i--) {
        let s = list[i];
        html += `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-weight: 800; color: var(--color-primary);">${s.date}</span>
                    <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${s.range}</span>
                </div>
                <div style="display: flex; gap: 0.8rem;">
                    <button style="background: none; border: none; font-size: 0.8rem; color: #3b82f6; cursor: pointer; text-decoration: underline; padding: 0;" onclick="window.editSermon(${i})">수정</button>
                    <button style="background: none; border: none; font-size: 0.8rem; color: #ef4444; cursor: pointer; text-decoration: underline; padding: 0;" onclick="window.deleteSermon(${i})">삭제</button>
                </div>
            </div>
            <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap;">${s.comment}</p>
        </div>`;
    }
    return html;
}

window.toggleSermonForm = (show = true) => {
    let form = document.getElementById('inline-sermon-form');
    if (!form) return;
    
    if (show) {
        form.style.display = 'flex';
        // Clear inputs if adding fresh (no editIdx)
        if (!document.getElementById('sermon-edit-idx').value) {
            document.getElementById('sermon-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('sermon-range').value = '';
            document.getElementById('sermon-comment').value = '';
        }
        document.getElementById('sermon-comment').focus();
    } else {
        form.style.display = 'none';
        document.getElementById('sermon-edit-idx').value = '';
    }
};

window.editSermon = (idx) => {
    let s = bibleEngine.state.sermons[idx];
    if (!s) return;
    document.getElementById('sermon-edit-idx').value = idx;
    document.getElementById('sermon-date').value = s.date;
    document.getElementById('sermon-range').value = s.range;
    document.getElementById('sermon-comment').value = s.comment;
    window.toggleSermonForm(true);
};

window.saveSermon = () => {
    let date = document.getElementById('sermon-date').value;
    let range = document.getElementById('sermon-range').value.trim();
    let comment = document.getElementById('sermon-comment').value.trim();
    let editIdx = document.getElementById('sermon-edit-idx').value;
    
    if (!date || !range || !comment) {
        window.customAlert('모든 항목을 입력해주세요.');
        return;
    }
    
    if (!bibleEngine.state.sermons) bibleEngine.state.sermons = [];
    
    if (editIdx !== '') {
        bibleEngine.state.sermons[parseInt(editIdx)] = { date, range, comment };
    } else {
        bibleEngine.state.sermons.push({ date, range, comment });
    }
    bibleEngine.saveState();
    
    window.initBibleDashboard();
};

window.deleteSermon = (idx) => {
    window.customConfirm('이 설교 노트를 삭제하시겠습니까?', () => {
        bibleEngine.state.sermons.splice(idx, 1);
        bibleEngine.saveState();
        window.initBibleDashboard();
    });
};

window.changeBibleWeekOffset = (delta) => {
    window.bibleWeekOffset = Math.max(0, window.bibleWeekOffset + delta);
    window.initBibleDashboard();
};

window.changeBibleMonthOffset = (delta) => {
    window.bibleMonthOffset = Math.max(0, window.bibleMonthOffset + delta);
    window.initBibleDashboard();
};
