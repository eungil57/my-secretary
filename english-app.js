class KidsEnglishEngine {
    constructor() {
        this.loadState();
        this.todayStr = this.getTodayStr();
    }
    
    getTodayStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    
    loadState() {
        let sc = localStorage.getItem('kids_english_state');
        if (sc) {
            this.state = JSON.parse(sc);
            if (!this.state.progress) this.state.progress = {};
        } else {
            this.state = { progress: {} };
        }
    }
    
    saveState() {
        localStorage.setItem('kids_english_state', JSON.stringify(this.state));
    }
    
    // Selects 1 daily card
    getTodayCard() {
        let now = new Date().getTime();
        
        let dueKeys = Object.keys(this.state.progress).filter(k => {
            let p = this.state.progress[k];
            return p.status !== 'completed' && (!p.nextReview || p.nextReview <= now);
        });
        
        if (dueKeys.length > 0) {
            dueKeys.sort((a,b) => this.state.progress[a].nextReview - this.state.progress[b].nextReview);
            return window.kidsEnglishData.find(d => d.id === dueKeys[0]);
        }
        
        let unseen = window.kidsEnglishData.filter(d => !this.state.progress[d.id]);
        if (unseen.length > 0) {
            return unseen[0];
        }
        
        let randIdx = Math.floor(Math.random() * window.kidsEnglishData.length);
        return window.kidsEnglishData[randIdx];
    }
    
    markDone(id, isHard) {
        if (!this.state.progress[id]) {
            this.state.progress[id] = { step: 0 };
        }
        
        let p = this.state.progress[id];
        
        if (isHard) {
            p.step = Math.max(0, p.step - 1);
            p.isHardToggled = true; 
        } else {
            p.step++;
        }
        
        let intervals = [1, 3, 7, 14, 30]; // SRS intervals
        let intDays = p.step < intervals.length ? intervals[p.step] : 30;
        
        if (p.step >= intervals.length) {
            p.status = 'completed'; // fully mastered
        }
        
        p.nextReview = new Date().getTime() + (intDays * 24 * 60 * 60 * 1000);
        this.saveState();
    }
    
    getDDay() {
        const target = new Date('2026-09-05T00:00:00');
        const today = new Date();
        const diffMs = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
    }
}

const engEngine = new KidsEnglishEngine();

window.renderKidsEnglishWidget = () => {
    let container = document.getElementById('kids-english-container');
    if (!container) return;
    
    let dday = engEngine.getDDay();
    let ddayText = dday > 0 ? `D-${dday}` : (dday === 0 ? `D-Day!` : `D+${Math.abs(dday)}`);
    
    let card = engEngine.getTodayCard();
    if (!card) return;
    
    let p = engEngine.state.progress[card.id] || {};
    let isHardToggled = p.isHardToggled === true; 
    let isReview = (p.step > 0 && !isHardToggled);
    let cardThemeGradient = isReview ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #3b82f6, #60a5fa)';
    let cardTitleText = isReview ? `🔄 잊기 전에 한 번 더! (${p.step}단계 복습)` : '오늘의 영어 표현';
    let cardBorderColor = isReview ? '#fbbf24' : '#60a5fa';
    let badgeStr = ''; // Deprecated the top badge in favor of large header styling
    
    let html = `
    <div class="glass-panel" style="border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 2px solid ${cardBorderColor};">
        
        <div style="background: ${cardThemeGradient}; padding: 1rem; color: white; display: flex; align-items: center; justify-content: space-between;">
            <div>
                <div style="font-size: 0.8rem; opacity: 0.9; font-weight: 600; text-transform: uppercase;">Boracay Kids Camp ✈️</div>
                <div style="font-size: 1.1rem; font-weight: 800; margin-top: 2px;">${cardTitleText}</div>
            </div>
            <div style="background: white; color: ${cardBorderColor}; padding: 0.4rem 0.8rem; border-radius: 20px; font-weight: 800; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap; flex-shrink: 0;">
                ${ddayText}
            </div>
        </div>
        
        <div style="background: #ffffff; padding: 1.5rem; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative;">
            ${badgeStr}
            
            <div style="font-size: 5rem; line-height: 1; margin: 1rem 0; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">${card.img}</div>
            
            <div id="eng-card-en" style="font-size: 1.4rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; word-break: keep-all;">${isHardToggled ? card.easy_en : card.en}</div>
            <div id="eng-card-ko" style="font-size: 1rem; font-weight: 600; color: #64748b;">${isHardToggled ? card.easy_ko : card.ko}</div>
            
            <div style="margin-top: 1.2rem; padding: 0.8rem; background: #fdf4ff; border: 1px dashed #f0abfc; border-radius: 12px; font-size: 0.95rem; color: #a21caf; text-align: center; width: 100%;">
                <div style="font-weight: 800; margin-bottom: 0.2rem;">👩‍👧 우리 아이에게 이렇게 말해주세요!</div>
                <div style="font-weight: 700; font-size: 1.05rem;">"${card.mom_en}"</div>
                <div style="font-size: 0.85rem; opacity: 0.9;">(${card.mom_ko})</div>
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; width: 100%;">
                <button onclick="window.toggleEngHard('${card.id}')" id="btn-eng-hard" style="flex: 1; background: ${isHardToggled ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${isHardToggled ? '#fca5a5' : '#cbd5e1'}; color: ${isHardToggled ? '#ef4444' : '#64748b'}; padding: 0.8rem; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                    ${isHardToggled ? '😣 복구하기' : '🤔 어려워요'}
                </button>
                <button onclick="window.markEngDone('${card.id}')" style="flex: 1.5; background: #34d399; border: none; color: white; padding: 0.8rem; border-radius: 12px; font-weight: 800; font-size: 1.05rem; cursor: pointer; box-shadow: 0 4px 6px rgba(52, 211, 153, 0.3); transition: transform 0.1s;" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'">
                    ✨ 다 외웠어요!
                </button>
            </div>
            
        </div>
        
    </div>`;
    
    container.innerHTML = html;
};

window.toggleEngHard = (id) => {
    let p = engEngine.state.progress[id];
    if (!p) {
        engEngine.state.progress[id] = { step: 0 };
        p = engEngine.state.progress[id];
    }
    p.isHardToggled = !p.isHardToggled;
    engEngine.saveState();
    window.renderKidsEnglishWidget();
};

window.markEngDone = (id) => {
    let p = engEngine.state.progress[id];
    let isHard = p && p.isHardToggled;
    
    engEngine.markDone(id, isHard);
    
    if (engEngine.state.progress[id]) {
        engEngine.state.progress[id].isHardToggled = false;
        engEngine.saveState();
    }
    
    window.customAlert('🎉 참 잘했어요! 복습 날짜에 다시 만나요!');
    
    window.renderKidsEnglishWidget();
};

window.undoEngProgress = (id) => {
    if (confirm('이 표기의 학습/복습 기록을 초기화하시겠습니까? 처음 상태로 돌아갑니다.')) {
        delete engEngine.state.progress[id];
        engEngine.saveState();
        window.initEnglishDashboard(); // Re-render grid
        window.renderKidsEnglishWidget(); // Re-render today card
    }
};

// Auto-inject to Sidebar upon load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.renderKidsEnglishWidget();
    }, 500);
});

window.initEnglishDashboard = () => {
    let container = document.getElementById('english-view-section');
    if (!container) return;
    
    let totalCount = window.kidsEnglishData.length;
    let completedCount = Object.values(engEngine.state.progress).filter(p => p.status === 'completed').length;
    let learningCount = Object.values(engEngine.state.progress).filter(p => p.step > 0 && p.status !== 'completed').length;
    let masterPct = Math.round((completedCount / totalCount) * 100);
    
    let html = `
        <div id="kids-english-container" style="max-width: 500px; margin: 0 auto 2rem auto;"></div>
        
        <div class="top-header" style="padding-bottom: 2rem; border-bottom: 1px solid rgba(0,0,0,0.05); margin-bottom: 2rem;">
            <div>
                <h1 style="color: #3b82f6;">🏕️ Boracay Kids Camp Voca</h1>
                <p class="subtitle">우리아이를 위한 예약제 D-159 영어캠프 필수 문장 총정리</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #3b82f6, #60a5fa); color: white; padding: 1.5rem 2rem; border-radius: 20px; font-weight: 800; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 2.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">🏆</span>
                        <div>
                            <div style="font-size: 0.95rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Boracay Master Challenge</div>
                            <div style="font-size: 1.6rem;">${totalCount} 문장 완벽 마스터!</div>
                        </div>
                    </div>
                </div>
                
                <!-- Kid-friendly Graphic Progress Bar -->
                <div style="background: rgba(255, 255, 255, 0.2); border-radius: 20px; padding: 4px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.15); height: 40px; display: flex; align-items: center; position: relative;">
                    <div style="position: absolute; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 1;">
                        <span style="font-weight: 900; color: #1e3a8a; font-size: 1.1rem; text-shadow: 0 1px 2px rgba(255,255,255,0.6);">내가 아는 영어: ${completedCount}개 (${masterPct}%)</span>
                    </div>
                    <div style="background: linear-gradient(90deg, #fef08a, #f59e0b); width: ${Math.max(2, masterPct)}%; height: 100%; border-radius: 16px; transition: width 1s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.4); z-index: 2;">
                        <div style="position: absolute; right: -25px; top: -15px; font-size: 3rem; filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3));">🏄‍♂️</div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; opacity: 0.9; font-weight: 700; padding: 0 0.5rem;">
                    <div>📝 학습 중: ${learningCount} 문장</div>
                    <div>🚀 남은 목표: ${totalCount - completedCount} 문장</div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
    `;
    
    window.kidsEnglishData.forEach((d, i) => {
        let p = engEngine.state.progress[d.id] || {};
        let statusBadge = '';
        let undoBtn = '';
        if (p.status === 'completed') {
            statusBadge = `<div style="position:absolute; top:-10px; right:-10px; font-size: 2.5rem; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.2)); z-index: 10;" title="마스터 완료!">🌟</div>`;
            undoBtn = `<button onclick="window.undoEngProgress('${d.id}')" style="margin-top: 0.5rem; background: #fee2e2; border: 1px solid #fca5a5; color: #ef4444; border-radius: 6px; padding: 0.4rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">↺ 테스트 기록 취소 (초기화)</button>`;
        } else if (p.step > 0) {
            statusBadge = `<div style="position:absolute; top:-10px; right:-10px; background: #fbbf24; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 800; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10;">복습 ${p.step}단계</div>`;
            undoBtn = `<button onclick="window.undoEngProgress('${d.id}')" style="margin-top: 0.5rem; background: #fee2e2; border: 1px solid #fca5a5; color: #ef4444; border-radius: 6px; padding: 0.4rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">↺ 테스트 기록 취소 (초기화)</button>`;
        }
        
        html += `
            <div class="glass-panel" style="padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; gap: 1rem; position: relative; border-left: 5px solid #60a5fa; transition: transform 0.2s; background: var(--glass-bg);" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                ${statusBadge}
                <div style="font-size: 3.5rem; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${d.img}</div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; width: 100%;">
                    <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 700;">Day ${i+1}</div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: #1e293b; word-break: keep-all; line-height: 1.3;">${d.en}</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: #64748b;">${d.ko}</div>
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #cbd5e1; font-size: 0.85rem; color: #ef4444; font-weight: 700; background: #fef2f2; border-radius: 6px; padding: 0.5rem;">
                        💡 ${d.easy_en} (${d.easy_ko})
                    </div>
                    <div style="margin-top: 0.3rem; padding: 0.5rem; font-size: 0.85rem; color: #a21caf; font-weight: 700; background: #fdf4ff; border-radius: 6px; border: 1px dashed #f0abfc;">
                        👩‍👧 ${d.mom_en} (${d.mom_ko})
                    </div>
                    ${undoBtn}
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    window.renderKidsEnglishWidget();
};
