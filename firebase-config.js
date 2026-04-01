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
        document.getElementById('auth-status').innerHTML = `<div style="padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #059669; display: flex; align-items: center; justify-content: space-between;"><span>☁️ 동기화 켜짐</span><button onclick="window.firebaseSync.logout()" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#ef4444; font-weight:700; padding:0;">로그아웃</button></div>`;
        
        // Fetch states from Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        let merged = false;
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.planner) { window.engine.state = data.planner; merged = true; }
            if (data.bible) { window.bibleEngine.state = data.bible; merged = true; }
            if (data.english) { window.engEngine.state = data.english; merged = true; }
            
            if (merged) {
                window.engine.saveState();
                window.bibleEngine.saveState();
                window.engEngine.saveState();
            }
        } else {
            console.log("No remote data found, uploading local data as source of truth.");
            // NEW: Upload local data to cloud so other devices can sync immediately
            if (window.engine?.state) window.firebaseSync.savePlanner(window.engine.state);
            if (window.bibleEngine?.state) window.firebaseSync.saveBible(window.bibleEngine.state);
            if (window.engEngine?.state) window.firebaseSync.saveEnglish(window.engEngine.state);
        }
        
        window.engine.generateSchedule();
        if (window.initDashboard) window.initDashboard();
        if (window.initBibleDashboard) window.initBibleDashboard();
        if (window.initEnglishDashboard) window.initEnglishDashboard();
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
            window.firebaseSync.onLogout(); // reset UI
        }
    },
    logout: async () => {
        await signOut(auth);
        location.reload();
    },
    savePlanner: (state) => {
        if (!window.firebaseSync.userId) return;
        setDoc(doc(db, "users", window.firebaseSync.userId), { planner: state }, { merge: true });
    },
    saveBible: (state) => {
        if (!window.firebaseSync.userId) return;
        setDoc(doc(db, "users", window.firebaseSync.userId), { bible: state }, { merge: true });
    },
    saveEnglish: (state) => {
        if (!window.firebaseSync.userId) return;
        setDoc(doc(db, "users", window.firebaseSync.userId), { english: state }, { merge: true });
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.firebaseSync.onLogin(user);
    } else {
        window.firebaseSync.onLogout();
    }
});
