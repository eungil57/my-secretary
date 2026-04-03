// global window.subjectData used

const HOURS_PER_DIFF = {
    1: 1.0, 2: 1.5, 3: 2.5, 4: 3.5, 5: 4.5
};

window.StudyEngine = class {
    constructor() {
        this.loadState();
        // 항상 최신 5시간 옵션으로 당일 일정을 강제 재구성
        this.generateSchedule();
    }

    loadState() {
        const saved = localStorage.getItem('study_planner_state');
        if (saved) {
            this.state = JSON.parse(saved);
            if (this.state.settings.dailyHours === 6.5 || this.state.settings.dailyHours === 5.0) {
                this.state.settings.dailyHours = 5.5; // 디폴트 루틴 시간으로 재조정
            }
        } else {
            this.state = {
                settings: {
                    dailyHours: 5.5, // Default changed to 5.5 (10시~17시, 점심제외)
                    startDate: this.getTodayStr(),
                },
                progress: {},
                schedule: {},
                skippedDays: [],
                dailySpent: {}
            };
            this.saveState();
        }
        if (!this.state.dailySpent) this.state.dailySpent = {};
        if (!this.state.customTasks) this.state.customTasks = [];
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

    generateSchedule() {
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
        for (let sub in pending) {
            let regular = [];
            for (let ch of pending[sub]) {
                let overrideDate = this.state.settings.taskDateOverrides && this.state.settings.taskDateOverrides[ch.id];
                if (overrideDate) {
                    if (!deferredTasks[overrideDate]) deferredTasks[overrideDate] = [];
                    deferredTasks[overrideDate].push({ sub, chapter: ch });
                } else {
                    regular.push(ch);
                }
            }
            pending[sub] = regular;
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
        
        let activeQueue = ['tax', 'accounting', 'cost_accounting', 'finance'];

        while(pending.tax.length > 0 || pending.accounting.length > 0 || pending.cost_accounting.length > 0 || pending.finance.length > 0) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            let wday = currentDate.getDay(); 
            if (this.state.skippedDays.includes(dateStr) || wday === 0 || wday === 6) {
                if (this.state.skippedDays.includes(dateStr)) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue; // Skip if explicitly skipped by user
                }
                if (!this.state.settings.extraStudyDays || !this.state.settings.extraStudyDays.includes(dateStr)) {
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
            if (deferredTasks[dateStr]) {
                for (let dt of deferredTasks[dateStr]) {
                    if (!subjectsWithDeferredToday.includes(dt.sub)) subjectsWithDeferredToday.push(dt.sub);
                    
                    let mult = parseFloat(this.state.chapterMultipliers && this.state.chapterMultipliers[dt.chapter.id] ? this.state.chapterMultipliers[dt.chapter.id] : 1.0);
                    let baseH = dt.chapter.weight !== undefined ? (dt.chapter.weight * 1.5) : (HOURS_PER_DIFF[dt.chapter.difficulty] || 2.0);
                    if (dt.sub === 'tax') baseH *= 2.0;
                    let eHours = baseH * mult; 
                    
                    newSchedule[dateStr].push({
                        subjectId: dt.sub,
                        chapter: dt.chapter,
                        allocated: eHours, 
                        isReview: false
                    });
                    
                    effectiveBaseHours -= eHours;
                }
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
            if (effectiveBaseHours >= 6.0) maxSubjectsNum = 3;
            else if (effectiveBaseHours < 3.0) maxSubjectsNum = 1;
            
            activeQueue = activeQueue.filter(k => pending[k].length > 0);
            
            let todaysSubjects = [];
            let unpicked = [];
            let allowedAttempts = activeQueue.length;
            
            while(activeQueue.length > 0 && todaysSubjects.length < maxSubjectsNum && (todaysSubjects.length + unpicked.length) < allowedAttempts) {
                let candidate = activeQueue.shift();
                
                // USER REQUEST: Don't automatically add next chapters for subjects with today's or future overrides
                if (subjectsWithDeferredToday.includes(candidate) || subjectsWithFutureDeferred.includes(candidate)) {
                    unpicked.push(candidate);
                    continue;
                }

                let conflict = false;
                // Check against current picks AND deferred tasks for the day
                let allTodaySubjs = [...todaysSubjects, ...subjectsWithDeferredToday];
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
            todaysSubjects.forEach(s => {
                let w = subjectWeights[s] || 1.0;
                subjectBuckets[s] = effectiveBaseHours * (w / totalWeight);
            });
            
            // USER REQUEST: Only show reviews if studying 3+ hours today
            let reviewReservedTime = 0;
            let availableReviewsToday = [];
            if (baseHours >= 3.0) {
                // Pre-identify relevant reviews for today's subjects to reserve exact time
                let scheduledSubjs = [...todaysSubjects, ...subjectsWithDeferredToday];
                if (scheduledSubjs.length > 0) {
                    const reviewTiers = { 1: 0.5, 7: 0.3, 14: 0.2, 30: 0.1 };
                    const reviewDays = Object.keys(reviewTiers).map(Number);
                    let currentDayTs = new Date(dateStr).getTime();
                    
                    for (let subjKey of scheduledSubjs) {
                        let subj = window.subjectData[subjKey];
                        if (!subj) continue;
                        for (let ch of subj.chapters) {
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
                                if (reviewDays.includes(diffDays) || (this.state.settings.taskDateOverrides && this.state.settings.taskDateOverrides[ch.id] === dateStr)) {
                                    let fb = p && p.feedback ? p.feedback : 'normal';
                                    let fbMult = (fb === 'hard' ? 1.5 : (fb === 'easy' ? 0.7 : 1.0));
                                    let dur = (reviewTiers[diffDays] || 0.5) * fbMult;
                                    reviewReservedTime += dur;
                                    availableReviewsToday.push({ subjKey, ch, dur, diffDays: (reviewTiers[diffDays] ? diffDays : '지정') });
                                    if (availableReviewsToday.length >= 6) break; // Limit reviews per day
                                }
                            }
                        }
                    }
                }
            }
            // Cap review reservation to 35% of daily hours to keep progress as priority
            reviewReservedTime = Math.min(reviewReservedTime, baseHours * 0.35);

            let progressEffectiveHours = effectiveBaseHours - reviewReservedTime;
            let sanity = 0;
            for (let sub of todaysSubjects) {
                // If we already finished some tasks today (e.g. manually before refresh), subtract from bucket
                if (dateStr === todayStrForCount && completedTodayPerSubj[sub]) {
                    subjectBuckets[sub] = Math.max(0, subjectBuckets[sub] - (completedTodayPerSubj[sub] * 1.5));
                }

                // Use progressEffectiveHours instead of effectiveBaseHours to leave room for reviews
                while (pending[sub] && pending[sub].length > 0 && progressEffectiveHours > 0.1 && subjectBuckets[sub] > 0.1 && sanity++ < 100) {
                    let chapter = pending[sub][0]; // Peek first
                    
                    // AI Adaptive Pace Learning Multiplier
                    let mult = parseFloat(this.state.chapterMultipliers && this.state.chapterMultipliers[chapter.id] ? this.state.chapterMultipliers[chapter.id] : 1.0);
                    let baseH = chapter.weight !== undefined ? (chapter.weight * 1.5) : (HOURS_PER_DIFF[chapter.difficulty] || 2.0);
                    if (sub === 'tax') baseH *= 2.0;

                    // If it was partial from previous days in THIS LOOP, get remaining
                    let required = baseH * mult;
                    if (trackingCompleted[chapter.id] && typeof trackingCompleted[chapter.id] === 'object') {
                        required = trackingCompleted[chapter.id].remaining;
                    } else if (this.state.progress[chapter.id] && this.state.progress[chapter.id].status === 'partial') {
                        required = required * (1 - this.state.progress[chapter.id].ratio);
                    }

                    let canDo = Math.min(required, subjectBuckets[sub], effectiveBaseHours);
                    
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

        this.state.schedule = newSchedule;
        this.saveState(true); 
    }

    getScheduleForDate(dateStr) {
        return this.state.schedule[dateStr] || [];
    }

    markCompleted(chapterId, pastDateStr = null, actualMinutes = null, feedback = null) {
        let p = this.state.progress[chapterId] || {};
        this.state.progress[chapterId] = { 
            status: 'completed', 
            ratio: 1.0,
            completedAt: pastDateStr || this.getTodayStr(),
            spentHours: (p.spentHours || 0) + (actualMinutes ? actualMinutes / 60 : 0),
            feedback: feedback || p.feedback || 'normal'
        };
        
        if (this.state.bookmarks && this.state.bookmarks[chapterId]) {
            delete this.state.bookmarks[chapterId];
        }
        
        // FIX: Clear manual scheduling overrides once the task is completed
        if (this.state.settings.taskDateOverrides && this.state.settings.taskDateOverrides[chapterId]) {
            delete this.state.settings.taskDateOverrides[chapterId];
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
