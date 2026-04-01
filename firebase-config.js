import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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
        document.getElementById('auth-status').innerHTML = `<div id="sync-indicator" style="padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #059669; display: flex; align-items: center; justify-content: space-between;"><span>☁️ 동기화 켜짐</span><button onclick="window.firebaseSync.logout()" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#ef4444; font-weight:700; padding:0;">로그아웃</button></div>`;
        
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Remote data found, performing timestamp-aware sync...");
            
            // Smart Sync for Planner
            if (data.planner) {
                window.engine.state = window.firebaseSync.smartSync(window.engine.state, data.planner, 'study_planner_state');
                window.engine.saveState();
            }
            // Smart Sync for Bible
            if (data.bible) {
                window.bibleEngine.state = window.firebaseSync.smartSync(window.bibleEngine.state, data.bible, 'bible_progress_state');
                window.bibleEngine.saveState();
            }
            // Smart Sync for English
            if (data.english) {
                window.engEngine.state = window.firebaseSync.smartSync(window.engEngine.state, data.english, 'english_progress_state');
                window.engEngine.saveState();
            }
            
            await window.firebaseSync.uploadAll();
        } else {
            console.log("No remote data found, initial upload.");
            await window.firebaseSync.uploadAll();
        }
        
        window.engine.generateSchedule();
        if (window.initDashboard) window.initDashboard();
        if (window.initBibleDashboard) window.initBibleDashboard();
        if (window.initEnglishDashboard) window.initEnglishDashboard();
    },
    
    // 타임스탬프를 비교하여 더 최신 데이터를 선택합니다. (삭제/취소 반영을 위해)
    smartSync: (local, remote, storageKey) => {
        if (!remote) return local;
        if (!local || !local.lastUpdated) return remote;
        
        const localTime = local.lastUpdated || 0;
        const remoteTime = remote.lastUpdated || 0;
        
        if (remoteTime > localTime) {
            console.log(`[${storageKey}] Cloud data is newer. Syncing from cloud...`);
            return remote; // 클라우드가 최신이면 덮어씌움 (취소/삭제 반영)
        } else {
            console.log(`[${storageKey}] Local data is newer. Keeping local...`);
            // 로컬이 최성이면 로컬 유지 (나중에 uploadAll이 클라우드로 보냄)
            return local; 
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
            await setDoc(doc(db, "users", window.firebaseSync.userId), { planner: state }, { merge: true });
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
            await setDoc(doc(db, "users", window.firebaseSync.userId), { bible: state }, { merge: true });
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
            await setDoc(doc(db, "users", window.firebaseSync.userId), { english: state }, { merge: true });
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
