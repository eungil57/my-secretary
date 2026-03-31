const engine = new window.StudyEngine();
window.engine = engine;

window.currentScheduleView = 'daily';

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let dateSubtitle = document.getElementById('date-subtitle');
    if (dateSubtitle) dateSubtitle.innerText = today.toLocaleDateString('ko-KR', options);

    initDashboard();

    setTimeout(() => {
        let script = document.createElement('script');
        script.src = 'korean-bible-text.js';
        script.onload = () => {
            if (window.rawBibleJson && !window.bibleTextData?.gen) {
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
});

window.switchTab = (tabId) => {
    document.getElementById('planner-view-section').style.display = tabId === 'planner' ? 'block' : 'none';
    document.getElementById('bible-view-section').style.display = tabId === 'bible' ? 'block' : 'none';
    
    let engSec = document.getElementById('english-view-section');
    if (engSec) engSec.style.display = tabId === 'english' ? 'block' : 'none';
    
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
    document.getElementById('btn-daily').classList.toggle('active-view', view === 'daily');
    document.getElementById('btn-weekly').classList.toggle('active-view', view === 'weekly');
    document.getElementById('btn-monthly').classList.toggle('active-view', view === 'monthly');
    let btnH = document.getElementById('btn-history');
    if (btnH) btnH.classList.toggle('active-view', view === 'history');
    initDashboard();
};

function initDashboard() {
    const hrsDisplay = document.getElementById('current-hours-display');
    if (hrsDisplay) hrsDisplay.innerText = `${engine.state.settings.dailyHours}시간`;

    // 전체 및 과목별 진도율 계산
    let totalChapters = 0;
    let completedChapters = 0;
    let subjectProgressHtml = '';

    for (let subjKey in window.subjectData) {
        let subj = window.subjectData[subjKey];
        let subjTotal = subj.chapters.length;
        let subjCompleted = 0;
        
        for (let ch of subj.chapters) {
            if (engine.isCompleted(ch.id)) subjCompleted++;
        }
        
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
    const todayStr = engine.getTodayStr();
    let daysToRender = 1;

    let html = '';
    let currentDate = new Date(todayStr);
    let viewType = window.currentScheduleView || 'daily';

    if (viewType === 'weekly') {
        daysToRender = 7;
        let day = currentDate.getDay();
        let diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); 
        currentDate.setDate(diff);
    } else if (viewType === 'monthly' || viewType === 'history') {
        currentDate.setDate(1);
        let nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        nextMonth.setDate(nextMonth.getDate() - 1);
        daysToRender = nextMonth.getDate();
    }

    if (viewType === 'daily') {
        let tasks = engine.getScheduleForDate(todayStr);
        if (tasks.length === 0) {
            html += `
                <div class="glass-panel" style="padding: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <h2>🎉 오늘의 일정(또는 주말)이 없습니다!</h2>
                    <p style="color: var(--text-muted); margin-top: 1rem;">주말이거나 모든 일정을 마치셨습니다.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem;">
                        <button class="btn btn-primary" onclick="window.changeDailyTime()">➕ 휴일에 공부 일정 추가하기</button>
                        <button class="btn btn-secondary" onclick="window.setVacationPeriod()">🏖️ 장기 휴식 (방학/병가) 설정</button>
                    </div>
                </div>
            `;
        } else {
            let cardsHtml = tasks.map(t => {
                let color = getPastelColor(t.subjectId);
                let subj = window.subjectData[t.subjectId];
                let prefix = t.isReview ? '[복습] ' : '';
                return `
                    <div class="glass-panel" style="padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; border-left: 6px solid ${color}; border-radius: 12px; margin-bottom: 1rem; background: var(--glass-bg);">
                        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                            <span class="mini-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44; width: fit-content; padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                                ${subj.icon} ${subj.name}
                            </span>
                            ${(() => {
                                let bkmk = (engine.state.bookmarks && engine.state.bookmarks[t.chapter.id]) ? `<span style="display: inline-block; margin-top: 0.2rem; background: #fef3c7; color: #d97706; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.85rem; font-weight: 700; border: 1px solid #fde68a; width: fit-content;">📍 이어서: ${engine.state.bookmarks[t.chapter.id]} 부터</span>` : '';
                                let titleStr = t.chapter.title;
                                let isCustom = t.chapter.id.toString().startsWith('custom_');
                                let titleHtml = isCustom ? 
                                    `<span style="cursor:pointer; border-bottom:1px dashed var(--text-muted);" onclick="window.editCustomTaskTitle('${t.chapter.id}')" title="클릭하여 스케줄 제목 수정">✏️ ${titleStr}</span>` : 
                                    titleStr;
                                return `<span style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); display: flex; flex-direction: column; gap: 0.3rem;">${prefix}${titleHtml} ${bkmk}</span>`;
                            })()}
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem;">
                            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">⏰ ${t.allocated.toFixed(1)}시간</span>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-primary" style="background: ${color}; color: #1e293b; padding: 0.5rem 1rem;" onclick="window.appComplete('${t.chapter.id}', ${t.allocated}, ${t.isReview ? 'true' : 'false'})">✅ 완료</button>
                                <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="window.appPartial('${t.chapter.id}', ${t.allocated})">⏳ 진행중</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            let todayStr = engine.getTodayStr();
            let isOptedInDay = engine.state.settings.extraStudyDays && engine.state.settings.extraStudyDays.includes(todayStr);
            let skipBtnText = isOptedInDay ? '☕ 오늘 수동 추가했던 일정 취소 (휴무로 복귀)' : '⏭️ 오늘 전체 건너뛰기';

            let displayDate = new Date(todayStr).toLocaleDateString('ko-KR', {weekday:'long', month:'long', day:'numeric'});
            
            // AI Pacing Diagnostic Warning Logic for 10-Rotations/Year
            let pacingWarningHtml = '';
            let baseRequired = 0;
            const H_DIFF = { 1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5 };
            for (let k in window.subjectData) {
                window.subjectData[k].chapters.forEach(c => {
                    let h = c.weight !== undefined ? (c.weight * 1.5) : (H_DIFF[c.difficulty] || 2.0);
                    baseRequired += h;
                });
                if (k === 'tax') {
                    // Tax obj questions
                    window.subjectData[k].chapters.forEach(c => {
                        baseRequired += 1.5; // weight 1.0 * 1.5
                    });
                }
            }
            let targetTotalHours = baseRequired * 5; // 5 Rotations Total Hours
            
            let currentDaily = engine.state.settings.dailyHours;
            // Assuming 1 year = 300 active study days roughly on current pace without weekends, or 330 with weekends
            let isFullWeek = engine.state.settings.extraStudyDays && engine.state.settings.extraStudyDays.length > 50; 
            let expectedStudyDays = isFullWeek ? 330 : 250; 
            let currentYearly = currentDaily * expectedStudyDays;
            
            if (currentYearly < targetTotalHours * 0.9 && !engine.state.settings.silencePacingWarning) {
                let targetWeeklyHours = targetTotalHours / 52;
                let currentWeeklyHours = currentDaily * (isFullWeek ? 7 : 5);
                let neededWeeklyBoost = Math.max(0, targetWeeklyHours - currentWeeklyHours).toFixed(1);
                
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
                let minPct = 1.0;
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

                let recommendedFull = (targetTotalHours / expectedStudyDays).toFixed(1);
                
                pacingWarningHtml = `
                    <div class="glass-panel" style="margin-bottom: 2rem; padding: 1.5rem; border-left: 6px solid #ef4444; border-radius: 16px; background: rgba(254, 226, 226, 0.5);">
                        <div style="display: flex; gap: 0.8rem; align-items: flex-start;">
                            <div style="font-size: 1.8rem;">🚨</div>
                            <div style="display: flex; flex-direction: column; gap: 0.8rem; flex: 1;">
                                <h3 style="color: #b91c1c; margin: 0; font-size: 1.15rem;">[AI 스케줄 긴급 진단] 수험 페이스 상향 권고</h3>
                                <p style="color: #991b1b; margin: 0; font-size: 0.95rem; line-height: 1.5;">
                                    현재 일일 <b>${currentDaily}시간</b> 페이스로는 1년 내 합격 최소선인 <b>'전 과목 5회독'</b>(총 ${Math.round(targetTotalHours)}시간 소요 예정) 달성이 시기적으로 어렵습니다. (추세 유지 시 1년 후 약 ${Math.round((currentYearly/targetTotalHours)*100)}% 도달 예상)
                                </p>
                                <div style="padding: 0.8rem 1rem; background: rgba(255,255,255,0.7); border-radius: 8px; border: 1px solid #fecaca; margin-top: 0.2rem;">
                                    <p style="color: #b91c1c; margin: 0; font-size: 0.95rem; line-height: 1.6; font-weight: 600;">💡 AI 맞춤형 행동 지침:</p>
                                    <ul style="color: #991b1b; margin: 0.5rem 0 0 0; padding-left: 1.2rem; font-size: 0.9rem; line-height: 1.5;">
                                        <li>5회독 목표 지표를 지키려면 <b>주당 평균 ${Math.round(targetWeeklyHours)}시간</b>의 거시적 학습이 필수적입니다. 일일 기본 시간을 늘리시거나, 기초 목표치 미달분인 <b>최소 ${neededWeeklyBoost}시간</b>을 이번 주 주말 등 빈 시간에 시급히 추가 배분하십시오.</li>
                                        <li>${targetChaptersText}</li>
                                    </ul>
                                </div>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                                    <button class="btn btn-primary" style="background: #ef4444; color: white; padding: 0.6rem 1rem; flex: 1;" onclick="window.openPacingFlexModal()">🗓️ 내 일정에 맞춰 방금 추천받은 시간 유연하게 추가 배분하기</button>
                                    <button class="btn btn-secondary" style="border: none; background: transparent; color: var(--text-muted); text-decoration: underline;" onclick="window.ignoreAIPacing()">보류 (현재 스케줄러 유지)</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            html += `
                ${pacingWarningHtml}
                <h2 style="margin-bottom: 1.5rem; color: var(--text-main); font-size: 1.3rem;">📅 오늘 (${displayDate}) 할 일</h2>
                <div style="display: flex; flex-direction: column;">
                    ${cardsHtml}
                </div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary glass-panel" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid #bfdbfe;" onclick="window.appCompleteAhead()">🔥 초과 달성 기록</button>
                        <button class="btn btn-primary glass-panel" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #a7f3d0;" onclick="window.openCustomTaskModal()">➕ 추가 일정 스케줄</button>
                        <button class="btn btn-primary glass-panel" style="background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid #c7d2fe;" onclick="window.openPastProgressModal()">🕰️ 과거 진도 입력</button>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary glass-panel" onclick="window.setVacationPeriod()">🏖️ 장기 휴식 설정</button>
                        <button class="btn btn-secondary glass-panel" onclick="window.appSkipDay()">${skipBtnText}</button>
                    </div>
                </div>
            `;
        }
    } else {
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
                        
                        return `<div class="mini-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}; font-weight: 700;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subjInfo.subject.name} - ${subjInfo.chapter.title}">${shortName} - ${titlePart}</span>
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
                        
                        return `<div class="mini-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44; cursor: grab;" draggable="true" ondragstart="window.dragTaskStart(event, '${t.chapter.id}')">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${prefix}${subj.name} - ${t.chapter.title}">${prefix}${shortName} - ${titlePart}</span>
                            <span style="flex-shrink:0; margin-left:4px;">${t.allocated.toFixed(1)}h</span>
                        </div>`;
                    }).join('');
                }
            }
            
            html += `
                <div class="calendar-day" ondragover="event.preventDefault()" ondrop="window.dropTask(event, '${dateStr}')">
                    <div class="calendar-date">${displayDate}</div>
                    <div class="calendar-badges">${badgesHtml}</div>
                </div>
            `;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        html += `</div>`;
    }

    container.innerHTML = html;
}

function findSubjectOfChapter(id) {
    if (engine.state.customTasks) {
        let ct = engine.state.customTasks.find(c => c.id == id);
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

window.appComplete = (chapterId, allocatedHours, isReview) => {
    window.currentCompletingChapter = { id: chapterId, hours: allocatedHours };
    
    // 복습이나 이미 완료된 항목은 난이도 묻지않고 즉시 처리
    if (isReview === true || isReview === 'true') {
        engine.markCompleted(chapterId, null, allocatedHours * 60, 'normal');
        initDashboard();
        return;
    }

    let modal = document.getElementById('feedback-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'feedback-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";

    modal.innerHTML = `
        <div class="glass-panel modal-content" style="width: 100%; max-width: 400px; padding: 2rem; background: var(--bg-main) !important; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom: 0.5rem; text-align: center; color: var(--color-primary)">학습 피드백 제출</h3>
            <p style="text-align: center; color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">
                수고하셨습니다!<br>이 챕터의 체감 난이도를 알려주시면<br>실제 소요 시간과 복습 주기를 AI가 알아서 조율합니다.
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                <button class="btn" style="background: rgba(134,239,172,0.3); color: #166534; padding: 1.2rem; font-size: 1.1rem; border: 1px solid #86efac" onclick="window.submitFeedback('easy')">
                    😆 생각보다 쉬웠어요 (빨리 끝남)
                </button>
                <button class="btn" style="background: rgba(226,232,240,0.5); color: #334155; padding: 1.2rem; font-size: 1.1rem; border: 1px solid #cbd5e1" onclick="window.submitFeedback('normal')">
                    🙂 보통이에요 (예상대로)
                </button>
                <button class="btn" style="background: rgba(252,165,165,0.3); color: #991b1b; padding: 1.2rem; font-size: 1.1rem; border: 1px solid #fca5a5" onclick="window.submitFeedback('hard')">
                    🥵 이해하기 어려웠어요 (오래 걸림)
                </button>
            </div>
            <button class="btn btn-secondary" style="width: 100%; margin-top: 1rem;" onclick="document.getElementById('feedback-modal').style.display='none'">취소</button>
        </div>
    `;
    modal.style.display = 'flex';
};

window.submitFeedback = (feedbackType) => {
    let c = window.currentCompletingChapter;
    let mult = feedbackType === 'easy' ? 0.75 : feedbackType === 'hard' ? 1.3 : 1.0;
    let actualMins = c.hours * mult * 60;
    engine.markCompleted(c.id, null, actualMins, feedbackType);
    document.getElementById('feedback-modal').style.display = 'none';
    initDashboard();
};

window.appPartial = (chapterId, allocatedHours) => {
    let modal = document.getElementById('partial-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'partial-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483647; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    
    modal.innerHTML = `
        <div style="width: 100%; max-width: 450px; display: flex; flex-direction: column; background: var(--bg-main); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <div style="padding: 1.5rem; border-bottom: 2px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7);">
                <h3 style="margin: 0; color: #f59e0b;">⏳ 부분 학습 (오늘 다 못 끝냄)</h3>
                <button style="border: none; background: transparent; cursor: pointer; font-size: 1rem;" onclick="document.getElementById('partial-modal').style.display='none'">✕</button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--glass-bg);">
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0; line-height: 1.4;">
                    한 번에 챕터를 모두 끝내지 못하셨군요!<br>
                    <strong>내일 이어서 편하게 공부할 수 있도록, 무작정 다음 스케줄로 넘기기 전에 오늘 어떤 페이지나 목차에서 끝났는지 짧게 북마크를 적어주세요.</strong><br>
                    메모해두시면 AI가 전체 목차를 모르더라도 내일 일정에 <b>어디서 이어갈지</b> 자동으로 띄워드립니다!
                </p>
                <input type="text" id="partial-bookmark-input" class="form-input" placeholder="어디까지 공부했나요? (예: 167쪽까지, 혹은 공공선택이론)" style="padding: 1rem; font-size: 1.05rem; border-radius: 8px; border: 1px solid #cbd5e1;" onkeypress="if(event.key === 'Enter') window.submitPartial(${chapterId}, ${allocatedHours})">
                <button class="btn btn-primary" style="padding: 1rem; font-size: 1.05rem; margin-top: 0.5rem; background: #f59e0b; color: white; border: none;" onclick="window.submitPartial(${chapterId}, ${allocatedHours})">진행 상태 책갈피 꽂기 📍</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('partial-bookmark-input').focus(), 50);
};

window.submitPartial = (chapterId, allocatedHours) => {
    let bookmark = document.getElementById('partial-bookmark-input').value.trim();
    if (!bookmark) bookmark = '중간 지점';
    
    let actualMins = allocatedHours * 60 * 0.5; // 절반 정도 쓴것으로 임의 기록
    engine.markPartial(chapterId, 50, actualMins, 'normal', bookmark);
    
    document.getElementById('partial-modal').style.display = 'none';
    initDashboard();
};

window.setVacationPeriod = () => {
    let startStr = prompt('휴식/병가를 시작할 첫 날짜를 입력하세요 (예: 2026-03-24):', engine.getTodayStr());
    if (!startStr) return;
    let endStr = prompt('마지막으로 휴식할 날짜를 입력하세요 (예: 2026-03-31):', startStr);
    if (!endStr) return;

    let startDate = new Date(startStr);
    let endDate = new Date(endStr);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
        return;
    }
    
    if (endDate < startDate) {
        alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.');
        return;
    }

    let current = new Date(startDate);
    let addedCount = 0;
    while(current <= endDate) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dtStr = `${y}-${m}-${d}`;
        
        if (!engine.state.skippedDays.includes(dtStr)) {
            engine.state.skippedDays.push(dtStr);
            addedCount++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    if (addedCount > 0) {
        engine.saveState();
        engine.generateSchedule();
        initDashboard();
        alert(`총 ${addedCount}일의 장기 휴식(휴무) 기간이 성공적으로 설정되었습니다. 스케줄이 자동으로 뒤로 연기되었습니다!`);
    } else {
        alert('해당 기간은 이미 모두 휴무일로 설정되어 있습니다.');
    }
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
    
    // Create a temporary textarea to show and copy
    let modal = document.getElementById('export-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'export-modal';
        document.body.appendChild(modal);
    }
    modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; justify-content: center; align-items: center; padding: 1.5rem; box-sizing: border-box;";
    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2rem; background: white; border-radius: 16px;">
            <h3 style="margin-bottom: 1rem; color: var(--color-primary);">💾 데이터 백업 (복사하기)</h3>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">아래 코드를 전체 복사하여 보관하거나, 동기화하려는 다른 기기(또는 깃허브 주소)의 '데이터 복구' 메뉴에 붙여넣으세요.</p>
            <textarea id="export-text" style="width: 100%; height: 200px; padding: 1rem; border-radius: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 0.8rem; margin-bottom: 1rem;" readonly>${json}</textarea>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" style="flex: 1;" onclick="document.getElementById('export-text').select(); document.execCommand('copy'); alert('복사되었습니다!')">전체 복사하기</button>
                <button class="btn btn-secondary" onclick="document.getElementById('export-modal').style.display='none'">닫기</button>
            </div>
        </div>
    `;
};

window.importData = () => {
    const input = prompt('백업받은 데이터(JSON 코드)를 여기에 붙여넣어 주세요.\n(경고: 현재 기기의 모든 데이터가 덮어씌워집니다!)');
    if (!input) return;
    
    try {
        const data = JSON.parse(input);
        let count = 0;
        if (data.planner && Object.keys(data.planner).length > 0) { localStorage.setItem('study_planner_state', JSON.stringify(data.planner)); count++; }
        if (data.bible && Object.keys(data.bible).length > 0) { localStorage.setItem('bible_progress_state', JSON.stringify(data.bible)); count++; }
        if (data.english && Object.keys(data.english).length > 0) { localStorage.setItem('english_progress_state', JSON.stringify(data.english)); count++; }
        
        if (count > 0) {
            alert('데이터 복구가 완료되었습니다! 페이지를 새로고침하여 동기화를 시작합니다.');
            location.reload();
        } else {
            alert('가져올 유효한 데이터가 없습니다.');
        }
    } catch (e) {
        alert('올바르지 않은 데이터 형식입니다. 다시 확인해 주세요.\n' + e.message);
    }
};
