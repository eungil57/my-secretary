import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWHe5N2XlZDyeBv05PtuUBe1IgYraQOmY",
  authDomain: "my-secretary-8b89f.firebaseapp.com",
  projectId: "my-secretary-8b89f",
  storageBucket: "my-secretary-8b89f.firebasestorage.app",
  messagingSenderId: "111509179235",
  appId: "1:111509179235:web:1fad6f5e4eda5434332156",
  measurementId: "G-8K5VYCYR33"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

window.firebaseSync = {
    userId: null,
    onLogin: async (user) => {
        window.firebaseSync.userId = user.uid;
        document.getElementById('auth-status').innerHTML = `
            <div id="sync-indicator" style="padding: 0.5rem; background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #6d28d9; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" title="클릭하여 서버에서 강제 새로고침">
                <span>☁️ 동기화 켜짐 <strong style="color: #ffffff; font-size: 0.85rem; margin-left: 6px; background: #7c3aed; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">실시간</strong></span>
                <button id="logout-btn" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#ef4444; font-weight:700; padding:0;">로그아웃</button>
            </div>
        `;
        
        // 더 확실한 클릭 감지를 위해 이벤트 리스너 직접 연결
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.addEventListener('click', (e) => {
                if (e.target.id === 'logout-btn') return;
                window.firebaseSync.manualSync();
            });
        }
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.firebaseSync.logout();
            });
        }
        
        const docRef = doc(db, "users", user.uid);
        
        // 실시간 클라우드 감지 시작 (V11: 콘텐츠 기반 공격적 동기화)
        if (window.firebaseSync.unsubscribe) window.firebaseSync.unsubscribe();
        window.firebaseSync.unsubscribe = onSnapshot(docRef, (docSnap) => {
            // hasPendingWrites가 false일 때(순수 리모트 변화)만 즉시 수용
            if (docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
                const data = docSnap.data();
                console.log("Remote data received. Checking for changes...");
                
                let changed = false;
                
                // Planner Sync: 시간비교 없이 내용 다르면 무조건 업데이트
                if (data.planner && JSON.stringify(data.planner) !== JSON.stringify(window.engine.state)) {
                    console.log("Planner cloud data differs. Overwriting...");
                    window.engine.state = data.planner;
                    window.engine.saveState(true);
                    changed = true;
                }
                
                // Bible Sync: 시간비교 없이 내용 다르면 무조건 업데이트 (취소 반영 핵심)
                if (data.bible && JSON.stringify(data.bible) !== JSON.stringify(window.bibleEngine.state)) {
                    console.log("Bible cloud data differs. Overwriting...");
                    window.bibleEngine.state = data.bible;
                    window.bibleEngine.saveState(true);
                    changed = true;
                }
                
                // English Sync
                if (data.english && JSON.stringify(data.english) !== JSON.stringify(window.engEngine.state)) {
                    window.engEngine.state = data.english;
                    window.engEngine.saveState(true);
                    changed = true;
                }
                
                if (changed) {
                    window.engine.generateSchedule();
                    if (window.initDashboard) window.initDashboard();
                    if (window.initBibleDashboard) window.initBibleDashboard();
                    if (window.initEnglishDashboard) window.initEnglishDashboard();
                }
            }
        });
        
        // 초기 로드 시에도 서버 데이터가 있으면 무조건 일단 받기
        const initialSnap = await getDoc(docRef);
        if (initialSnap.exists()) {
            const data = initialSnap.data();
            if (data.planner) { window.engine.state = data.planner; window.engine.saveState(true); }
            if (data.bible) { window.bibleEngine.state = data.bible; window.bibleEngine.saveState(true); }
            if (data.english) { window.engEngine.state = data.english; window.engEngine.saveState(true); }
            window.engine.generateSchedule();
            if (window.initDashboard) window.initDashboard();
            if (window.initBibleDashboard) window.initBibleDashboard();
        } else {
            await window.firebaseSync.uploadAll();
        }
    },
    
    // 타임스탬프를 비교하여 더 최신 데이터를 선택합니다. (삭제/취소 반영을 위해)
    smartSync: (local, remote, storageKey) => {
        if (!remote) return local;
        if (!local) return remote;
        
        const localTime = local.lastUpdated || 0;
        const remoteTime = remote.lastUpdated || 0;
        
        // 두 데이터 모두 타임스탬프가 없는 초기 상태라면 로컬을 우선시 (소실 방지)
        if (localTime === 0 && remoteTime === 0) return local;
        
        if (remoteTime > localTime) {
            console.log(`[${storageKey}] Cloud data is newer (${remoteTime} > ${localTime}). Syncing from cloud...`);
            return remote;
        } else {
            console.log(`[${storageKey}] Local data is newer/same (${localTime} >= ${remoteTime}). Keeping local...`);
            return local; 
        }
    },

    manualSync: async () => {
        if (!window.firebaseSync.userId) return;
        window.firebaseSync.setSyncStatus('syncing');
        try {
            await window.firebaseSync.onLogin({ uid: window.firebaseSync.userId });
            window.firebaseSync.setSyncStatus('success');
            // Force redraw everything
            if (window.initDashboard) window.initDashboard();
            if (window.renderBibleTable) window.renderBibleTable();
            // No alert per user request
        } catch (e) {
            console.error("Manual Sync Error:", e);
            window.firebaseSync.setSyncStatus('error');
        }
    },

    uploadAll: async () => {
        if (!window.firebaseSync.userId) return;
        await Promise.all([
            window.firebaseSync.savePlanner(window.engine.state),
            window.firebaseSync.saveBible(window.bibleEngine.state),
            window.firebaseSync.saveEnglish(window.engEngine.state)
        ]);
    },

    onLogout: () => {
        window.firebaseSync.userId = null;
        document.getElementById('auth-status').innerHTML = `<button onclick="window.firebaseSync.login()" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #3b82f6; width: 100%;">Google 클라우드 동기화 🔄</button><div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 4px;">로그인 시 폰/패드와 자동 연동</div>`;
    },
    login: async () => {
        try {
            document.getElementById('auth-status').innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">로그인 중...</span>`;
            await signInWithPopup(auth, provider);
        } catch (e) {
            console.error(e);
            alert("로그인 실패: " + e.message);
            window.firebaseSync.onLogout(); 
        }
    },
    logout: async () => {
        await signOut(auth);
        location.reload();
    },
    savePlanner: async (state) => {
        if (!window.firebaseSync.userId) return;
        window.firebaseSync.setSyncStatus('syncing');
        try {
            // Use updateDoc to replace the atomic object, supporting deletions/unchecks
            await updateDoc(doc(db, "users", window.firebaseSync.userId), { planner: state });
            window.firebaseSync.setSyncStatus('success');
        } catch (e) {
            console.error("Firestore Save Error (Planner):", e);
            window.firebaseSync.setSyncStatus('error');
        }
    },
    saveBible: async (state) => {
        if (!window.firebaseSync.userId) return;
        window.firebaseSync.setSyncStatus('syncing');
        try {
            await updateDoc(doc(db, "users", window.firebaseSync.userId), { bible: state });
            window.firebaseSync.setSyncStatus('success');
        } catch (e) {
            console.error("Firestore Save Error (Bible):", e);
            window.firebaseSync.setSyncStatus('error');
        }
    },
    saveEnglish: async (state) => {
        if (!window.firebaseSync.userId) return;
        window.firebaseSync.setSyncStatus('syncing');
        try {
            await updateDoc(doc(db, "users", window.firebaseSync.userId), { english: state });
            window.firebaseSync.setSyncStatus('success');
        } catch (e) {
            console.error("Firestore Save Error (English):", e);
            window.firebaseSync.setSyncStatus('error');
        }
    },
    setSyncStatus: (status) => {
        const indicator = document.getElementById('sync-indicator');
        if (!indicator) return;
        
        // Clear any existing timeout
        if (window.syncStatusTimeout) clearTimeout(window.syncStatusTimeout);
        
        if (status === 'syncing') {
            indicator.querySelector('span').innerHTML = '🔄 동기화 중...';
            indicator.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            indicator.style.background = 'rgba(59, 130, 246, 0.1)';
            indicator.style.color = '#2563eb';
        } else if (status === 'success') {
            indicator.querySelector('span').innerHTML = '☁️ 동기화 완료';
            indicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            indicator.style.background = 'rgba(16, 185, 129, 0.1)';
            indicator.style.color = '#059669';
            
            // Revert to "Sync Enabled" after 3 seconds
            window.syncStatusTimeout = setTimeout(() => {
                indicator.querySelector('span').innerHTML = '☁️ 동기화 켜짐';
            }, 3000);
        } else if (status === 'error') {
            indicator.querySelector('span').innerHTML = '⚠️ 동기화 오류';
            indicator.style.borderColor = '#fca5a5';
            indicator.style.background = '#fef2f2';
            indicator.style.color = '#ef4444';
        }
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.firebaseSync.onLogin(user);
    } else {
        window.firebaseSync.onLogout();
    }
});
