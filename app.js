// Diagnostic Alert - Step 1: engine.js and data.js must have loaded
console.log("app.js starting...");

const engine = new window.StudyEngine();
window.engine = engine;

window.currentScheduleView = 'daily';
window.currentViewDate = new Date(); // To track navigation in History view

document.addEventListener('DOMContentLoaded', () => {
    try {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateSubtitle = document.getElementById('date-subtitle');
        if (dateSubtitle) dateSubtitle.innerText = today.toLocaleDateString('ko-KR', options);

        initDashboard();

        setTimeout(() => {
            let script = document.createElement('script');
            script.src = 'korean-bible-text.js';
            script.onload = () => {
                if (window.rawBibleJson && !(window.bibleTextData && window.bibleTextData.gen)) {
                    window.bibleTextData = {};
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
            };
            document.body.appendChild(script);
        }, 200);
    } catch (e) {
        console.error("DOM Initialization Critical Error:", e);
        alert("앱 초기화 중 오류 발생: " + e.message);
    }
});

window.switchTab = (tabId) => {
    document.getElementById('planner-view-section').style.display = tabId === 'planner' ? 'block' : 'none';
    document.getElementById('bible-view-section').style.display = tabId === 'bible' ? 'block' : 'none';
    
    let engSec = document.getElementById('english-view-section');
    if (engSec) engSec.style.display = tabId === 'english' ? 'block' : 'none';
    
    let sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (tabId === 'bible') {
            sidebar.style.background = '#faf8f5';
        } else {
            sidebar.style.background = ''; // Default resets to CSS
        }
    }
    
    document.getElementById('nav-planner').classList.toggle('active', tabId === 'planner');
    document.getElementById('nav-bible').classList.toggle('active', tabId === 'bible');
    let navEng = document.getElementById('nav-english');
    if (navEng) navEng.classList.toggle('active', tabId === 'english');
    
    if (tabId === 'bible' && window.initBibleDashboard) {
        window.initBibleDashboard();
    }
    if (tabId === 'english' && window.initEnglishDashboard) {
        window.initEnglishDashboard();
    }
};

window.switchScheduleView = (view) => {
    window.currentScheduleView = view;
    if (view === 'history' || view === 'monthly') {
        window.currentViewDate = new Date(); // Reset to today/current month when entering
    }
    document.getElementById('btn-daily').classList.toggle('active-view', view === 'daily');
    document.getElementById('btn-weekly').classList.toggle('active-view', view === 'weekly');
    document.getElementById('btn-monthly').classList.toggle('active-view', view === 'monthly');
    let btnH = document.getElementById('btn-history');
    if (btnH) btnH.classList.toggle('active-view', view === 'history');
    initDashboard();
};

function initDashboard() {
    try {
        const hrsDisplay = document.getElementById('current-hours-display');
        let dEngine = window.engine;
        if (!dEngine) return;
        
        let dashTodayStr = dEngine.getTodayStr();
        let settings = dEngine.state.settings || { dailyHours: 5.5 };
        let displayHrs = settings.dailyHours;
        if (settings.dailyOverrides && settings.dailyOverrides[dashTodayStr]) {
            displayHrs = settings.dailyOverrides[dashTodayStr];
        }
        if (hrsDisplay) hrsDisplay.innerText = `${displayHrs}시간`;
    
        // 전체 및 과목별 진도율 계산
        let totalChapters = 0;
        let completedChapters = 0;
        let subjectProgressHtml = '';
    
        if (window.subjectData) {
            Object.keys(window.subjectData).forEach(subjKey => {
                let subj = window.subjectData[subjKey];
                if (!subj || !Array.isArray(subj.chapters)) return;
                
                let subjTotal = subj.chapters.length;
                let subjCompleted = 0;
                
                subj.chapters.forEach(ch => {
                    if (dEngine.isCompleted(ch.id)) subjCompleted++;
                });
                
                totalChapters += subjTotal;
                completedChapters += subjCompleted;
                
                let subjPct = (subjTotal > 0) ? Math.round((subjCompleted / subjTotal) * 100) : 0;
                let color = getPastelColor(subjKey);
                let shortName = subj.name.length > 5 ? subj.name.substring(0,4) : subj.name;
                
                subjectProgressHtml += `
                    <div class="subject-progress">
                        <span style="width: 50px; color: var(--text-muted);">${shortName}</span>
                        <div class="subject-progress-bar">
                            <div class="subject-progress-fill" style="width: ${subjPct}%; background: ${color}"></div>
                        </div>
                        <span style="width: 35px; text-align: right; color: ${color}; font-weight: 700;">${subjPct}%</span>
                    </div>
                `;
            });
        }
    
        let progressPct = (totalChapters > 0) ? Math.round((completedChapters / totalChapters) * 100) : 0;
        
        let progressFill = document.getElementById('progress-fill');
        let progressText = document.getElementById('progress-text');
        if (progressFill && progressText) {
            progressFill.style.width = progressPct + '%';
            progressText.innerText = progressPct + '% (' + completedChapters + '/' + totalChapters + '장)';
        }
    
        let subjContainer = document.getElementById('subject-progress-container');
        if (subjContainer) subjContainer.innerHTML = subjectProgressHtml;
    
        const container = document.getElementById('view-container');
        const todayStr = dEngine.getTodayStr();
        let daysToRender = 1;
    
        let html = '';
        let currentDate = new Date(todayStr);
        let viewType = window.currentScheduleView || 'daily';
    
        if (viewType === 'weekly') {
            daysToRender = 7;
            let day = (isNaN(currentDate.getDay())) ? 0 : currentDate.getDay();
            let diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); 
            currentDate.setDate(diff);
        } else if (viewType === 'monthly' || viewType === 'history') {
            let vDate = window.currentViewDate || new Date();
            currentDate = new Date(vDate.getFullYear(), vDate.getMonth(), 1);
            let nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            nextMonth.setDate(nextMonth.getDate() - 1);
            daysToRender = nextMonth.getDate();
        }

    if (viewType === 'daily') {
        let pacingWarningHtml = '';
        let cardsHtml = '';
        let skipBtnText = '';
        let displayDate = '';
        let todayStrLocal = engine.getTodayStr();
        
        let allTodayTasks = engine.getScheduleForDate(todayStr) || [];
        let activeTasks = [];
        let missedTasks = [];

        function getPastDateStr(daysAgo) {
            let d = new Date(todayStrLocal);
            d.setDate(d.getDate() - daysAgo);
            let y = d.getFullYear();
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        }

        let overrides = engine.state.settings.taskDateOverrides || {};

        for (let t of allTodayTasks) {
            // If the task has a manual override in the past, DO NOT show it as an active task today.
            if (overrides[t.chapter.id] && overrides[t.chapter.id] < todayStrLocal) {
                continue;
            }
            if (t.isReview && t.reviewDay !== '지정') {
                let p = engine.state.progress[t.chapter.id];
                if (p && p.status === 'completed' && p.completedAt) {
                    let compTime = new Date(p.completedAt + 'T00:00:00').getTime();
                    let currentDayTs = new Date(todayStrLocal + 'T00:00:00').getTime();
                    let actualDiffDays = Math.round((currentDayTs - compTime) / (1000 * 3600 * 24));
                    if (actualDiffDays > t.reviewDay) {
                        missedTasks.push({ ...t, pastDateStr: getPastDateStr(actualDiffDays - t.reviewDay) });
                        continue;
                    }
                }
            }
            activeTasks.push(t);
        }

        for (let id in overrides) {
            let oDate = overrides[id];
            if (oDate < todayStrLocal) {
                let subjInfo = findSubjectOfChapter(id);
                if (!subjInfo) continue;
                if (!missedTasks.find(m => m.chapter && String(m.chapter.id) === String(id))) {
                    if (engine.isCompleted(id)) {
                        let p = engine.state.progress[id];
                        let fbMult = (p && p.feedback === 'hard' ? 1.5 : (p && p.feedback === 'easy' ? 0.7 : 1));
                        missedTasks.push({
                            subjectId: subjInfo.subjKey, chapter: subjInfo.chapter, allocated: 0.5 * fbMult, isReview: true, reviewDay: '지정', pastDateStr: oDate
                        });
                    } else {
                        missedTasks.push({
                            subjectId: subjInfo.subjKey, chapter: subjInfo.chapter, allocated: 2.0, isReview: false, pastDateStr: oDate
                        });
                    }
                }
            }
        }
        
        if (activeTasks.length === 0 && missedTasks.length === 0) {
            html += `
                <div class="glass-panel" style="padding: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <h2>🎉 오늘의 일정(또는 주말)이 없습니다!</h2>
                    <p style="color: var(--text-muted); margin-top: 1rem;">주말이거나 모든 일정을 마치셨습니다.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem;">
                        <button class="btn btn-primary" onclick="window.changeDailyTime()">➕ 휴일에 공부 일정 추가하기</button>
                    </div>
                </div>
            `;
        } else {
            cardsHtml = activeTasks.map(t => {
                let color = getPastelColor(t.subjectId);
                let subj = window.subjectData[t.subjectId];
                if (!subj || !t.chapter) return '';
                let prefix = t.isReview ? '[복습] ' : '';
                let chId = t.chapter.id ? t.chapter.id.toString() : 'unknown';
                return `
                    <div style="padding: 1rem 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--glass-border); position: relative; background: transparent; margin-bottom: 0;">
                        <div style="position: absolute; left: 0; width: 4px; height: 60%; background: ${color}; border-radius: 2px;"></div>
                        <div style="display: flex; flex-direction: column; gap: 0.3rem; padding-left: 1rem;">
                            <span style="color: ${color}; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.5px;">${subj.name}</span>
                            ${(() => {
                                let bkmk = (engine.state.bookmarks && engine.state.bookmarks[t.chapter.id]) ? `<span style="font-size: 0.85rem; color: #d97706; background: #fffbeb; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a; margin-left: 0.5rem;">📍 ${engine.state.bookmarks[t.chapter.id]}</span>` : '';
                                let titleStr = t.chapter.title || '제목 없음';
                                let isCustom = chId.startsWith('custom_');
                                let titleHtml = isCustom ? 
                                    `<span style="cursor:pointer; border-bottom:1px dashed var(--text-muted);" onclick="window.editCustomTaskTitle('${chId}')" title="클릭하여 스케줄 제목 수정">✏️ ${titleStr}</span>` : 
                                    titleStr;
                                return `<span style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center;">${prefix}${titleHtml} ${bkmk}</span>`;
                            })()}
                        </div>
                        <div style="display: flex; flex-direction: row; align-items: center; gap: 1rem;">
                            <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600; font-family: monospace;">${t.allocated.toFixed(1)}H</span>
                            <div style="display: flex; gap: 0.4rem; align-items: center;">
                                <button style="background: white; border: 2px solid ${color}; color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-weight: 800; font-size: 1.1rem;" onmouseover="this.style.background='${color}11'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='white'; this.style.transform='scale(1)'" onclick="window.appComplete('${chId}', ${t.allocated}, ${t.isReview ? 'true' : 'false'})" title="완료">
                                    ✓
                                </button>
                                <button style="background: white; border: 2px dashed var(--text-muted); color: var(--text-muted); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-weight: 800; font-size: 1rem;" onmouseover="this.style.background='#f8fafc'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='white'; this.style.transform='scale(1)'" onclick="window.appPartial('${chId}', ${t.allocated})" title="진행중">
                                    △
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            let todayStrLocal = engine.getTodayStr();
            let isOptedInDay = engine.state.settings.extraStudyDays && engine.state.settings.extraStudyDays.includes(todayStrLocal);
            skipBtnText = isOptedInDay ? '☕ 오늘 수동 추가했던 일정 취소 (휴무로 복귀)' : '⏭️ 오늘 전체 건너뛰기';

            displayDate = new Date(todayStrLocal).toLocaleDateString('ko-KR', {weekday:'long', month:'long', day:'numeric'});
            
            // AI Pacing Diagnostic Warning Logic for 5-Rotations/Year (Advanced Adaptive)
            pacingWarningHtml = '';
            let totalContentHours = 0;
            const H_DIFF = { 1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5 };
            
            // Calculate total workload for 5 rotations
            for (let k in window.subjectData) {
                window.subjectData[k].chapters.forEach(c => {
                    let h = c.weight !== undefined ? (c.weight * 1.5) : (H_DIFF[c.difficulty] || 2.0);
                    if (k === 'tax') h *= 2.0; 
                    totalContentHours += h;
                });
                if (k === 'tax') {
                    window.subjectData[k].chapters.forEach(c => {
                        totalContentHours += 1.5; // Obj questions
                    });
                }
            }
            // Calculate total workload for 3 rotations (1 progress + 2 reviews = approx 1.8x)
            let rotationTarget = 3;
            let reviewMultiplier = 1.8;
            let targetTotalWork = totalContentHours * reviewMultiplier; 
            
            // Calculate work done so far based on status and percentages
            let workDoneHours = 0;
            for (let k in engine.state.progress) {
                let p = engine.state.progress[k];
                let subInfo = findSubjectOfChapter(k);
                if (subInfo && subInfo.chapter) {
                    let h = subInfo.chapter.weight !== undefined ? (subInfo.chapter.weight * 1.5) : (H_DIFF[subInfo.chapter.difficulty] || 2.0);
                    if (subInfo.subjKey === 'tax') h *= 2.0;
                    if (p.status === 'completed') workDoneHours += (h * reviewMultiplier);
                    else if (p.status === 'partial') workDoneHours += (h * reviewMultiplier * (p.ratio || 0));
                }
            }
            
            let workRemaining = Math.max(0, targetTotalWork - workDoneHours);
            let today = new Date();
            let endOfYear = new Date(today.getFullYear(), 11, 31);
            let diffMs = endOfYear - today;
            let daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            
            // Use current daily setting to see if we're on track
            let currentDaily = engine.state.settings.dailyHours;
            const isFullWeek = engine.state.settings.extraStudyDays && engine.state.settings.extraStudyDays.length > 50; 
            let weeklyHoursPlanned = currentDaily * (isFullWeek ? 7 : 5.5);
            let weeklyPaceNeeded = (workRemaining / daysLeft) * 7;
            
            if (weeklyPaceNeeded > weeklyHoursPlanned + 3 && !engine.state.settings.silencePacingWarning) {
                let neededWeeklyBoost = (weeklyPaceNeeded - weeklyHoursPlanned).toFixed(1);
                
                let subjectProgressPct = {};
                for (let s in window.subjectData) {
                    let subj = window.subjectData[s];
                    let total = subj.chapters.length;
                    let comp = subj.chapters.filter(c => engine.isCompleted(c.id)).length;
                    if (s === 'tax') {
                        total *= 2; 
                        comp += subj.chapters.filter(c => engine.isCompleted(c.id + '_obj')).length;
                    }
                    subjectProgressPct[s] = total > 0 ? (comp / total) : 0;
                }
                
                let minSubj = null;
                let minPct = 1.1;
                for (let s in subjectProgressPct) {
                    if (subjectProgressPct[s] < minPct) {
                        minPct = subjectProgressPct[s];
                        minSubj = s;
                    }
                }
                
                let targetChaptersText = '';
                if (minSubj) {
                    let pendingForSubj = [];
                    for (let c of window.subjectData[minSubj].chapters) {
                        if (!engine.isCompleted(c.id)) pendingForSubj.push(c);
                        if (minSubj === 'tax') {
                            let objId = c.id + '_obj';
                            if (!engine.isCompleted(objId)) {
                                pendingForSubj.push({
                                    id: objId, 
                                    title: `[객관식] ${c.title.replace(/\[법인세\]|\[소득세\]|\[부가세\]|\[상증세\]|\[국기법\]/g, '').trim()} 문제풀이`
                                });
                            }
                        }
                    }
                    if (pendingForSubj.length > 0) {
                        let first = pendingForSubj[0];
                        let last = pendingForSubj[Math.min(pendingForSubj.length - 1, 2)];
                        targetChaptersText = `이번 주엔 가장 뒤처진 <b>[${window.subjectData[minSubj].name}]</b> 과목을 집중 공략하여 <br>👉 <b>'${first.title}'</b> 부터 <b>'${last.title}'</b> 까지 돌파하는 것을 목표로 추가 시간을 배분해보세요!`;
                    }
                }

                let recommendedFull = (targetTotalWork / 330).toFixed(1);
                
                pacingWarningHtml = `
                    <div style="margin-bottom: 2rem; padding: 1.5rem; border: 2px dashed var(--color-forest); border-radius: 12px; background: rgba(255,255,255,0.5);">
                        <div style="display: flex; gap: 0.8rem; align-items: flex-start;">
                            <div style="font-size: 1.8rem;">🌿</div>
                            <div style="display: flex; flex-direction: column; gap: 0.8rem; flex: 1;">
                                <h3 style="color: var(--color-forest); margin: 0; font-size: 1.15rem; font-weight: 800;">[AI 스케줄 긴급 진단] 페이스 상향 권고</h3>
                                <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem; line-height: 1.5;">
                                    현재 일일 <b>${currentDaily}시간</b> 페이스로는 1년 내 합격 최소선인 <b>'전 과목 3회독'</b>(총 ${Math.round(targetTotalWork)}시간 소요 예정) 달성이 시기적으로 어렵습니다.
                                </p>
                                <div style="padding: 0.8rem 1rem; background: white; border-radius: 8px; border: 1px solid var(--glass-border); margin-top: 0.2rem;">
                                    <p style="color: var(--color-forest); margin: 0; font-size: 0.95rem; line-height: 1.6; font-weight: 700;">💡 AI 맞춤형 행동 지침:</p>
                                    <ul style="color: var(--text-main); margin: 0.5rem 0 0 0; padding-left: 1.2rem; font-size: 0.9rem; line-height: 1.5;">
                                        <li>3회독 목표 지표를 지키려면 <b>주당 평균 ${Math.round(weeklyPaceNeeded)}시간</b> 수준의 거시적 학습이 필수적입니다. 매주 최소 <b>${neededWeeklyBoost}시간</b>을 더 확보하십시오.</li>
                                        <li>${targetChaptersText}</li>
                                    </ul>
                                </div>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                                    <button class="btn btn-primary" style="padding: 0.6rem 1rem; flex: 1; border-radius:8px;" onclick="window.openPacingFlexModal()">🗓️ 유연하게 추가 배분하기</button>
                                    <button class="btn btn-secondary" style="border: none; background: transparent; color: var(--text-muted); text-decoration: underline;" onclick="window.ignoreAIPacing()">보류 (현재 유지)</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            let missedHtml = '';
            if (missedTasks.length > 0) {
                let mCards = missedTasks.map(t => {
                    let color = getPastelColor(t.subjectId);
                    let subj = window.subjectData[t.subjectId];
                    if (!subj || !t.chapter) return '';
                    let prefix = t.isReview ? '[복습] ' : '';
                    let chId = t.chapter.id ? t.chapter.id.toString() : 'unknown';
                    return `
                        <div style="padding: 0.8rem 1rem; border-bottom: 1px dashed var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: white;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 0.75rem; color: ${color}; font-weight: 800; letter-spacing: 0.5px;">${subj.name}</span>
                                <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); line-height: 1.4;">${prefix}<del style="color:var(--text-muted);">${t.chapter.title}</del></span>
                            </div>
                            <button class="btn btn-secondary" style="border: 1px solid ${color}; color: ${color}; padding: 0.4rem 0.8rem; font-size: 0.85rem; font-weight: 800; height: fit-content; border-radius: 4px; background: white;" onmouseover="this.style.background='${color}11'" onmouseout="this.style.background='white'" onclick="window.appCompletePast('${chId}', '${t.pastDateStr}', ${t.allocated})">
                                어제 완료 ✓
                            </button>
                        </div>
                    `;
                }).join('');
                
                missedHtml = `
                    <div class="glass-panel" style="margin-top: 3rem; margin-bottom: 1.5rem; padding: 1.5rem; background-size: 20px 20px; background-image: linear-gradient(to right, rgba(46, 83, 57, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(46, 83, 57, 0.1) 1px, transparent 1px);">
                        <div style="background: rgba(255,255,255,0.7); padding: 0.5rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--color-forest);">
                            <h3 style="color: var(--color-forest); margin: 0 0 0.2rem 0; font-size: 1.1rem; letter-spacing: -0.5px;">⚠️ 어제 못한 복습 (점검)</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">이미 넘어간 일정입니다. 별도로 어제 공부하셨다면 아래에서 체크해주세요.</p>
                        </div>
                        <div style="border: 1px solid var(--glass-border); border-bottom: none; border-radius: 8px; overflow: hidden; background: white;">
                            ${mCards}
                        </div>
                    </div>
                `;
            }

            html += `
                ${pacingWarningHtml}
                <div style="flex:1;">
                    <div class="glass-panel" style="padding: 2.5rem 2rem;">
                        <h2 style="margin-bottom: 2rem; color: var(--color-forest); font-size: 1.6rem; letter-spacing:-0.4px; font-family:'Apple SD Gothic Neo', serif;">Today's Schedule</h2>
                        <div style="display: flex; flex-direction: column; border-top: 1px solid var(--glass-border);">
                            ${cardsHtml}
                        </div>
                    </div>
                </div>
                ${missedHtml}
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary glass-panel" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid #bfdbfe;" onclick="window.appCompleteAhead()">🔥 초과 달성 기록</button>
                        <button class="btn btn-primary glass-panel" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #a7f3d0;" onclick="window.openCustomTaskModal()">➕ 추가 일정 스케줄</button>
                        <button class="btn btn-primary glass-panel" style="background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid #c7d2fe;" onclick="window.openPastProgressModal()">🕰️ 과거 진도 입력</button>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${(engine.state.todayAllDueReviews && engine.state.todayAllDueReviews.length > 0) ? `<button class="btn btn-secondary glass-panel" style="border: 1px solid #f87171; color: #ef4444;" onclick="window.openPendingReviewsModal()">🔄 복습목록 (${engine.state.todayAllDueReviews.length})</button>` : ''}
                        <button class="btn btn-secondary glass-panel" onclick="window.appSkipDay()">${skipBtnText}</button>
                    </div>
                </div>
            `;
        }
    } else {
        if (viewType === 'history' || viewType === 'monthly') {
            let monthTitle = window.currentViewDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1.5rem;">
                    <div class="history-nav-container">
                        <button class="history-nav-btn" onclick="window.historyPrevMonth()" title="이전 달">❮</button>
                        <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">${monthTitle}</h2>
                        <button class="history-nav-btn" onclick="window.historyNextMonth()" title="다음 달">❯</button>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        ${viewType === 'history' ? `<button class="btn btn-primary" style="background: var(--color-primary); color: white; padding: 0.9rem 1.8rem; border-radius: 14px; box-shadow: 0 10px 25px var(--color-primary-glow);" onclick="window.openFullProgressModal()">📋 전체 진도 확인/수정</button>` : ''}
                    </div>
                </div>
                ${viewType === 'monthly' ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1.5rem;">
                    <button class="btn btn-secondary glass-panel" style="padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 700; color: var(--text-muted); font-size: 0.85rem;" onclick="window.setVacationPeriod()" title="며칠간 길게 쉴 때 사용">🏖️ 긴 휴식 (기간 지정)</button>
                </div>
                ` : ''}
            `;
        }
        html += `<div class="${(daysToRender === 7) ? 'weekly-grid' : 'monthly-grid'}">`;
        for (let i = 0; i < daysToRender; i++) {
            let y = currentDate.getFullYear();
            let m = String(currentDate.getMonth()+1).padStart(2, '0');
            let d = String(currentDate.getDate()).padStart(2, '0');
            let dateStr = `${y}-${m}-${d}`;
            
            let displayDate = `${m}/${d} (${currentDate.toLocaleDateString('ko-KR', {weekday:'short'})})`;
            let badgesHtml = '';

            if (viewType === 'history') {
                let completedTasks = [];
                for (let k in engine.state.progress) {
                    let p = engine.state.progress[k];
                    if (p.status === 'completed' && p.completedAt === dateStr) {
                        completedTasks.push({ id: k, p: p });
                    }
                }
                
                if (completedTasks.length === 0) {
                    badgesHtml = `<div class="calendar-empty" style="color:var(--text-muted); opacity:0.5;">완료 내역 없음</div>`;
                } else {
                    badgesHtml = completedTasks.map(ct => {
                        let subjInfo = findSubjectOfChapter(ct.id);
                        if (!subjInfo) return '';
                        let color = getPastelColor(subjInfo.subjKey);
                        let shortName = subjInfo.subject.name.length > 5 ? subjInfo.subject.name.substring(0,4) : subjInfo.subject.name;
                        let titlePart = subjInfo.chapter.title;
                        if (titlePart.length > 10) titlePart = titlePart.substring(0, 10) + '...';
                        
                        return `<div class="mini-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subjInfo.subject.name} - ${subjInfo.chapter.title}">${shortName} - ${titlePart}</span>
                            <button onclick="window.cancelComplete('${ct.id}')" style="background: none; border: none; color: ${color}; cursor: pointer; font-size: 0.8rem; margin-left: 4px; padding: 0 2px;" title="공부 기록 취소">✕</button>
                        </div>`;
                    }).join('');
                }
            } else {
                let tasks = engine.getScheduleForDate(dateStr);
                
                if (tasks.length === 0) {
                    badgesHtml = `<div class="calendar-empty">휴식 / 일정 없음</div>`;
                } else {
                    badgesHtml = tasks.map(t => {
                        let color = getPastelColor(t.subjectId);
                        let subj = window.subjectData[t.subjectId];
                        let prefix = t.isReview ? '[복습] ' : '';
                        let shortName = subj.name.length > 5 ? subj.name.substring(0,4) : subj.name;
                        let titlePart = t.chapter.title;
                        if (titlePart.length > 10) titlePart = titlePart.substring(0, 10) + '...';
                        
                        return `<div class="mini-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44; cursor: grab; font-weight: 600;" draggable="true" ondragstart="window.dragTaskStart(event, '${t.chapter.id}')">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${prefix}${subj.name} - ${t.chapter.title}">${prefix}${shortName} - ${titlePart}</span>
                            <span style="flex-shrink:0; margin-left:4px; opacity: 0.8;">${t.allocated.toFixed(1)}h</span>
                        </div>`;
                    }).join('');
                }
            }
            
            let wday = currentDate.getDay();
            let isSkipped = engine.state.skippedDays && engine.state.skippedDays.includes(dateStr);
            let skipToggleHtml = (viewType === 'weekly' || viewType === 'monthly') && wday !== 0 && wday !== 6 ? 
                `<label style="cursor:pointer; display:flex; align-items:center;" title="하루 온전히 쉴 때 체크"><input type="checkbox" onchange="window.toggleSkipDayCard('${dateStr}', this.checked)" ${isSkipped?'checked':''} style="accent-color: #ef4444; width:16px; height:16px; margin:0; cursor:pointer;"></label>` : '';

            html += `
                <div class="calendar-day" ondragover="event.preventDefault()" ondrop="window.dropTask(event, '${dateStr}')">
                    <div class="calendar-date" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${displayDate}</span>
                        ${skipToggleHtml}
                    </div>
                    <div class="calendar-badges">${isSkipped ? `<div class="calendar-empty" style="color: #ef4444; opacity: 0.8; font-weight: 700;">🏖️ 휴식 (공부 쉼)</div>` : badgesHtml}</div>
                </div>
            `;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        html += `</div>`;
    }

        container.innerHTML = html;
    } catch (err) {
        console.error("Dashboard initialization failed:", err);
        const containerFallback = document.getElementById('view-container');
        if (containerFallback) {
            containerFallback.innerHTML = `
                <div class="glass-panel" style="padding: 2.5rem; text-align: center; background: rgba(254, 226, 226, 0.5); border: 2px solid #fecaca; border-radius: 16px;">
                    <h3 style="color: #b91c1c; margin: 0; font-size: 1.25rem;">⚠️ 대시보드 로딩 중 일시적 오류 발생</h3>
                    <p style="color: #991b1b; margin: 0.75rem 0 1.5rem 0; font-size: 0.95rem; line-height: 1.5;">
                        일시적인 설정값 충돌이 감지되었습니다. <b>아래 버튼을 눌러 초기 설정으로 복구</b>하시면 즉시 정상 이용이 가능합니다.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center;">
                        <button onclick="location.reload()" class="btn btn-primary" style="background: #ef4444; color: white;">재시도</button>
                        <button onclick="localStorage.clear(); location.reload();" class="btn btn-secondary">데이터 정화 및 완전 초기화</button>
                    </div>
                </div>
            `;
        }
    }
}

function findSubjectOfChapter(id) {
    let dEngine = window.engine || (typeof engine !== 'undefined' ? engine : null);
    if (dEngine && dEngine.state && dEngine.state.customTasks) {
        let ct = dEngine.state.customTasks.find(c => c.id == id);
        if (ct) return { subjKey: ct.subjectId, subject: window.subjectData[ct.subjectId], chapter: ct };
    }
    for (let subjKey in window.subjectData) {
        let chapter = window.subjectData[subjKey].chapters.find(c => c.id == id);
        if (chapter) return { subjKey, subject: window.subjectData[subjKey], chapter };
        
        if (subjKey === 'tax') {
            let baseChId = String(id).replace('_obj', '');
            if (baseChId !== String(id)) {
                let baseCh = window.subjectData[subjKey].chapters.find(c => String(c.id) === baseChId);
                if (baseCh) {
                    return {
                        subjKey, 
                        subject: window.subjectData[subjKey], 
                        chapter: {
                            id: id,
                            title: `[객관식] ${baseCh.title.replace(/\[법인세\]|\[소득세\]|\[부가세\]|\[상증세\]|\[국기법\]/g, '').trim()} 문제풀이`
                        }
                    };
                }
            }
        }
    }
    return null;
}

function getPastelColor(id) {
    if (id === 'tax') return '#fca5a5';
    if (id === 'accounting') return '#a78bfa';
    if (id === 'finance') return '#86efac';
    if (id === 'cost' || id === 'cost_accounting') return '#fcd34d';
    return '#a78bfa';
}

function createTaskCard(type, chapter, subject, allocatedHours, overrideColor, isReview = false, reviewDay = 0) {
    let badgeHtml = '';
    
    if (isReview) {
        badgeHtml = `<span class="badge review">🔄 ${reviewDay}일차 복습</span>`;
    } else {
        const isHard = chapter.difficulty >= 4;
        const isMedium = chapter.difficulty === 3;
        
        if (isHard) badgeHtml = '<span class="badge hard">🔥 집중 요망 (고난도)</span>';
        else if (isMedium) badgeHtml = '<span class="badge medium">⭐ 보통</span>';
        else badgeHtml = '<span class="badge easy">🟢 평이함</span>';
    }
    
    const estTime = allocatedHours.toFixed(1);
    const titlePrefix = isReview ? '[복습] ' : '';

    return `
        <div class="task-card glass-panel ${type} ${isReview ? 'review' : ''}">
            <div class="task-header">
                <span class="time-label" style="color: ${overrideColor}">${subject.icon} ${subject.name}</span>
                ${badgeHtml}
            </div>
            <h3 class="task-title">${titlePrefix}${chapter.title}</h3>
            <p class="task-details">과정 난이도를 반영한 소요 예상: ${estTime}시간</p>
            
            <div class="task-actions">
                <button class="btn btn-primary" style="background: ${overrideColor}; color: #334155" onclick="window.appComplete('${chapter.id}')">✅ 학습 완료</button>
                <button class="btn btn-secondary" onclick="window.appPartial('${chapter.id}')">⏱️ 부분 완료...</button>
            </div>
        </div>
    `;
}

function createMiniTaskCard(type, chapter, subject, allocatedHours, overrideColor, isReview = false) {
    const titlePrefix = isReview ? '[복습] ' : '';
    return `
        <div class="glass-panel ${type}" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${overrideColor}; border-radius: 12px; opacity: ${isReview ? 0.9 : 1}; background: var(--glass-bg);">
            <div>
                <span style="font-size: 0.85rem; font-weight: 700; color: ${overrideColor}; margin-bottom: 0.25rem; display: block;">${subject.name}</span>
                <span style="font-weight: 600; color: var(--text-main); font-size: 1.1rem;">${titlePrefix}${chapter.title}</span>
            </div>
            <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">
                예상 ${allocatedHours.toFixed(1)}시간
            </div>
        </div>
    `;
}

window.appCompletePast = (chapterId, pastDateStr, allocatedHours) => {
    window.openPacingCompletionModal(chapterId, allocatedHours, pastDateStr);
};

window.appComplete = (chapterId, allocatedHours) => {
    window.openPacingCompletionModal(chapterId, allocatedHours);
};

window.appPartial = (chapterId, allocatedHours) => {
    window.openPacingCompletionModal(chapterId, allocatedHours);
};

window.openPacingCompletionModal = (chapterId, allocatedHours, pastDateStr = null) => {
    window.currentCompletingChapter = { id: chapterId, hours: allocatedHours, pastDateStr: pastDateStr };
    
    let modal = document.getElementById('unified-completion-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'unified-completion-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";

    let subInfo = findSubjectOfChapter(chapterId);
    let titleStr = subInfo ? subInfo.chapter.title : '지정된 일정';

    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 0; background: white !important; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
            <div style="background: var(--color-primary); padding: 1.5rem; color: white; text-align: center;">
                <h3 style="margin: 0; font-size: 1.25rem;">📝 오늘의 학습 기록</h3>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">"${titleStr}"</p>
            </div>
            
            <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <!-- 1. Progress Input -->
                <div>
                    <label style="display: block; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-main);">1. 얼마나 진행하셨나요? (진도율)</label>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                        <button class="progress-btn active" onclick="window.selectModalProgress(100, this)">100%</button>
                        <button class="progress-btn" onclick="window.selectModalProgress(80, this)">80%</button>
                        <button class="progress-btn" onclick="window.selectModalProgress(50, this)">50%</button>
                        <button class="progress-btn" onclick="window.selectModalProgress(30, this)">30%</button>
                    </div>
                    <input type="hidden" id="modal-progress-val" value="100">
                </div>

                <!-- 2. Time Input -->
                <div>
                    <label style="display: block; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-main);">2. 실제로 공부한 시간은?</label>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="flex: 1;">
                            <input type="number" id="modal-actual-hours" class="form-input" value="${allocatedHours.toFixed(1)}" step="0.1" style="width: 100%; padding: 0.8rem; text-align: center; font-size: 1.1rem;">
                        </div>
                        <span style="font-weight: 600; color: var(--text-muted);">시간 소요</span>
                    </div>
                </div>

                <!-- 3. Feedback / Bookmark -->
                <div id="modal-feedback-section">
                    <label style="display: block; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-main);">3. 체감 난이도는 어땠나요?</label>
                    <div style="display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 0.5rem;">
                        <button class="fb-btn" onclick="window.selectModalFB('easy', this)">😆 쉬움</button>
                        <button class="fb-btn active" onclick="window.selectModalFB('normal', this)">🙂 보통</button>
                        <button class="fb-btn" onclick="window.selectModalFB('hard', this)">🥵 어려움</button>
                    </div>
                    <input type="hidden" id="modal-fb-val" value="normal">
                </div>

                <div id="modal-bookmark-section" style="display: none;">
                    <label style="display: block; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-main);">📍 복습을 위한 북마크 (어디까지?)</label>
                    <input type="text" id="modal-bookmark-val" class="form-input" placeholder="예: 건설계약 진행률 측정까지" style="width: 100%; padding: 0.8rem;">
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                    <button class="btn btn-secondary" style="flex: 1; padding: 1rem;" onclick="document.getElementById('unified-completion-modal').style.display='none'">취소</button>
                    <button class="btn btn-primary" style="flex: 2; padding: 1rem; background: var(--color-primary); color: white;" onclick="window.submitUnifiedProgress()">기록 저장 및 스케줄 갱신 ✅</button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.selectModalProgress = (val, btn) => {
    document.getElementById('modal-progress-val').value = val;
    document.querySelectorAll('.progress-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById('modal-bookmark-section').style.display = (val < 100) ? 'block' : 'none';
    document.getElementById('modal-feedback-section').style.display = (val === 100) ? 'block' : 'none';
};

window.selectModalFB = (val, btn) => {
    document.getElementById('modal-fb-val').value = val;
    document.querySelectorAll('.fb-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.submitUnifiedProgress = () => {
    let c = window.currentCompletingChapter;
    let progress = parseInt(document.getElementById('modal-progress-val').value);
    let actualHours = parseFloat(document.getElementById('modal-actual-hours').value) || c.hours;
    let feedback = document.getElementById('modal-fb-val').value;
    let bookmark = document.getElementById('modal-bookmark-val').value.trim();

    if (progress === 100) {
        engine.markCompleted(c.id, c.pastDateStr || null, actualHours * 60, feedback);
    } else {
        engine.markPartial(c.id, progress, actualHours * 60, feedback, bookmark || `${progress}% 지점`);
    }

    document.getElementById('unified-completion-modal').style.display = 'none';
    initDashboard();
};

window.vacationDragState = { isDragging: false, start: null, end: null, baseMonth: new Date() };

window.setVacationPeriod = () => {
    let modal = document.getElementById('vacation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'vacation-modal';
        document.body.appendChild(modal);
    }
    
    window.vacationDragState.baseMonth = new Date();
    window.vacationDragState.start = null;
    window.vacationDragState.end = null;
    window.vacationDragState.isDragging = false;
    
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: flex-start; overflow-y: auto; padding: 2rem 1rem; user-select: none;";
    
    modal.innerHTML = `
        <div class="glass-panel" style="background: #FAF6F0; width: 100%; max-width: 400px; margin: auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(92, 77, 60, 0.15); display: flex; flex-direction: column;">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(139,115,85,0.15); display:flex; justify-content:space-between; align-items:center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.15rem; color: #5C4D3C; font-weight: 800;">🏖️ 긴 휴식 (기간 지정)</h3>
                <button onclick="document.getElementById('vacation-modal').style.display='none'" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#a89f91; padding:0;">&times;</button>
            </div>
            <div style="padding: 1.5rem; background: #FAF6F0; display:flex; flex-direction:column; gap:1rem; flex-grow: 1;">
                <div style="text-align:center; color: #8c7b6b; font-size: 0.85rem;">
                    쉬는 날의 <b>시작일</b>과 <b>종료일</b>을 차례로 클릭하세요. (또는 드래그)
                </div>
                <div id="vacation-calendar-container" style="flex-grow: 1;"></div>
            </div>
            <div style="padding: 1.2rem 1.5rem; border-top: 1px solid rgba(139,115,85,0.15); display: flex; justify-content: flex-end; gap: 0.5rem; background: #FAF6F0; flex-shrink: 0;">
                <button class="btn btn-secondary" style="background: transparent; color: #a89f91; border: none; font-weight: 700; margin-right: auto;" onclick="document.getElementById('vacation-modal').style.display='none'">닫기</button>
                <button class="btn btn-secondary" style="background: #EBE4D8; color: #d97777; border: none; font-weight: 800;" onclick="window.removeVacationPeriod()">선택 해제</button>
                <button class="btn btn-primary" style="background: #a68a6d; color: white; border: none; font-weight: 800; box-shadow: 0 4px 10px rgba(166,138,109,0.3);" onclick="window.submitVacationPeriod()">휴일 등록</button>
            </div>
        </div>
    `;
    
    window.renderVacationCalendar();
};

window.renderVacationCalendar = () => {
    let container = document.getElementById('vacation-calendar-container');
    if(!container) return;
    
    let base = window.vacationDragState.baseMonth;
    let y = base.getFullYear();
    let m = base.getMonth();
    
    let firstDay = new Date(y, m, 1);
    let lastDay = new Date(y, m + 1, 0);
    
    let startOffset = firstDay.getDay();
    let totalDays = lastDay.getDate();
    
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
            <button style="background:none; border:none; padding:0.4rem; cursor:pointer; color:#8c7b6b;" onclick="window.vacationChangeMonth(-1)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style="font-weight:900; font-size:1.2rem; color: #5C4D3C;">${y}년 ${m+1}월</div>
            <button style="background:none; border:none; padding:0.4rem; cursor:pointer; color:#8c7b6b;" onclick="window.vacationChangeMonth(1)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); grid-auto-rows: 38px; gap:4px; text-align:center;">
    `;
    
    let wdays = ['S','M','T','W','T','F','S'];
    wdays.forEach((w, i) => {
        let color = i===0 ? '#d97777' : (i===6 ? '#6c9a8b' : '#a89f91');
        html += `<div style="font-size:0.85rem; color:${color}; font-weight:800; display:flex; align-items:center; justify-content:center;">${w}</div>`;
    });
    
    let totalCells = 42;
    let renderedCells = 0;
    
    for(let i=0; i<startOffset; i++){
        html += `<div></div>`;
        renderedCells++;
    }
    
    let selStart = window.vacationDragState.start ? new Date(window.vacationDragState.start).getTime() : null;
    let selEnd = window.vacationDragState.end ? new Date(window.vacationDragState.end).getTime() : null;
    
    if (selStart && selEnd && selStart > selEnd) {
        let t = selStart; selStart = selEnd; selEnd = t;
    }
    
    let skipped = engine.state.skippedDays || [];
    
    for(let d=1; d<=totalDays; d++){
        let dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let ts = new Date(dStr).getTime();
        
        let isSel = (selStart && selEnd && ts >= selStart && ts <= selEnd);
        let isSingleSel = (selStart && ts === selStart && !selEnd);
        let isSkip = skipped.includes(dStr);
        let isHol = engine.isKoreanHoliday && engine.isKoreanHoliday(dStr);
        let dDate = new Date(ts);
        let wday = dDate.getDay();
        
        let bg = 'transparent';
        let tColor = (wday === 0 || isHol) ? '#d97777' : (wday === 6 ? '#6c9a8b' : '#5C4D3C');
        let fontWeight = '700';
        let boxStyle = `border-radius: 50%; width: 32px; height: 32px; margin: auto; display:flex; align-items:center; justify-content:center;`;
        
        if (isSel || isSingleSel) {
            bg = '#a68a6d'; // Mocha beige
            tColor = 'white';
            boxStyle += ` box-shadow: 0 4px 10px rgba(166,138,109,0.3);`;
        } else if (isSkip || isHol) {
            bg = '#f2e8e3'; // Warm pinkish beige
            tColor = '#c28c8c';
        }
        
        html += `
            <div onmousedown="window.vdDragStart('${dStr}')"
                 onmouseenter="window.vdDragEnter('${dStr}')"
                 style="cursor:pointer; display:flex; align-items:center; justify-content:center;">
                 <div style="background:${bg}; color:${tColor}; font-weight:${fontWeight}; font-size:0.95rem; transition: all 0.2s ease; ${boxStyle}">
                     ${d}
                 </div>
            </div>
        `;
        renderedCells++;
    }
    
    while(renderedCells < totalCells) {
        html += `<div></div>`;
        renderedCells++;
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
};

window.vacationChangeMonth = (diff) => {
    let b = window.vacationDragState.baseMonth;
    b.setMonth(b.getMonth() + diff);
    window.renderVacationCalendar();
};

window.vdDragStart = (dStr) => {
    if (window.vacationDragState.start && window.vacationDragState.end) {
        window.vacationDragState.start = dStr;
        window.vacationDragState.end = null;
    } else if (!window.vacationDragState.start) {
        window.vacationDragState.start = dStr;
        window.vacationDragState.end = null;
    } else if (!window.vacationDragState.end) {
        window.vacationDragState.end = dStr;
        window.vacationDragState.isDragging = false;
        window.renderVacationCalendar();
        return;
    }
    window.vacationDragState.isDragging = true;
    window.renderVacationCalendar();
};

window.vdDragEnter = (dStr) => {
    if(!window.vacationDragState.isDragging) return;
    window.vacationDragState.end = dStr;
    window.renderVacationCalendar();
};

document.addEventListener('mouseup', () => {
    if(window.vacationDragState && window.vacationDragState.isDragging){
        window.vacationDragState.isDragging = false;
        window.renderVacationCalendar();
    }
});

window.submitVacationPeriod = () => {
    let st = window.vacationDragState.start;
    let ed = window.vacationDragState.end || window.vacationDragState.start;
    
    if(!st) {
        alert("선택된 기간이 없습니다.");
        return;
    }
    
    let stMs = new Date(st).getTime();
    let edMs = new Date(ed).getTime();
    
    if (stMs > edMs) {
        let t = st; st = ed; ed = t;
    }
    
    if (!engine.state.skippedDays) engine.state.skippedDays = [];
    
    let d = new Date(st);
    let endD = new Date(ed);
    let added = 0;
    while(d <= endD) {
        let y = d.getFullYear(); let m = String(d.getMonth()+1).padStart(2,'0'); let dd = String(d.getDate()).padStart(2,'0');
        let dStr = `${y}-${m}-${dd}`;
        if (!engine.state.skippedDays.includes(dStr)) {
            engine.state.skippedDays.push(dStr);
            added++;
        }
        d.setDate(d.getDate() + 1);
    }
    
    if (added > 0) {
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
    }
    document.getElementById('vacation-modal').style.display='none';
};

window.removeVacationPeriod = () => {
    let st = window.vacationDragState.start;
    let ed = window.vacationDragState.end || window.vacationDragState.start;
    
    if(!st) {
        alert("해제할 기간이 선택되지 않았습니다.");
        return;
    }
    
    let stMs = new Date(st).getTime();
    let edMs = new Date(ed).getTime();
    
    if (stMs > edMs) {
        let t = st; st = ed; ed = t;
    }
    
    if (!engine.state.skippedDays) engine.state.skippedDays = [];
    
    let d = new Date(st);
    let endD = new Date(ed);
    let removed = 0;
    
    while(d <= endD) {
        let y = d.getFullYear(); let m = String(d.getMonth()+1).padStart(2,'0'); let dd = String(d.getDate()).padStart(2,'0');
        let dStr = `${y}-${m}-${dd}`;
        
        let idx = engine.state.skippedDays.indexOf(dStr);
        if (idx !== -1) {
            engine.state.skippedDays.splice(idx, 1);
            removed++;
        }
        d.setDate(d.getDate() + 1);
    }
    
    if (removed > 0) {
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
    }
    document.getElementById('vacation-modal').style.display='none';
};

window.toggleSkipDayCard = (dateStr, isSkipped) => {
    if (!engine.state.skippedDays) engine.state.skippedDays = [];
    if (isSkipped) {
        if (!engine.state.skippedDays.includes(dateStr)) {
            engine.state.skippedDays.push(dateStr);
        }
    } else {
        engine.state.skippedDays = engine.state.skippedDays.filter(d => d !== dateStr);
    }
    engine.saveState();
    engine.generateSchedule();
    initDashboard();
};

window.appSkipDay = () => {
    let todayStr = engine.getTodayStr();
    let isOptedInDay = engine.state.settings.extraStudyDays && engine.state.settings.extraStudyDays.includes(todayStr);

    if (isOptedInDay) {
        if (confirm('수동으로 추가하셨던 오늘 일정을 취소하고, 즉시 휴무일로 되돌리시겠습니까?')) {
            engine.state.settings.extraStudyDays = engine.state.settings.extraStudyDays.filter(d => d !== todayStr);
            engine.saveState();
            engine.generateSchedule();
            initDashboard();
        }
    } else {
        if (confirm('오늘 피치 못할 사정으로 공부를 완전히 건너뛰시겠습니까?\\n(오늘의 진도 분량이 통째로 내일로 미뤄지게 됩니다)')) {
            engine.skipDay(todayStr);
            initDashboard();
        }
    }
};

window.openPendingReviewsModal = () => {
    let allList = engine.state.todayAllDueReviews || [];
    if (allList.length === 0) return;
    
    let todaySch = engine.state.schedule[engine.getTodayStr()] || [];
    let scheduledIds = todaySch.filter(t => t.isReview).map(t => String(t.chapter.id));
    
    let modal = document.getElementById('pending-reviews-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pending-reviews-modal';
        document.body.appendChild(modal);
    }
    
    let listHtml = allList.map(item => {
        let subj = window.subjectData[item.subjKey];
        let chIdStr = String(item.ch.id);
        let isChecked = scheduledIds.includes(chIdStr) ? 'checked' : '';
        return `
            <label style="display: flex; align-items: center; gap: 10px; padding: 12px; background: ${isChecked?'#f0fdf4':'white'}; border: 1px solid ${isChecked?'#86efac':'#e2e8f0'}; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='${isChecked?'#dcfce7':'#f8fafc'}'" onmouseout="this.style.background='${isChecked?'#f0fdf4':'white'}'">
                <input type="checkbox" class="pending-review-checkbox" value="${item.ch.id}" ${isChecked} style="width: 18px; height: 18px; accent-color: var(--color-primary);">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 700; color: ${isChecked?'#166534':'var(--text-main)'}; font-size: 0.95rem;">[${subj.name}] ${item.ch.title}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${item.dur.toFixed(1)}시간 예상 • ${item.diffDays}일 전 완료건</span>
                </div>
            </label>
        `;
    }).join('');

    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: center; padding: 1rem;";
    modal.innerHTML = `
        <div class="glass-panel" style="background: var(--bg-main); width: 100%; max-width: 450px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="padding: 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.05);">
                <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-main);">🔄 오늘치 복습 스케줄 커스텀하기</h3>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">자동 배정된 복습을 취소하거나 대기중인 복습을 마음대로 교체 및 추가할 수 있습니다. 체크된 항목만 오늘 스케줄에 확정됩니다.</p>
            </div>
            <div style="padding: 1.5rem; max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-variant);">
                ${listHtml}
            </div>
            <div style="padding: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--bg-main);">
                <button class="btn btn-secondary" onclick="document.getElementById('pending-reviews-modal').style.display='none'">취소</button>
                <button class="btn btn-primary" onclick="window.submitPendingReviews()">스케줄 확정하기</button>
            </div>
        </div>
    `;
};

window.submitPendingReviews = () => {
    let checkboxes = document.querySelectorAll('.pending-review-checkbox');
    let selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(cb.value);
        }
    });
    
    let dStr = engine.getTodayStr();
    
    if (!engine.state.settings.selectedReviews) engine.state.settings.selectedReviews = {};
    engine.state.settings.selectedReviews[dStr] = selectedIds;
    
    engine.saveState();
    engine.generateSchedule();
    document.getElementById('pending-reviews-modal').style.display='none';
    initDashboard();
};

window.appCompleteAhead = () => {
    let modal = document.getElementById('ahead-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ahead-modal';
        modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
        document.body.appendChild(modal);
    }
    
    let optionsHtml = '';
    let hasPending = false;
    let order = ['tax', 'accounting', 'cost_accounting', 'finance'];
    order.forEach(subjKey => {
        let subj = window.subjectData[subjKey];
        let pending = subj.chapters.filter(c => !engine.isCompleted(c.id));
        if (pending.length > 0) {
            hasPending = true;
            optionsHtml += `<div style="font-weight: 800; margin-top: 14px; margin-bottom: 6px; color: var(--color-primary); font-size: 1.05rem;">📘 ${subj.name}</div>`;
            for (let i = 0; i < Math.min(5, pending.length); i++) {
                optionsHtml += `
                    <label style="display: flex; align-items: center; gap: 10px; padding: 8px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" name="ahead-chapter" value="${pending[i].id}" style="width: 20px; height: 20px; accent-color: var(--color-primary);">
                        <span style="font-size: 1rem; color: var(--text-main); line-height: 1.3;">${pending[i].title}</span>
                    </label>
                `;
            }
        }
    });

    if (!hasPending) {
        alert('더 이상 선행할 진도가 없습니다! 모든 과목의 진도를 완료하셨습니다. 🎉');
        return;
    }

    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 450px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.4);">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: var(--color-primary); font-size: 1.2rem;">🔥 초과 달성 다중 기록</h3>
                <button class="btn btn-secondary" style="border: none; padding: 0.5rem;" onclick="document.getElementById('ahead-modal').style.display='none'">✕ 닫기</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem; background: var(--glass-bg);">
                <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem; line-height: 1.4;">오늘 추가로 더 공부하신 진도를 <b>모두 체크</b>해주세요. 과목과 상관없이 모두 한 번에 처리됩니다!</p>
                <div style="max-height: 280px; overflow-y: auto; padding: 1rem; border-radius: 8px; border: 1px solid #cbd5e1; background: white;">
                    ${optionsHtml}
                </div>
                <button class="btn btn-primary" style="margin-top: 0.5rem; width: 100%; padding: 1rem; font-size: 1.05rem;" onclick="window.submitCompleteAhead()">✅ 선택한 진도 모두 일괄 완료</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.openPastProgressModal = () => {
    try {
        let modal = document.getElementById('past-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'past-modal';
            document.body.appendChild(modal);
        }
        modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";

        let optionsHtml = '';
        let hasPending = false;
        let order = ['tax', 'accounting', 'cost_accounting', 'finance'];
        order.forEach(subjKey => {
            let subj = window.subjectData[subjKey];
            let pending = subj.chapters.filter(c => !engine.isCompleted(c.id));
            if (pending.length > 0) {
                hasPending = true;
                optionsHtml += `<div style="font-weight: 800; margin-top: 14px; margin-bottom: 6px; color: var(--color-primary); font-size: 1.05rem;">📘 ${subj.name}</div>`;
                pending.forEach(p => {
                    optionsHtml += `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 8px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" name="past-chapter" value="${p.id}" style="width: 20px; height: 20px; accent-color: var(--color-primary);">
                            <span style="font-size: 1rem; color: var(--text-main); line-height: 1.3;">${p.title}</span>
                        </label>
                    `;
                });
            }
        });

        if (!hasPending) {
            alert('모든 과목의 진도가 이미 완료된 상태입니다. 더 이상 추가할 과거 진도가 없습니다.');
            return;
        }

        modal.innerHTML = `
            <div style="width: 100%; max-width: 500px; display: flex; flex-direction: column; max-height: 85vh; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="padding: 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                    <h3 style="margin: 0; color: var(--color-primary);">🕰️ 과거 진도 자동 분산 입력</h3>
                    <button style="border: none; padding: 0.5rem; background: transparent; cursor: pointer; font-size: 1rem;" onclick="document.getElementById('past-modal').style.display='none'">✕ 닫기</button>
                </div>
                <div style="padding: 1.5rem; overflow-y: auto; flex: 1; background: var(--glass-bg);">
                    <p style="color: var(--text-muted); margin: 0 0 1rem 0; font-size: 0.95rem; line-height: 1.5;">
                        이미 학원이나 개인적으로 공부했던 챕터들을 모두 체크해주세요.<br>
                        <strong>날짜를 고민할 필요 없습니다!</strong> AI가 체크된 챕터들을 관리해드립니다.
                    </p>
                    <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #cbd5e1;">
                        ${optionsHtml}
                    </div>
                </div>
                <div style="padding: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05); background: white;">
                    <button style="width: 100%; padding: 1rem; font-size: 1.05rem; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.submitPastProgress()">✅ 일괄 자동 기록하기</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    } catch(e) {
        alert("이 오류 화면을 캡처해서 전달해주세요: " + e.stack);
    }
};

window.submitPastProgress = () => {
    let checkedBoxes = document.querySelectorAll('input[name="past-chapter"]:checked');
    if (checkedBoxes.length > 0) {
        const now = new Date();
        let idx = 0;
        
        checkedBoxes.forEach(box => {
            let chapterId = isNaN(parseInt(box.value)) ? box.value : parseInt(box.value);
            // 2일 간격으로 과거로 역산 분산 (최대 30일 이내로 루프)
            let daysAgo = 1 + (idx * 2);
            if (daysAgo > 30) daysAgo = (daysAgo % 30) + 1;
            
            let d = new Date(now);
            d.setDate(d.getDate() - daysAgo);
            let y = d.getFullYear();
            let m = String(d.getMonth()+1).padStart(2, '0');
            let dt = String(d.getDate()).padStart(2, '0');
            
            engine.markCompleted(chapterId, `${y}-${m}-${dt}`, null, 'normal');
            idx++;
        });

        document.getElementById('past-modal').style.display = 'none';
        initDashboard();
        alert(`${checkedBoxes.length}개의 챕터가 과거 날짜로 자동 분산 스케줄링 되었습니다. 곧 복습 일정에 자연스럽게 등장합니다!`);
    } else {
        alert('완료하신 진도를 최소 1개 이상 선택해주세요.');
    }
};

window.submitCompleteAhead = () => {
    // legacy function kept for compatibility or fallback
    let checkedBoxes = document.querySelectorAll('input[name="ahead-chapter"]:checked');
    if (checkedBoxes.length > 0) {
        checkedBoxes.forEach(box => {
            let chapId = isNaN(parseInt(box.value)) ? box.value : parseInt(box.value);
            engine.markCompleted(chapId, null, null, 'easy');
        });
        document.getElementById('ahead-modal').style.display = 'none';
        initDashboard();
    } else {
        alert('완료하신 진도를 최소 1개 이상 선택해주세요.');
    }
};

window.customAlert = (msg) => {
    let modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-alert-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    modal.innerHTML = `
        <div style="width: 100%; max-width: 350px; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
            <div style="padding: 1.5rem; background: var(--glass-bg); text-align: center;">
                <p style="color: var(--text-main); font-size: 1.05rem; margin: 0; line-height: 1.5; white-space: pre-wrap;">${msg}</p>
            </div>
            <div style="padding: 1rem; border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: center;">
                <button class="btn btn-primary" style="width: 100%; padding: 0.8rem; font-size: 1rem;" onclick="document.getElementById('custom-alert-modal').style.display='none'">확인</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.customConfirm = (msg, onConfirm) => {
    let modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    modal.innerHTML = `
        <div style="width: 100%; max-width: 350px; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
            <div style="padding: 1.5rem; background: var(--glass-bg); text-align: center;">
                <p style="color: var(--text-main); font-size: 1.05rem; margin: 0; line-height: 1.5; white-space: pre-wrap;">${msg}</p>
            </div>
            <div style="padding: 1rem; border-top: 1px solid rgba(0,0,0,0.05); display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" style="flex: 1; padding: 0.8rem; font-size: 1rem;" onclick="document.getElementById('custom-confirm-modal').style.display='none'">취소</button>
                <button id="custom-confirm-btn" class="btn btn-primary" style="flex: 1; padding: 0.8rem; font-size: 1rem; background: #ef4444; color: white; border: none;">확인</button>
            </div>
        </div>
    `;
    
    document.getElementById('custom-confirm-btn').onclick = () => {
        document.getElementById('custom-confirm-modal').style.display = 'none';
        if (onConfirm) onConfirm();
    };
    
    modal.style.display = 'flex';
};

window.openTimeSettingModal = () => {
    let modal = document.getElementById('time-setting-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'time-setting-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    modal.innerHTML = `
        <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <div style="padding: 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: var(--color-primary);">⏰ 일일 학습 시간 설정</h3>
                <button style="border: none; background: transparent; cursor: pointer; font-size: 1rem;" onclick="document.getElementById('time-setting-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--glass-bg);">
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0; line-height: 1.4;">
                    <strong>AI 자동 마감 계산:</strong> 지금 시작할 시간(예: 14:30)을 입력해주세요. (오후 5시 마감 기준 자동 계산)
                </p>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0; line-height: 1.4;">
                    <strong>수동 목표 시간 입력:</strong> 공부하실 시간(예: 5.5)을 직접 숫자로 적으셔도 무방합니다.
                </p>
                <input type="text" id="mixed-time-input" class="form-input" placeholder="시작 시간(14:30) 또는 목표 공부 시간(5.5)" style="padding: 1rem; font-size: 1.1rem; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <button class="btn btn-primary" style="padding: 1rem; font-size: 1.05rem; margin-top: 0.5rem;" onclick="window.submitMixedTime()">설정 적용하기</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.submitMixedTime = () => {
    let raw = document.getElementById('mixed-time-input').value.trim();
    if (!raw) {
        window.customAlert('입력값이 없습니다.');
        return;
    }
    
    let available = 0;
    
    // Time format check (e.g., 14:30, 0900)
    if (raw.includes(':') || (parseFloat(raw) >= 12 && parseFloat(raw) < 2400 && !raw.includes('.')) || raw.length === 4) {
        let hourStr = raw;
        if (raw.includes(':')) {
            let parts = raw.split(':');
            let h = parseFloat(parts[0]);
            let m = parseFloat(parts[1]) || 0;
            hourStr = h + (m / 60);
        } else if (raw.length >= 3 && !raw.includes('.')) {
            let h = parseFloat(raw.substring(0, 2));
            let m = parseFloat(raw.substring(2));
            hourStr = h + (m / 60);
        }
        
        let startHour = parseFloat(hourStr);
        if (isNaN(startHour) || startHour < 0 || startHour >= 24) {
            window.customAlert('입력된 시작 시간이 올바르지 않습니다.\\n형식에 맞게 입력해주세요 (예: 14:30).');
            return;
        }

        let endTime = 17.0; // 오후 5시 마감
        available = Math.max(0, endTime - startHour);
        
        let lunchMsg = '';
        if (startHour <= 12.5 && available > 1.5) {
            available -= 1.5;
            lunchMsg = '\\n(※ 점심 식사시간 1.5시간 자동 차감)';
        }
        
        available = Math.round(available * 10) / 10;
        
        if (available <= 0) {
            window.customAlert('설정하신 시작 시간으로는 오늘(오후 5시 마감) 남은 가용 시간이 없습니다.');
            return;
        }
        
        window.customAlert(`AI 마감 시간 자동 계산됨:\\n\\n오늘 설정된 가용 시간은 총 ${available}시간 입니다.${lunchMsg}`);
    } else {
        // Duration format (e.g., 5.5, 9)
        let parsed = parseFloat(raw);
        if (isNaN(parsed) || parsed <= 0 || parsed > 24) {
            window.customAlert('유효한 숫자나 시간(HH:MM)을 입력해주세요.');
            return;
        }
        available = parsed;
        window.customAlert(`수동 목표 시간 적용 완료:\\n\\n오늘 하루 ${available}시간 분량의 공부 플랜을 새로 구성합니다.`);
    }
    
    // Daily Base Hours overriding without destroying the permanent default
    let todayStr = engine.getTodayStr();
    if (!engine.state.settings.dailyOverrides) engine.state.settings.dailyOverrides = {};
    engine.state.settings.dailyOverrides[todayStr] = available;
    
    if (!engine.state.settings.extraStudyDays) engine.state.settings.extraStudyDays = [];
    if (!engine.state.settings.extraStudyDays.includes(todayStr)) {
        engine.state.settings.extraStudyDays.push(todayStr);
    }
    
    engine.saveState();
    engine.generateSchedule();
    
    document.getElementById('time-setting-modal').style.display='none';
    initDashboard();
};

window.appReset = () => {
    if (confirm('스케줄이 정상적으로 뜨지 않나요? 모든 스터디 플래너 상태를 지우고 데이터를 초기화합니다. (성경 통독 데이터는 안전하게 유지됩니다)')) {
        localStorage.removeItem('study_planner_state');
        location.reload();
    }
};

window.populateCustomTaskChapters = () => {
    let subjKey = document.getElementById('custom-task-subj').value;
    let chapters = window.subjectData[subjKey].chapters;
    let html = '<option value="0">과목 맨 처음에 풀기</option>';
    chapters.forEach(c => {
        html += `<option value="${c.id}">${c.title} 직후에 풀기</option>`;
    });
    let chapSelect = document.getElementById('custom-task-after-chap');
    if (chapSelect) chapSelect.innerHTML = html;
};

window.openCustomTaskModal = () => {
    let modal = document.getElementById('custom-task-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-task-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    let subjOptions = ['tax', 'accounting', 'cost_accounting', 'finance'].map(k => `<option value="${k}">${window.subjectData[k].name}</option>`).join('');

    modal.innerHTML = `
        <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <div style="padding: 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: var(--color-primary);">➕ 연습문제 / 추가 스케줄</h3>
                <button style="border: none; background: transparent; cursor: pointer; font-size: 1rem;" onclick="document.getElementById('custom-task-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--glass-bg);">
                <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">예상 시간을 고민하지 않으셔도 됩니다! AI가 분량을 파악하여 <b>지정된 단원 진도 직후</b> 자연스러운 순서로 일정을 짜드립니다.</p>
                <select id="custom-task-subj" class="form-input" style="padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;" onchange="window.populateCustomTaskChapters()">${subjOptions}</select>
                <select id="custom-task-after-chap" class="form-input" style="padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;"></select>
                <input type="text" id="custom-task-title" class="form-input" placeholder="스케줄 이름 (예: 외부성,공공재 응용문제)" style="padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;">
                <div style="display: flex; gap: 0.5rem;">
                    <input type="number" id="custom-task-problems" class="form-input" placeholder="문제 수 (예: 87)" min="0" style="flex: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;">
                    <input type="number" id="custom-task-pages" class="form-input" placeholder="페이지 수 (예: 15)" min="0" style="flex: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;">
                </div>
                <button class="btn btn-primary" style="padding: 1rem; font-size: 1.05rem; margin-top: 0.5rem;" onclick="window.submitCustomTask()">진도표 순서에 넣기</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    window.populateCustomTaskChapters();
};

window.submitCustomTask = () => {
    let subjId = document.getElementById('custom-task-subj').value;
    let afterChapId = document.getElementById('custom-task-after-chap').value;
    let title = document.getElementById('custom-task-title').value.trim();
    let problems = parseInt(document.getElementById('custom-task-problems').value) || 0;
    let pages = parseInt(document.getElementById('custom-task-pages').value) || 0;
    
    if (!title) {
        alert('추가할 일정(연습문제) 이름을 입력해주세요.');
        return;
    }
    if (problems === 0 && pages === 0) {
        alert('예상 소요 시간을 스케줄러가 자동 계산할 수 있도록 문제 수나 페이지 수 중 하나를 입력해주세요!');
        return;
    }
    
    // CPA exam approx heuristic: 3.5 min/problem, 2.5 min/page 
    let estHours = ((problems * 3.5) + (pages * 2.5)) / 60.0;
    let taskId = 'custom_' + Date.now();
    
    engine.state.customTasks.push({
        id: taskId,
        subjectId: subjId,
        afterChapId: afterChapId,
        title: title,
        difficulty: 3, 
        weight: estHours / 1.5 
    });
    
    engine.saveState();
    engine.generateSchedule();
    
    document.getElementById('custom-task-modal').style.display = 'none';
    initDashboard();
    
    alert(`AI가 지정된 분량을 분석하여 약 ${estHours.toFixed(1)}시간이 소요될 것으로 파악했습니다!\n선택하신 챕터 직후의 진도 순서에 맞춰 스케줄러에 추가되었습니다.`);
};

window.editHistoryEntry = (id, oldDate) => {
    let p = engine.state.progress[id];
    if (!p) return;
    
    let action = prompt(`[기록 수정 / 취소]\n해당 진도의 완료 날짜를 변경하시려면 원하시는 날짜(YYYY-MM-DD 형식)를 입력해주세요.\n(예: 2026-03-28)\n\n만약 실수로 누르셨거나 공부를 안 하셨다면 '삭제'라고 기재해주세요.`, oldDate);
    
    if (!action) return;
    action = action.trim();
    
    if (action === '삭제') {
        p.status = 'pending';
        delete p.completedAt;
        
        let subInfo = findSubjectOfChapter(id);
        let eH = 1.5;
        if (subInfo) {
            let mult = engine.state.chapterMultipliers ? (engine.state.chapterMultipliers[id] || 1.0) : 1.0;
            let dH = subInfo.chapter.weight !== undefined ? (subInfo.chapter.weight * 1.5) : (subInfo.chapter.difficulty ? (subInfo.chapter.difficulty/2) : 1.5);
            eH = dH * mult;
        }
        if (engine.state.dailySpent && engine.state.dailySpent[oldDate]) {
            engine.state.dailySpent[oldDate] = Math.max(0, engine.state.dailySpent[oldDate] - eH);
        }
        
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
        window.customAlert('해당 진도의 완료 기록이 취소되고 미완료 상태로 복구되었습니다.');
        return;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(action)) {
        p.completedAt = action;
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
    } else {
        alert('올바른 날짜 형식(YYYY-MM-DD)이 아니거나 취소되었습니다.');
    }
};

window.cancelComplete = (id) => {
    let p = engine.state.progress[id];
    if (!p) return;
    
    let oldDate = p.completedAt;
    
    // 완전히 삭제해야 AI 스케줄러가 미완료 상태로 인식하고 오늘 할 일에 다시 넣습니다.
    delete engine.state.progress[id];
    
    // Subtract from dailySpent
    if (oldDate && engine.state.dailySpent && engine.state.dailySpent[oldDate]) {
        let subInfo = findSubjectOfChapter(id);
        if (subInfo) {
            let mult = engine.state.chapterMultipliers ? (engine.state.chapterMultipliers[id] || 1.0) : 1.0;
            let dH = subInfo.chapter.weight !== undefined ? (subInfo.chapter.weight * 1.5) : (subInfo.chapter.difficulty ? (subInfo.chapter.difficulty/1.5) : 1.5);
            let eH = dH * mult;
            engine.state.dailySpent[oldDate] = Math.max(0, engine.state.dailySpent[oldDate] - eH);
        }
    }
    
    engine.saveState();
    engine.generateSchedule();
    initDashboard();
    window.customAlert('✅ 학습 완료 기록이 취소되어 오늘 할 일로 돌아왔습니다.');
};

window.dragTaskStart = (event, id) => {
    event.dataTransfer.setData('text/plain', id);
};

window.dropTask = (event, dateStr) => {
    event.preventDefault();
    let id = event.dataTransfer.getData('text/plain');
    if (!id) return;
    
    if (!engine.state.settings.taskDateOverrides) engine.state.settings.taskDateOverrides = {};
    engine.state.settings.taskDateOverrides[id] = dateStr;
    
    if (!engine.state.settings.extraStudyDays) engine.state.settings.extraStudyDays = [];
    if (!engine.state.settings.extraStudyDays.includes(dateStr)) engine.state.settings.extraStudyDays.push(dateStr);
    
    engine.saveState();
    engine.generateSchedule();
    initDashboard();
};

window.editCustomTaskTitle = (taskId) => {
    let task = engine.state.customTasks.find(t => t.id === taskId);
    if (!task) return;
    let newTitle = prompt('새로운 추가 일정 제목을 입력하세요:', task.title);
    if (newTitle && newTitle.trim()) {
        task.title = newTitle.trim();
        engine.saveState();
        initDashboard();
    }
};

window.openPacingFlexModal = () => {
    let modal = document.getElementById('pacing-flex-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pacing-flex-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    let daysHtml = ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => {
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(255,255,255,0.5); border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="flex-day-${i}" style="width: 18px; height: 18px; accent-color: var(--color-primary);">
                    <span style="font-weight: 600;">이번주 ${d}요일</span>
                </label>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">추가</span>
                    <input type="number" id="flex-hrs-${i}" class="form-input" style="width: 60px; padding: 0.4rem; border-radius: 6px; border: 1px solid #cbd5e1; text-align: right;" value="2" min="1" step="0.5">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">시간</span>
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <div style="padding: 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: #b91c1c;">🚨 시간 유연 추가 설정</h3>
                <button style="border: none; background: transparent; cursor: pointer; font-size: 1rem;" onclick="document.getElementById('pacing-flex-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem; background: var(--glass-bg);">
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0; line-height: 1.4;">
                    합격 권고 페이스를 맞추기 위해 이번주 중 시간을 더 투입할 요일과 시간을 선택해주세요.
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
                    ${daysHtml}
                </div>
                <button class="btn btn-primary" style="padding: 1rem; font-size: 1.05rem; margin-top: 1rem; background: #ef4444; color: white; border: none;" onclick="window.submitPacingFlex()">선택한 요일에 시간 추가하기</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.submitPacingFlex = () => {
    let base = window.engine ? window.engine.state.settings.dailyHours : 5.5;
    let addedCount = 0;
    
    // Find dates for the current week (Monday-Sunday)
    let today = new Date();
    let day = today.getDay();
    let diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    
    for (let i = 0; i < 7; i++) {
        let cb = document.getElementById('flex-day-' + i);
        if (cb && cb.checked) {
            let addHrs = parseFloat(document.getElementById('flex-hrs-' + i).value) || 0;
            if (addHrs > 0) {
                let targetDate = new Date(today.getFullYear(), today.getMonth(), diffToMonday + i);
                targetDate.setHours(12); // avoid timezone issues
                let dtStr = targetDate.toISOString().split('T')[0];
                
                if (!engine.state.settings.dailyOverrides) engine.state.settings.dailyOverrides = {};
                
                // If the day already had an override, add to it, else add to base
                let currentForDay = engine.state.settings.dailyOverrides[dtStr] || base;
                engine.state.settings.dailyOverrides[dtStr] = currentForDay + addHrs;
                
                if (!engine.state.settings.extraStudyDays) engine.state.settings.extraStudyDays = [];
                if (!engine.state.settings.extraStudyDays.includes(dtStr)) engine.state.settings.extraStudyDays.push(dtStr);
                
                addedCount++;
            }
        }
    }
    
    if (addedCount > 0) {
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
        window.customAlert('선택하신 일정에 추가 시간이 배치되었습니다. 화이팅입니다!');
        document.getElementById('pacing-flex-modal').style.display='none';
    } else {
        window.customAlert('시간을 추가할 요일을 하나 이상 선택해주세요.');
    }
};

window.exportData = () => {
    const data = {
        planner: JSON.parse(localStorage.getItem('study_planner_state') || '{}'),
        bible: JSON.parse(localStorage.getItem('bible_progress_state') || '{}'),
        english: JSON.parse(localStorage.getItem('english_progress_state') || '{}')
    };
    const json = JSON.stringify(data, null, 2);
    
    let modal = document.getElementById('export-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'export-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2rem; background: white; border-radius: 16px;">
            <h3 style="margin-bottom: 1rem; color: var(--color-primary);">💾 데이터 백업 (안격 복사/저장)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">데이터량이 많아 복사가 잘릴 수 있으니 <b>[파일로 저장]</b>을 권장합니다.</p>
            <textarea id="export-text" style="width: 100%; height: 200px; padding: 1rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 0.75rem; margin-bottom: 1rem;" readonly></textarea>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="window.copyExportText()">📋 전체 복사하기</button>
                    <button class="btn btn-secondary" style="flex: 1; background: #6366f1; color: white; border: none;" onclick="window.downloadBackupFile()">💾 파일로 저장하기</button>
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('export-modal').style.display='none'">닫기</button>
            </div>
        </div>
    `;
    
    // innerHTML 대신 value로 직접 할당하여 데이터 잘림/변조 방지
    document.getElementById('export-text').value = json;
};

window.copyExportText = () => {
    const el = document.getElementById('export-text');
    el.select();
    document.execCommand('copy');
    alert('✅ 데이터가 클립보드에 전체 복사되었습니다!');
};

window.downloadBackupFile = () => {
    const json = document.getElementById('export-text').value;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study_planner_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.importData = () => {
    let modal = document.getElementById('import-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'import-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2rem; background: white; border-radius: 16px;">
            <h3 style="margin-bottom: 1rem; color: #10b981;">📥 데이터 복구 (가져오기)</h3>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">백업받은 데이터(JSON 코드)를 아래 입력창에 붙여넣어 주세요.<br><span style="color:#ef4444; font-weight:700;">(경고: 현재 기기의 모든 데이터가 덮어씌워집니다!)</span></p>
            <textarea id="import-text" style="width: 100%; height: 200px; padding: 1rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 0.8rem; margin-bottom: 1rem;" placeholder='{"planner": {...}, "bible": {...}}'></textarea>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" style="flex: 1; background: #10b981;" onclick="window.submitImport()">가져오기 및 새로고침 🔄</button>
                <button class="btn btn-secondary" onclick="document.getElementById('import-modal').style.display='none'">취소</button>
            </div>
        </div>
    `;
};

window.submitImport = () => {
    let rawInput = document.getElementById('import-text').value.trim();
    if (!rawInput) return;
    
    // 아이패드/모바일 특유의 스마트 구두점(둥근 따옴표) 및 공백 정제
    let sanitized = rawInput
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ');

    try {
        const data = JSON.parse(sanitized);
        let count = 0;
        
        // 데이터 구조 검증 및 저장
        if (data.planner && typeof data.planner === 'object') { 
            localStorage.setItem('study_planner_state', JSON.stringify(data.planner)); 
            count++; 
        }
        if (data.bible && typeof data.bible === 'object') { 
            localStorage.setItem('bible_progress_state', JSON.stringify(data.bible)); 
            count++; 
        }
        if (data.english && typeof data.english === 'object') { 
            localStorage.setItem('english_progress_state', JSON.stringify(data.english)); 
            count++; 
        }
        
        if (count > 0) {
            alert('✅ 데이터 복구가 성공적으로 완료되었습니다! 확인을 누르면 동기화를 재개합니다.');
            location.reload();
        } else {
            alert('⚠️ 해당 코드에 유효한 학습 진도 데이터가 포함되어 있지 않습니다.');
        }
    } catch (e) {
        console.error("JSON Parse Error:", e);
        alert('❌ 올바르지 않은 데이터 형식입니다. 복사한 내용이 전체인지 다시 확인해 주세요.\n(오류 메시지: ' + e.message + ')');
    }
};

window.historyPrevMonth = () => {
    window.currentViewDate.setMonth(window.currentViewDate.getMonth() - 1);
    initDashboard();
};

window.historyNextMonth = () => {
    window.currentViewDate.setMonth(window.currentViewDate.getMonth() + 1);
    initDashboard();
};

window.openFullProgressModal = () => {
    let modal = document.getElementById('full-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'full-progress-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    let contentHtml = '';
    let subjects = ['tax', 'accounting', 'cost_accounting', 'finance'];
    
    subjects.forEach(sKey => {
        let subj = window.subjectData[sKey];
        let color = getPastelColor(sKey);
        contentHtml += `
            <div style="margin-bottom: 2rem;">
                <h3 style="color: ${color}; border-bottom: 2px solid ${color}44; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    ${subj.icon} ${subj.name}
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.5rem; margin-top: 1rem;">
        `;
        
        subj.chapters.forEach(ch => {
            let isComp = engine.isCompleted(ch.id);
            let overrideDate = engine.state.settings.taskDateOverrides ? engine.state.settings.taskDateOverrides[ch.id] : null;
            let overrideHtml = overrideDate ? `
                <div class="override-badge">
                    🗓️ ${overrideDate}로 지정됨
                    <span style="margin-left: 5px; color: #ef4444; font-weight: 800; cursor: pointer;" onclick="event.preventDefault(); window.clearTaskOverride('${ch.id}')" title="날짜 지정 취소 및 순서 자동 복구">✕</span>
                </div>
            ` : '';

            contentHtml += `
                <label class="progress-item-label ${isComp ? 'comp' : ''}">
                    <input type="checkbox" ${isComp ? 'checked' : ''} onchange="window.toggleChapterCompletion('${ch.id}', this.checked)" style="width: 22px; height: 22px; accent-color: ${color}; margin-top: 2px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.95rem; line-height: 1.4; color: ${isComp ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight: ${isComp ? '700' : '500'}">
                            ${ch.title}
                        </span>
                        ${overrideHtml}
                    </div>
                </label>
            `;
        });
        
        contentHtml += `</div></div>`;
    });

    modal.innerHTML = `
        <div style="width: 100%; max-width: 950px; max-height: 88vh; display: flex; flex-direction: column; background: #f8fafc; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,0.4);">
            <div style="padding: 1.8rem 2.5rem; border-bottom: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; background: white;">
                <div>
                    <h3 style="margin: 0; color: var(--text-main); font-size: 1.4rem; font-weight: 800;">📋 전체 학습 진도표</h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.9rem; color: var(--text-muted);">완료 상태를 체크하거나 강제 지정된 날짜를 초기화할 수 있습니다.</p>
                </div>
                <button class="btn btn-secondary" style="border-radius: 12px; padding: 0.7rem 1.2rem;" onclick="document.getElementById('full-progress-modal').style.display='none'; initDashboard();">✕ 닫기</button>
            </div>
            <div style="padding: 2.5rem; overflow-y: auto; background: #f1f5f9; flex: 1;">
                ${contentHtml}
            </div>
            <div style="padding: 1.5rem 2.5rem; background: white; text-align: right; border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-primary" style="background: var(--color-primary); border-radius: 12px; padding: 0.8rem 2rem;" onclick="document.getElementById('full-progress-modal').style.display='none'; initDashboard();">변경 사항 적용 완료</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.clearTaskOverride = (chapterId) => {
    if (engine.state.settings.taskDateOverrides && engine.state.settings.taskDateOverrides[chapterId]) {
        delete engine.state.settings.taskDateOverrides[chapterId];
        engine.saveState();
        engine.generateSchedule();
        window.openFullProgressModal(); // Refresh modal
    }
};

window.toggleChapterCompletion = (chapterId, isChecked) => {
    if (isChecked) {
        // Find chapter info to get ID correctly (it might be numeric)
        let idToMark = isNaN(parseInt(chapterId)) ? chapterId : parseInt(chapterId);
        engine.markCompleted(idToMark, null, null, 'normal');
    } else {
        engine.removeCompletion(chapterId);
    }
};
