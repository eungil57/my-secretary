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
            console.log("Remote data found, performing smart merge...");
            
            // Smart Merge for Planner
            if (data.planner) {
                window.engine.state = window.firebaseSync.mergePlanner(window.engine.state, data.planner);
                window.engine.saveState();
            }
            // Smart Merge for Bible
            if (data.bible) {
                window.bibleEngine.state = window.firebaseSync.mergeBible(window.bibleEngine.state, data.bible);
                window.bibleEngine.saveState();
            }
            // Smart Merge for English
            if (data.english) {
                window.engEngine.state = window.firebaseSync.mergeEnglish(window.engEngine.state, data.english);
                window.engEngine.saveState();
            }
            
            // Upload the merged state back to cloud to ensure consistency
            await window.firebaseSync.uploadAll();
        } else {
            console.log("No remote data found, uploading local data as source of truth.");
            await window.firebaseSync.uploadAll();
        }
        
        window.engine.generateSchedule();
        if (window.initDashboard) window.initDashboard();
        if (window.initBibleDashboard) window.initBibleDashboard();
        if (window.initEnglishDashboard) window.initEnglishDashboard();
    },
    
    // Merger Helpers to prevent overwriting local progress with empty cloud data
    mergePlanner: (local, remote) => {
        if (!remote) return local;
        let merged = { ...remote, ...local }; // Local settings take precedence for now
        
        // Progress: Union of completions
        let lp = local.progress || {};
        let rp = remote.progress || {};
        merged.progress = { ...rp, ...lp };
        for (let k in rp) {
            if (rp[k].status === 'completed' && (!lp[k] || lp[k].status !== 'completed')) {
                merged.progress[k] = rp[k];
            }
        }
        
        // SkippedDays & ExtraStudyDays: Union
        merged.skippedDays = [...new Set([...(remote.skippedDays || []), ...(local.skippedDays || [])])];
        if (remote.settings?.extraStudyDays || local.settings?.extraStudyDays) {
            if (!merged.settings) merged.settings = local.settings || remote.settings;
            merged.settings.extraStudyDays = [...new Set([...(remote.settings?.extraStudyDays || []), ...(local.settings?.extraStudyDays || [])])];
        }
        
        // Custom Tasks: Union by ID
        let combinedCT = [...(remote.customTasks || []), ...(local.customTasks || [])];
        let seenCT = new Set();
        merged.customTasks = combinedCT.filter(t => {
            if (seenCT.has(t.id)) return false;
            seenCT.add(t.id);
            return true;
        });
        
        return merged;
    },
    
    mergeBible: (local, remote) => {
        if (!remote) return local;
        let merged = { ...remote, ...local };
        merged.readChapters = { ...(remote.readChapters || {}), ...(local.readChapters || {}) };
        merged.chapterComments = { ...(remote.chapterComments || {}), ...(local.chapterComments || {}) };
        
        // Sermons: Union by date + range
        let combinedSermons = [...(remote.sermons || []), ...(local.sermons || [])];
        let seenS = new Set();
        merged.sermons = combinedSermons.filter(s => {
            let key = `${s.date}-${s.range}`;
            if (seenS.has(key)) return false;
            seenS.add(key);
            return true;
        });
        return merged;
    },
    
    mergeEnglish: (local, remote) => {
        if (!remote) return local;
        let merged = { ...remote, ...local };
        merged.progress = { ...(remote.progress || {}), ...(local.progress || {}) };
        merged.bookmarks = { ...(remote.bookmarks || {}), ...(local.bookmarks || {}) };
        return merged;
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
        if (status === 'syncing') {
            indicator.querySelector('span').innerHTML = '🔄 동기화 중...';
            indicator.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            indicator.style.background = 'rgba(59, 130, 246, 0.1)';
            indicator.style.color = '#2563eb';
        } else if (status === 'success') {
            setTimeout(() => {
                indicator.querySelector('span').innerHTML = '☁️ 동기화 완료';
                indicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                indicator.style.background = 'rgba(16, 185, 129, 0.1)';
                indicator.style.color = '#059669';
            }, 1000);
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
