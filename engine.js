// global window.subjectData used

const HOURS_PER_DIFF = {
    1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5
};

window.KOREAN_HOLIDAYS = [
    '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // Seollal 2024
    '2024-09-16', '2024-09-17', '2024-09-18', // Chuseok 2024
    '2025-01-28', '2025-01-29', '2025-01-30', // Seollal 2025
    '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // Chuseok 2025
    '2026-02-16', '2026-02-17', '2026-02-18', // Seollal 2026
    '2026-09-24', '2026-09-25', '2026-09-26', // Chuseok 2026
    '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', // Seollal 2027
    '2027-09-14', '2027-09-15', '2027-09-16', // Chuseok 2027
    '2028-01-26', '2028-01-27', '2028-01-28', // Seollal 2028
    '2028-10-02', '2028-10-03', '2028-10-04', '2028-10-05', // Chuseok 2028
    '2029-02-12', '2029-02-13', '2029-02-14', // Seollal 2029
    '2029-09-21', '2029-09-22', '2029-09-23', '2029-09-24'  // Chuseok 2029
];

window.StudyEngine = class {
    constructor() {
        window.engine = this;
        this.loadState();
        // 항상 최신 5시간 옵션으로 당일 일정을 강제 재구성
        this.generateSchedule();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('study_planner_state');
            if (saved) {
                this.state = JSON.parse(saved);
                if (this.state && this.state.settings) {
                    if (this.state.settings.dailyHours === 6.5 || this.state.settings.dailyHours === 5.0) {
                        this.state.settings.dailyHours = 5.5; 
                    }
                }
            } else {
                this.state = {
                    settings: {
                        dailyHours: 5.5, 
                        startDate: this.getTodayStr(),
                    },
                    progress: {},
                    schedule: {},
                    skippedDays: [],
                    dailySpent: {}
                };
                this.saveState();
            }
        } catch (e) {
            console.error("Local load failed, resetting...", e);
            this.state = {
                settings: { dailyHours: 5.5, startDate: this.getTodayStr() },
                progress: {},
                schedule: {},
                skippedDays: [],
                dailySpent: {}
            };
        }
        
        // Ensure sub-objects exist
        if (!this.state) this.state = {};
        if (!this.state.settings) this.state.settings = { dailyHours: 5.5, startDate: this.getTodayStr() };
        if (!this.state.progress) this.state.progress = {};
        if (!this.state.schedule) this.state.schedule = {};
        if (!this.state.skippedDays) this.state.skippedDays = [];
        if (!this.state.dailySpent) this.state.dailySpent = {};
        if (!this.state.customTasks) this.state.customTasks = [];
        if (!this.state.bookmarks) this.state.bookmarks = {};
        if (!this.state.settings.taskHoursOverrides) this.state.settings.taskHoursOverrides = {};
    }

    saveState(skipTimestamp = false) {
        if (!skipTimestamp) this.state.lastUpdated = Date.now();
        localStorage.setItem('study_planner_state', JSON.stringify(this.state));
        // FIX for Sync Loop: Only upload if this is a fresh local change (not a remote sync ack)
        if (!skipTimestamp && window.firebaseSync && window.firebaseSync.savePlanner) {
            window.firebaseSync.savePlanner(this.state);
        }
    }

    getTodayStr() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getNeededHours(chapterId, difficulty) {
        let base = HOURS_PER_DIFF[difficulty] || 2.0;
        let prog = this.state.progress[chapterId];
        if (prog && prog.status === 'partial') {
            return base * (1 - prog.ratio);
        }
        return base;
    }

    isCompleted(chapterId) {
        const idStr = String(chapterId);
        // Check if it's completed or has been partially done in our scheduling loop
        const p = this.state.progress[idStr];
        return p && p.status === 'completed';
    }

    checkDelays() {
        let todayStr = this.getTodayStr();
        if (!this.state.lastDelayCheck) {
            this.state.lastDelayCheck = todayStr;
            return;
        }

        if (this.state.lastDelayCheck < todayStr) {
            if (!this.state.chapterMultipliers) this.state.chapterMultipliers = {};
            
            let pastTasks = this.state.schedule[this.state.lastDelayCheck] || [];
            let updated = false;
            
            for (let t of pastTasks) {
                if (!t.isReview) {
                    if (!this.isCompleted(t.chapter.id)) {
                        let mult = this.state.chapterMultipliers[t.chapter.id] || 1.0;
                        this.state.chapterMultipliers[t.chapter.id] = Math.min(2.5, mult * 1.15); 
                        updated = true;
                    }
                }
            }
            this.state.lastDelayCheck = todayStr;
            if (updated) this.saveState();
        }
    }

    isKoreanHoliday(dateStr) {
        return KOREAN_HOLIDAYS.includes(dateStr);
    }

    generateSchedule() {
        try {
            this.checkDelays();
            let currentDate = new Date(this.state.settings.startDate);
        const today = new Date(this.getTodayStr());
        if (currentDate < today) currentDate = today;

        let pending = {
            tax: [],
            accounting: [...window.subjectData.accounting.chapters].filter(c => !this.isCompleted(c.id)),
            cost_accounting: [...window.subjectData.cost_accounting.chapters].filter(c => !this.isCompleted(c.id)),
            finance: [...window.subjectData.finance.chapters].filter(c => !this.isCompleted(c.id)),
        };

        for (let c of window.subjectData.tax.chapters) {
            if (!this.isCompleted(c.id)) {
                pending.tax.push(c);
            }
        }

        if (this.state.customTasks) {
            let pendingCustom = this.state.customTasks.filter(ct => !this.isCompleted(ct.id));
            pendingCustom.reverse().forEach(ct => {
                pending[ct.subjectId].unshift(ct);
            });
        }

        const newSchedule = {};
        const todayStrForCount = this.getTodayStr();
        
        let completedTodayPerSubj = { tax: 0, accounting: 0, cost_accounting: 0, finance: 0 };
        for (let k in this.state.progress) {
            let p = this.state.progress[k];
            if (p.status === 'completed' && p.completedAt === todayStrForCount) {
                for (let subjKey in window.subjectData) {
                    if (window.subjectData[subjKey].chapters.find(c => c.id == k)) {
                        completedTodayPerSubj[subjKey]++;
                    }
                }
                if (this.state.customTasks) {
                    let ct = this.state.customTasks.find(c => c.id == k);
                    if (ct) completedTodayPerSubj[ct.subjectId]++;
                }
            }
        }

        let deferredTasks = {};
        let needsSave = false;
        if (this.state.settings.taskDateOverrides) {
            for (let chId in this.state.settings.taskDateOverrides) {
                let ov = this.state.settings.taskDateOverrides[chId];
                if (Array.isArray(ov)) {
                    let uniqueOv = [...new Set(ov)];
                    if (uniqueOv.length !== ov.length) {
                        ov = uniqueOv;
                        this.state.settings.taskDateOverrides[chId] = uniqueOv;
                        needsSave = true;
                    }
                    
                    if (!this.isCompleted(chId)) {
                        // USER REQUEST: Missed overrides should be pushed to today instead of disappearing into natural flow.
                        let newOv = [];
                        let changed = false;
                        ov.forEach(d => {
                            if (d < todayStrForCount) {
                                // Push missed override to today
                                newOv.push(todayStrForCount);
                                changed = true;
                            } else {
                                newOv.push(d);
                            }
                        });
                        if (changed) {
                            if (newOv.length > 0) {
                                this.state.settings.taskDateOverrides[chId] = [...new Set(newOv)];
                            } else {
                                delete this.state.settings.taskDateOverrides[chId];
                            }
                            needsSave = true;
                        }
                    } else {
                        delete this.state.settings.taskDateOverrides[chId];
                        needsSave = true;
                    }
                } else {
                    if (this.isCompleted(chId)) {
                        delete this.state.settings.taskDateOverrides[chId];
                        needsSave = true;
                    } else if (this.state.settings.taskDateOverrides[chId] < todayStrForCount) {
                        // USER REQUEST: Missed override should be pushed to today
                        this.state.settings.taskDateOverrides[chId] = todayStrForCount;
                        needsSave = true;
                    }
                }
            }
        }
        
        if (this.state.settings.reviewDateOverrides) {
            for (let chId in this.state.settings.reviewDateOverrides) {
                for (let offset in this.state.settings.reviewDateOverrides[chId]) {
                    if (this.state.settings.reviewDateOverrides[chId][offset] < todayStrForCount) {
                        delete this.state.settings.reviewDateOverrides[chId][offset];
                        needsSave = true;
                    }
                }
            }
        }
        
        for (let sub in pending) {
            let regular = [];
            for (let ch of pending[sub]) {
                let overrideDate = (this.state.settings.taskDateOverrides || {})[ch.id];
                if (overrideDate) {
                    if (Array.isArray(overrideDate)) {
                        for (let d of overrideDate) {
                            if (!deferredTasks[d]) deferredTasks[d] = [];
                            deferredTasks[d].push({ sub, chapter: ch });
                        }
                    } else {
                        if (!deferredTasks[overrideDate]) deferredTasks[overrideDate] = [];
                        deferredTasks[overrideDate].push({ sub, chapter: ch });
                    }
                } else {
                    regular.push(ch);
                }
            }
            pending[sub] = regular;
        }
        if (needsSave) {
            this.saveState(true);
        }

        let subjectProgressPct = {};
        let maxPct = 0;
        for (let s in window.subjectData) {
            let subj = window.subjectData[s];
            let total = subj.chapters.length;
            let comp = subj.chapters.filter(c => this.isCompleted(c.id)).length;
            subjectProgressPct[s] = total > 0 ? (comp / total) : 0;
            if (subjectProgressPct[s] > maxPct) maxPct = subjectProgressPct[s];
        }

        let cycle = 0;

        let trackingCompleted = {}; 
        window.__projectedReviewTiers = {};
        
        let subjectLastStudied = { tax: '', accounting: '', cost_accounting: '', finance: '' };
        for (let k in this.state.progress) {
            let p = this.state.progress[k];
            if (p.status === 'completed' && p.completedAt) {
                let subjK = null;
                for (let subjKey in window.subjectData) {
                    if (window.subjectData[subjKey].chapters.find(c => String(c.id) === String(k))) {
                        subjK = subjKey; break;
                    }
                }
                if (!subjK && this.state.customTasks) {
                    let ct = this.state.customTasks.find(c => String(c.id) === String(k));
                    if (ct) subjK = ct.subjectId;
                }
                if (!subjK && String(k).endsWith('_obj')) subjK = 'tax';
                
                if (subjK && p.completedAt > subjectLastStudied[subjK]) {
                    subjectLastStudied[subjK] = p.completedAt;
                }
            }
        }
        
        // USER REQUEST: STRICT 2-SLOT ALTERNATING ROTATION
        // Slot 1: cost_accounting <-> finance
        // Slot 2: accounting <-> tax
        let s1a = 'cost_accounting', s1b = 'finance';
        let s2a = 'accounting', s2b = 'tax';
        
        let next1 = s1a;
        if (subjectLastStudied[s1a] > subjectLastStudied[s1b]) next1 = s1b;
        else if (subjectLastStudied[s1b] > subjectLastStudied[s1a]) next1 = s1a;
        
        let next2 = s2a;
        if (subjectLastStudied[s2a] > subjectLastStudied[s2b]) next2 = s2b;
        else if (subjectLastStudied[s2b] > subjectLastStudied[s2a]) next2 = s2a;

        let activeQueue = [next1, next2];
        if (activeQueue[0] === s1a) activeQueue.push(s1b); else if (activeQueue[0] === s1b) activeQueue.push(s1a);
        if (activeQueue[1] === s2a) activeQueue.push(s2b); else if (activeQueue[1] === s2b) activeQueue.push(s2a);

        // STRUCTURAL FIX: Carry over missed subjects from yesterday
        // Look at yesterday's saved schedule. If a subject was scheduled but not actually studied yesterday,
        // it means the user missed it. Put it at the front of the queue today so it carries over and pushes other subjects back.
        let yesterdayForInit = new Date(todayStrForCount);
        yesterdayForInit.setDate(yesterdayForInit.getDate() - 1);
        let yInitStr = `${yesterdayForInit.getFullYear()}-${String(yesterdayForInit.getMonth()+1).padStart(2,'0')}-${String(yesterdayForInit.getDate()).padStart(2,'0')}`;
        
        let missedYesterdaySubjs = [];
        if (this.state.schedule && this.state.schedule[yInitStr]) {
            let scheduledYesterday = this.state.schedule[yInitStr].filter(t => !t.isReview).map(t => t.subjectId);
            scheduledYesterday = [...new Set(scheduledYesterday)];
            
            for (let subj of scheduledYesterday) {
                // Was it completed yesterday?
                let compY = false;
                for (let k in this.state.progress) {
                    let p = this.state.progress[k];
                    if ((p.status === 'completed' || p.status === 'partial') && p.completedAt === yInitStr) {
                        let subjK = null;
                        for (let sKey in window.subjectData) {
                            if (window.subjectData[sKey].chapters.find(c => String(c.id) === String(k))) subjK = sKey;
                        }
                        if (!subjK && String(k).endsWith('_obj')) subjK = 'tax';
                        if (subjK === subj) compY = true;
                    }
                }
                if (this.state.historyMarkers && this.state.historyMarkers[yInitStr]) {
                    for (let chId in this.state.historyMarkers[yInitStr]) {
                        if (this.state.historyMarkers[yInitStr][chId] === 'O' || this.state.historyMarkers[yInitStr][chId] === '△') {
                            let subjK = null;
                            for (let sKey in window.subjectData) {
                                if (window.subjectData[sKey].chapters.find(c => String(c.id) === String(chId))) subjK = sKey;
                            }
                            if (!subjK && String(chId).endsWith('_obj')) subjK = 'tax';
                            if (subjK === subj) compY = true;
                        }
                    }
                }
                
                if (!compY) {
                    missedYesterdaySubjs.push(subj);
                }
            }
        }
        
        // Put missed subjects at the front of the activeQueue so they are picked FIRST today!
        if (missedYesterdaySubjs.length > 0) {
            missedYesterdaySubjs.reverse().forEach(s => {
                let idx = activeQueue.indexOf(s);
                if (idx > -1) activeQueue.splice(idx, 1);
                activeQueue.unshift(s);
            });
        }

        // TEMPORARY BRIDGE: Override any corrupted past state for today specifically.
        if (todayStrForCount === '2026-04-24') {
            activeQueue = ['finance', 'accounting', 'cost_accounting', 'tax'];
        }



        while(pending.tax.length > 0 || pending.accounting.length > 0 || pending.cost_accounting.length > 0 || pending.finance.length > 0) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            let wday = currentDate.getDay(); 
            if (this.state.skippedDays.includes(dateStr) || window.KOREAN_HOLIDAYS.includes(dateStr) || wday === 0 || wday === 6) {
                if (this.state.skippedDays.includes(dateStr) || window.KOREAN_HOLIDAYS.includes(dateStr)) {
                    if (deferredTasks[dateStr]) {
                        let nextDate = new Date(currentDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                        let ndStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
                        if (!deferredTasks[ndStr]) deferredTasks[ndStr] = [];
                        deferredTasks[ndStr].push(...deferredTasks[dateStr]);
                        delete deferredTasks[dateStr];
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue; // Skip if explicitly skipped by user or holiday
                }
                if (!this.state.settings.extraStudyDays || !this.state.settings.extraStudyDays.includes(dateStr)) {
                    if (deferredTasks[dateStr]) {
                        let nextDate = new Date(currentDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                        let ndStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
                        if (!deferredTasks[ndStr]) deferredTasks[ndStr] = [];
                        deferredTasks[ndStr].push(...deferredTasks[dateStr]);
                        delete deferredTasks[dateStr];
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue; // Skip weekend unless opted in
                }
            }
            
            let baseHours = this.state.settings.dailyHours;
            if (this.state.settings.dailyOverrides && this.state.settings.dailyOverrides[dateStr]) {
                baseHours = this.state.settings.dailyOverrides[dateStr];
            }

            let dailyPlayed = this.state.dailySpent[dateStr] || 0;
            let effectiveBaseHours = Math.max(0, baseHours - dailyPlayed);
            
            // If effective hours is extremely small, don't schedule new heavy tasks, but reviews can still fit if needed.
            let dailyHoursLeft = effectiveBaseHours;
            newSchedule[dateStr] = [];
            
            let subjectsWithDeferredToday = [];
            let deferredSpillover = [];
            let tempMaxSubj = (baseHours >= 6.0) ? 3 : 2;

            if (deferredTasks[dateStr]) {
                for (let dt of deferredTasks[dateStr]) {
                    if (!dt.chapter || !dt.chapter.id) continue;
                    
                    let isExplicitOverride = false;
                    let ov = (this.state.settings.taskDateOverrides || {})[dt.chapter.id];
                    if (ov) {
                        if (Array.isArray(ov) && ov.includes(dateStr)) isExplicitOverride = true;
                        else if (ov === dateStr) isExplicitOverride = true;
                    }

                    if (!subjectsWithDeferredToday.includes(dt.sub)) {
                        let conflict = false;
                        if (effectiveBaseHours < 8.0 && subjectsWithDeferredToday.length > 0) {
                            if ((dt.sub === 'accounting' && subjectsWithDeferredToday.includes('tax')) || 
                                (dt.sub === 'tax' && subjectsWithDeferredToday.includes('accounting'))) {
                                conflict = true;
                            }
                        }
                        
                        if (!isExplicitOverride && (conflict || subjectsWithDeferredToday.length >= tempMaxSubj)) {
                            deferredSpillover.push(dt);
                            continue;
                        }
                        subjectsWithDeferredToday.push(dt.sub);
                    }
                    
                    let multipliers = this.state.chapterMultipliers || {};
                    let mult = parseFloat(multipliers[dt.chapter.id] || 1.0);
                    let baseH = dt.chapter.weight !== undefined ? (dt.chapter.weight * 1.5) : (HOURS_PER_DIFF[dt.chapter.difficulty] || 2.0);
                    if (dt.sub === 'tax') baseH *= 2.0;

                    let required = baseH * mult;
                    
                    if (trackingCompleted[dt.chapter.id]) {
                        if (typeof trackingCompleted[dt.chapter.id] !== 'object') {
                            continue; // Chapter already fully completed earlier in simulation
                        }
                        required = trackingCompleted[dt.chapter.id].remaining;
                    } else if (this.state.progress[dt.chapter.id] && this.state.progress[dt.chapter.id].status === 'partial') {
                        required = required * (1 - this.state.progress[dt.chapter.id].ratio);
                    }
                    
                    if (required <= 0.05) continue;
                    
                    let customH = (this.state.settings.taskHoursOverrides && this.state.settings.taskHoursOverrides[dateStr] && this.state.settings.taskHoursOverrides[dateStr][dt.chapter.id]);
                    let canDo;
                    if (customH !== undefined) {
                        canDo = Math.min(required, customH);
                    } else {
                        let taskLimit = (dt.sub === 'tax') ? 4.0 : 3.0;
                        if (isExplicitOverride) {
                            canDo = Math.min(required, taskLimit); // Bypass effectiveBaseHours but still cap at 3 or 4 hrs!
                        } else {
                            canDo = Math.min(required, taskLimit, effectiveBaseHours); 
                        }
                    }
                    
                    if (!isExplicitOverride && effectiveBaseHours <= 0.05) {
                        deferredSpillover.push(dt);
                        continue;
                    }
                    
                    let scheduledForThisSubjToday = (newSchedule[dateStr] || []).filter(t => t.subjectId === dt.sub && !t.isReview).length;
                    if (!isExplicitOverride && canDo < required && scheduledForThisSubjToday > 0) {
                        deferredSpillover.push(dt);
                        continue;
                    } else if (!isExplicitOverride && canDo <= 0.5 && required > 0.5 && customH === undefined) {
                        deferredSpillover.push(dt);
                        continue;
                    }
                    
                    if (!newSchedule[dateStr]) newSchedule[dateStr] = [];
                    newSchedule[dateStr].push({
                        subjectId: dt.sub,
                        chapter: dt.chapter,
                        allocated: canDo, 
                        isReview: false
                    });
                    
                    let remaining = required - canDo;
                    if (remaining > 0.05) {
                        trackingCompleted[dt.chapter.id] = { remaining: remaining, lastDate: dateStr };
                        let pArr = pending[dt.sub];
                        if (!pArr.some(c => c.id === dt.chapter.id)) {
                            pArr.unshift(dt.chapter);
                        }
                    } else {
                        trackingCompleted[dt.chapter.id] = new Date(dateStr).getTime();
                    }
                    effectiveBaseHours -= canDo;
                }
            }
            
            if (deferredSpillover.length > 0) {
                let nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() + 1);
                let ndStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
                if (!deferredTasks[ndStr]) deferredTasks[ndStr] = [];
                deferredTasks[ndStr].push(...deferredSpillover);
            }
            
            // Move subjects already studied today (via overrides) to back of queue
            subjectsWithDeferredToday.forEach(s => {
                let idx = activeQueue.indexOf(s);
                if (idx > -1) {
                    activeQueue.splice(idx, 1);
                    activeQueue.push(s);
                }
            });

            // Identify subjects with deferred tasks in the FUTURE relative to this date
            let subjectsWithFutureDeferred = [];
            for (let futureDate in deferredTasks) {
                if (futureDate > dateStr) {
                    for (let dt of deferredTasks[futureDate]) {
                        if (!subjectsWithFutureDeferred.includes(dt.sub)) subjectsWithFutureDeferred.push(dt.sub);
                    }
                }
            }

            let maxSubjectsNum = 2;
            if (baseHours >= 6.0) maxSubjectsNum = 3;
            else if (baseHours < 3.0) maxSubjectsNum = 1;
            
            if (effectiveBaseHours < 1.0) maxSubjectsNum = 0;

            let alreadyStudiedSubjsToday = [];
            if (dateStr === todayStrForCount) {
                for (let k in completedTodayPerSubj) {
                    if (completedTodayPerSubj[k] > 0) alreadyStudiedSubjsToday.push(k);
                }
            }
            
            activeQueue = activeQueue.filter(k => pending[k].length > 0);
            
            let todaysSubjects = [];
            let unpicked = [];
            let allowedAttempts = activeQueue.length;
            
            let uniqueTodaySubjs = () => {
                let s = new Set([...todaysSubjects, ...subjectsWithDeferredToday]);
                alreadyStudiedSubjsToday.forEach(x => s.add(x));
                return s.size;
            };

            while(activeQueue.length > 0 && uniqueTodaySubjs() < maxSubjectsNum && (todaysSubjects.length + unpicked.length) < allowedAttempts) {
                let candidate = activeQueue.shift();
                
                // USER REQUEST: Don't automatically add next chapters for subjects with today's or future overrides
                if (subjectsWithDeferredToday.includes(candidate) || subjectsWithFutureDeferred.includes(candidate)) {
                    unpicked.push(candidate);
                    continue;
                }

                let conflict = false;
                // Check against current picks AND deferred tasks for the day
                let allTodaySubjs = [...todaysSubjects, ...subjectsWithDeferredToday];
                
                // Track if studied yesterday
                let yesterdayStr = new Date(currentDate);
                yesterdayStr.setDate(yesterdayStr.getDate() - 1);
                let yStr = `${yesterdayStr.getFullYear()}-${String(yesterdayStr.getMonth()+1).padStart(2,'0')}-${String(yesterdayStr.getDate()).padStart(2,'0')}`;
                
                // Smart Rotation removed: Let the activeQueue strictly handle the alternation.
                // User Request: 8.0h threshold for bundling tax/accounting
                if (effectiveBaseHours < 8.0 && allTodaySubjs.length > 0) {
                    if ((candidate === 'accounting' && allTodaySubjs.includes('tax')) || 
                        (candidate === 'tax' && allTodaySubjs.includes('accounting'))) {
                        conflict = true;
                    }
                }
                
                if (conflict) {
                    unpicked.push(candidate);
                } else {
                    todaysSubjects.push(candidate);
                }
            }
            
            // Put picked subjects at the back of the queue (resting)
            todaysSubjects.forEach(s => activeQueue.push(s));
            // Put conflicting/unpicked subjects at the very front so they get priority tomorrow!
            unpicked.reverse().forEach(s => activeQueue.unshift(s));
            
            let subjectWeights = { 'tax': 1.5, 'accounting': 1.5, 'cost_accounting': 1.0, 'finance': 1.0 };
            todaysSubjects.forEach(s => {
                let lag = maxPct - (subjectProgressPct[s] || 0);
                if (lag > 0.05) subjectWeights[s] += (lag * 3.5);
            });
            let totalWeight = todaysSubjects.reduce((sum, s) => sum + (subjectWeights[s] || 1.0), 0);
            
            let subjectBuckets = {};
            if (totalWeight > 0) {
                todaysSubjects.forEach(s => {
                    let w = subjectWeights[s] || 1.0;
                    subjectBuckets[s] = effectiveBaseHours * (w / totalWeight);
                });
            } else {
                todaysSubjects.forEach(s => {
                    subjectBuckets[s] = 0;
                });
            }
            
            // USER REQUEST: DRAG&DROP OVERRIDES FOR REVIEWS FIRST
            let overridingReviews = [];
            let overrides = this.state.settings.taskDateOverrides || {};
            for (let subjKey in window.subjectData) {
                if (!window.subjectData[subjKey]) continue;
                for (let ch of window.subjectData[subjKey].chapters) {
                    if (overrides[ch.id] === dateStr && this.isCompleted(ch.id)) {
                        let p = this.state.progress[ch.id];
                        let fb = p && p.feedback ? p.feedback : 'normal';
                        let fbMult = (fb === 'hard' ? 1.5 : (fb === 'easy' ? 0.7 : 1.0));
                        overridingReviews.push({ subjKey, ch, dur: 0.5 * fbMult, diffDays: '지정' });
                    }
                }
            }

            let reviewReservedTime = 0;
            let availableReviewsToday = [...overridingReviews];
            
            if (baseHours >= 3.0) {
                // ELIGIBILITY: All subjects that have any progress are eligible for reviews.
                // But prioritize subjects that are also in 'todaysSubjects' (progressing today).
                let eligibleSubjs = Object.keys(window.subjectData).filter(s => {
                    let hasProgress = Object.keys(this.state.progress).some(chId => {
                        let chObj = findSubjectOfChapter(chId);
                        return chObj && chObj.subjKey === s && this.state.progress[chId].status === 'completed';
                    });
                    return hasProgress;
                });

                if (eligibleSubjs.length > 0) {
                    const reviewTiers = { 14: 0.4, 30: 0.3 };
                    const reviewDays = Object.keys(reviewTiers).map(Number);
                    let currentDayTs = new Date(dateStr).getTime();
                    
                    // DIAGNOSTIC HOOK (v18)
                    if (dateStr === this.getTodayStr()) {
                        window.__rev_debug = `Today StudySubjs: ${eligibleSubjs.length}`;
                    }
                    
                    // Prioritize reviews for subjects we are actually studying progress for today
                    eligibleSubjs.sort((a, b) => {
                        let aInToday = (todaysSubjects.includes(a) || subjectsWithDeferredToday.includes(a)) ? 1 : 0;
                        let bInToday = (todaysSubjects.includes(b) || subjectsWithDeferredToday.includes(b)) ? 1 : 0;
                        return bInToday - aInToday;
                    });
                    
                    for (let subjKey of eligibleSubjs) {
                        let subj = window.subjectData[subjKey];
                        if (!subj) continue;
                        for (let ch of subj.chapters) {
                            if (overrides[ch.id] === dateStr) continue; // Already handled as override
                            
                            let p = this.state.progress[ch.id];
                            let compTime = null;
                            if (p && p.status === 'completed' && p.completedAt) {
                                compTime = new Date(p.completedAt + 'T00:00:00').getTime();
                            } else if (trackingCompleted[ch.id] && typeof trackingCompleted[ch.id] === 'number') {
                                if (trackingCompleted[ch.id] < currentDayTs) compTime = trackingCompleted[ch.id];
                            }
                            
                            if (compTime) {
                                let diffTime = currentDayTs - compTime;
                                let diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                                
                                // User explicitly requested that reviews MUST only appear when the subject is actively being studied that day.
                                // If the subject is not active today, we wait (defer the review).
                                let isStudyingToday = todaysSubjects.includes(subjKey) || subjectsWithDeferredToday.includes(subjKey);
                                if (!isStudyingToday) {
                                    continue;
                                }

                                // Find the FIRST uncompleted review tier that is due
                                let targetTier = null;
                                for (let d of reviewDays) {
                                    if (diffDays >= d) {
                                        if (!p.completedReviews || !p.completedReviews.includes(d)) {
                                            targetTier = d;
                                            break;
                                        }
                                    }
                                }
                                
                                if (targetTier) {
                                    // Ensure we haven't already scheduled this tier (or a higher one) for this chapter in the projection
                                    if (!window.__projectedReviewTiers) window.__projectedReviewTiers = {};
                                    let highestScheduledTier = window.__projectedReviewTiers[ch.id] || 0;
                                    
                                    if (targetTier > highestScheduledTier) {
                                        let isOverridden = false;
                                        if (this.state.settings.reviewDateOverrides && this.state.settings.reviewDateOverrides[ch.id] && this.state.settings.reviewDateOverrides[ch.id][targetTier]) {
                                            let targetDate = this.state.settings.reviewDateOverrides[ch.id][targetTier];
                                            if (targetDate !== dateStr) {
                                                continue; // Skip it today, it belongs to another date!
                                            } else {
                                                isOverridden = true; // It belongs to today!
                                            }
                                        }

                                        // This is the FIRST time we are evaluating a valid subject day for this required tier!
                                        // Mark it projected as scheduled.
                                        window.__projectedReviewTiers[ch.id] = targetTier;
                                        
                                        let fb = p && p.feedback ? p.feedback : 'normal';
                                        let fbMult = (fb === 'hard' ? 1.5 : (fb === 'easy' ? 0.7 : 1.0));
                                        
                                        // Feature: Scale review time by actual time spent during 1st pass
                                        let timeRatio = 1.0;
                                        if (p && p.spentHours > 0) {
                                            let baseH = ch.weight !== undefined ? (ch.weight * 1.5) : (HOURS_PER_DIFF[ch.difficulty] || 2.0);
                                            if (subjKey === 'tax') baseH *= 2.0;
                                            timeRatio = p.spentHours / baseH;
                                            // Cap the ratio between 0.5x and 2.5x
                                            timeRatio = Math.max(0.5, Math.min(timeRatio, 2.5));
                                        }
                                        
                                        let dur = (reviewTiers[targetTier] || 0.5) * fbMult * timeRatio;
                                        
                                        if (isOverridden) {
                                            overridingReviews.push({ subjKey, ch, dur, diffDays: targetTier });
                                        } else {
                                            availableReviewsToday.push({ subjKey, ch, dur, diffDays: targetTier });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    let heavySubjs = ['tax', 'accounting'];
                    
                    if (dateStr === this.getTodayStr()) {
                        let fullPool = [...availableReviewsToday];
                        fullPool.sort((a,b) => {
                            let wA = heavySubjs.includes(a.subjKey) ? 2 : 1;
                            let wB = heavySubjs.includes(b.subjKey) ? 2 : 1;
                            if (wA !== wB) return wB - wA;
                            let dA = a.diffDays === '지정' ? 0 : a.diffDays;
                            let dB = b.diffDays === '지정' ? 0 : b.diffDays;
                            return dA - dB;
                        });
                        this.state.todayAllDueReviews = fullPool;
                    }
                    
                    let explicitlySelected = this.state.settings.selectedReviews && this.state.settings.selectedReviews[dateStr];
                    
                    if (explicitlySelected && Array.isArray(explicitlySelected)) {
                        let selectedWithOverrides = availableReviewsToday.filter(r => explicitlySelected.includes(String(r.ch.id)) || r.diffDays === '지정');
                        let uniqueSel = [];
                        selectedWithOverrides.forEach(r => { if(!uniqueSel.some(u=>u.ch.id===r.ch.id)) uniqueSel.push(r); });
                        availableReviewsToday = uniqueSel;
                    } else {
                        let targetReviewCount = 3 + ((this.state.settings.extraReviews && this.state.settings.extraReviews[dateStr]) || 0);
                        
                        let heavyPool = availableReviewsToday.filter(r => heavySubjs.includes(r.subjKey) && r.diffDays !== '지정');
                        let lightPool = availableReviewsToday.filter(r => !heavySubjs.includes(r.subjKey) && r.diffDays !== '지정');
                        
                        let sFn = (a,b) => a.diffDays - b.diffDays;
                        heavyPool.sort(sFn);
                        lightPool.sort(sFn);
                        
                        let finalSelection = [...overridingReviews];
                        while(finalSelection.length < targetReviewCount + overridingReviews.length && (heavyPool.length > 0 || lightPool.length > 0)) {
                            let remainder = (finalSelection.length - overridingReviews.length) % 3;
                            if (remainder < 2) {
                                if (heavyPool.length > 0) finalSelection.push(heavyPool.shift());
                                else if (lightPool.length > 0) finalSelection.push(lightPool.shift());
                            } else {
                                if (lightPool.length > 0) finalSelection.push(lightPool.shift());
                                else if (heavyPool.length > 0) finalSelection.push(heavyPool.shift());
                            }
                        }
                        availableReviewsToday = finalSelection;
                    }
                    
                }
            }
            // Cap review reservation to 35% of daily hours to keep progress as priority
            reviewReservedTime = Math.min(availableReviewsToday.reduce((sum, r) => sum + r.dur, 0), baseHours * 0.35);

            let progressEffectiveHours = effectiveBaseHours - reviewReservedTime;
            
            if (effectiveBaseHours > 0) {
                let ratio = progressEffectiveHours / effectiveBaseHours;
                for (let sub of todaysSubjects) {
                    subjectBuckets[sub] *= ratio;
                }
            }

            let sanity = 0;
            for (let sub of todaysSubjects) {
                // If we already finished some tasks today (e.g. manually before refresh), do NOT spawn new chapters for this subject today! (Clock-out Mode)
                if (dateStr === todayStrForCount && completedTodayPerSubj[sub] > 0) {
                    subjectBuckets[sub] = 0;
                }

                // Use progressEffectiveHours instead of effectiveBaseHours to leave room for reviews
                while (pending[sub] && pending[sub].length > 0 && progressEffectiveHours > 0.1 && subjectBuckets[sub] > 0.1 && sanity++ < 100) {
                    let chapter = pending[sub][0]; // Peek first
                    
                    // AI Adaptive Pace Learning Multiplier
                    let multipliers = this.state.chapterMultipliers || {};
                    let mult = parseFloat(multipliers[chapter.id] || 1.0);
                    let baseH = chapter.weight !== undefined ? (chapter.weight * 1.5) : (HOURS_PER_DIFF[chapter.difficulty] || 2.0);
                    if (sub === 'tax') baseH *= 2.0;

                    // Feature: Scale future progress tasks by actual time spent previously (for 2회독 or restarts)
                    // If the task is pending but has spentHours, it means it was restarted for a 2nd pass.
                    let pInfo = this.state.progress[chapter.id];
                    if (pInfo && pInfo.spentHours > 0 && pInfo.status !== 'partial') {
                        let timeRatio = pInfo.spentHours / baseH;
                        timeRatio = Math.max(0.6, Math.min(timeRatio, 2.0)); // Cap between 0.6x and 2.0x for 2nd pass
                        mult *= timeRatio;
                    }

                    // If it was partial from previous days in THIS LOOP, get remaining
                    let required = baseH * mult;
                    if (trackingCompleted[chapter.id] && typeof trackingCompleted[chapter.id] === 'object') {
                        required = trackingCompleted[chapter.id].remaining;
                    } else if (this.state.progress[chapter.id] && this.state.progress[chapter.id].status === 'partial') {
                        required = required * (1 - this.state.progress[chapter.id].ratio);
                    }

                    let customH = (this.state.settings.taskHoursOverrides && this.state.settings.taskHoursOverrides[dateStr] && this.state.settings.taskHoursOverrides[dateStr][chapter.id]);
                    let canDo;
                    if (customH !== undefined) {
                        canDo = Math.min(required, customH);
                    } else {
                        canDo = Math.min(required, subjectBuckets[sub], effectiveBaseHours);
                        
                        let scheduledForThisSubjToday = newSchedule[dateStr].filter(t => t.subjectId === sub && !t.isReview).length;
                        
                        // Prevent starting big chapters with a tiny sliver of time, 
                        // AND prevent splitting a new chapter if we already studied a chapter for this subject today.
                        if (canDo < required && scheduledForThisSubjToday > 0) {
                            subjectBuckets[sub] = 0; // Break out of chapter splitting
                            canDo = 0;
                        } else if (canDo <= 0.5 && required > 0.5 && scheduledForThisSubjToday > 0) {
                            subjectBuckets[sub] = 0; // Deplete bucket to break out of chapter splitting
                            canDo = 0;
                        }
                    }
                    
                    if (canDo > 0) {
                        newSchedule[dateStr].push({
                            subjectId: sub,
                            chapter: chapter,
                            allocated: canDo,
                            isReview: false
                        });
                        
                        let remaining = required - canDo;
                        if (remaining > 0.05) {
                            // Still more to do in next days/buckets
                            trackingCompleted[chapter.id] = { remaining: remaining, lastDate: dateStr };
                        } else {
                            // Finished scheduling this chapter
                            trackingCompleted[chapter.id] = new Date(dateStr).getTime();
                            pending[sub].shift(); // Remove from queue only when fully scheduled
                        }
                        
                        subjectBuckets[sub] -= canDo;
                        effectiveBaseHours -= canDo;
                    } else {
                        break; // Nothing more can fit for this subject today
                    }
                }
            }
            
            // Apply reviews using the actually reserved/available lists
            let reviewAdded = 0;
            for (let rev of availableReviewsToday) {
                if (effectiveBaseHours > 0.05 && reviewAdded < 5) {
                    let allocatedReview = Math.min(rev.dur, effectiveBaseHours);
                    newSchedule[dateStr].push({ 
                        subjectId: rev.subjKey, 
                        chapter: rev.ch, 
                        allocated: allocatedReview,
                        isReview: true,
                        reviewDay: rev.diffDays
                    });
                    reviewAdded++;
                    effectiveBaseHours -= allocatedReview;
                }
            }

            // User request: Sort newSchedule so PROGRESS (isReview: false) is on TOP
            newSchedule[dateStr].sort((a, b) => {
                if (a.isReview === b.isReview) return 0;
                return a.isReview ? 1 : -1; 
            });

            currentDate.setDate(currentDate.getDate() + 1);
            cycle++;
            if (cycle > 800) break;
        }

        if (!this.state.schedule) this.state.schedule = {};
        for (let dt in newSchedule) {
            this.state.schedule[dt] = newSchedule[dt];
        }
        
        // Note: We deliberately KEEP uncompleted tasks in this.state.schedule for past dates.
        // This allows the planner to show 'X' marks for missed tasks in the weekly/monthly view,
        // and crucially allows the engine to detect what was missed yesterday to carry it over today.
        
        this.saveState(true); 
      } catch (e) {
        console.error("Scheduling loop failed:", e);
        if (!this.state.schedule) this.state.schedule = {};
      }
    }

    getScheduleForDate(dateStr) {
        return this.state.schedule[dateStr] || [];
    }

    markCompleted(chapterId, pastDateStr = null, actualMinutes = null, feedback = null, isReview = false, reviewDay = null) {
        let p = this.state.progress[chapterId] || {};
        
        if (isReview && reviewDay !== null) {
            if (!p.completedReviews) p.completedReviews = [];
            if (!p.completedReviews.includes(reviewDay)) p.completedReviews.push(reviewDay);
            
            // Clear manual scheduling overrides for this review tier if it existed
            if (this.state.settings.reviewDateOverrides && this.state.settings.reviewDateOverrides[chapterId]) {
                delete this.state.settings.reviewDateOverrides[chapterId][reviewDay];
            }
        } else {
            this.state.progress[chapterId] = { 
                status: 'completed', 
                ratio: 1.0,
                completedAt: pastDateStr || this.getTodayStr(),
                spentHours: (p.spentHours || 0) + (actualMinutes ? actualMinutes / 60 : 0),
                feedback: feedback || p.feedback || 'normal',
                completedReviews: p.completedReviews || []
            };
            
            if (this.state.bookmarks && this.state.bookmarks[chapterId]) {
                delete this.state.bookmarks[chapterId];
            }
            
            // FIX: Clear manual scheduling overrides once the task is completed
            if (this.state.settings.taskDateOverrides && this.state.settings.taskDateOverrides[chapterId]) {
                delete this.state.settings.taskDateOverrides[chapterId];
            }
        }
        
        let completionDateStr = pastDateStr || this.getTodayStr();
        if (this.state.settings.taskHoursOverrides && this.state.settings.taskHoursOverrides[completionDateStr] && this.state.settings.taskHoursOverrides[completionDateStr][chapterId]) {
            delete this.state.settings.taskHoursOverrides[completionDateStr][chapterId];
        }
        
        if (actualMinutes && !pastDateStr) {
            let today = this.getTodayStr();
            this.state.dailySpent[today] = (this.state.dailySpent[today] || 0) + (actualMinutes / 60);
        }

        this.saveState();
        this.generateSchedule();
    }

    markPartial(chapterId, percent, actualMinutes = null, feedback = null, bookmark = '') {
        let p = this.state.progress[chapterId] || {};
        this.state.progress[chapterId] = { 
            status: 'partial', 
            ratio: percent / 100,
            spentHours: (p.spentHours || 0) + (actualMinutes ? actualMinutes / 60 : 0),
            feedback: feedback || p.feedback || 'normal'
        };
        
        if (actualMinutes) {
            let today = this.getTodayStr();
            this.state.dailySpent[today] = (this.state.dailySpent[today] || 0) + (actualMinutes / 60);
        }

        if (!this.state.bookmarks) this.state.bookmarks = {};
        if (bookmark) {
            this.state.bookmarks[chapterId] = bookmark;
        }

        this.saveState();
        this.generateSchedule();
    }

    skipDay(dateStr) {
        if (!this.state.skippedDays.includes(dateStr)) {
            this.state.skippedDays.push(dateStr);
            this.saveState();
            this.generateSchedule();
        }
    }

    removeCompletion(chapterId) {
        if (this.state.progress[chapterId]) {
            delete this.state.progress[chapterId];
            this.saveState();
            this.generateSchedule();
        }
    }
}
