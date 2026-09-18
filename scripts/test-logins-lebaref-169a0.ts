import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCzJQhLQ4PhlYokzALRLEBKWbDtwXpIM3w",
  authDomain: "lebaref-169a0.firebaseapp.com",
  projectId: "lebaref-169a0",
  storageBucket: "lebaref-169a0.firebasestorage.app",
  messagingSenderId: "150074723113",
  appId: "1:150074723113:web:becc556cb52b946037c538",
  measurementId: "G-CFLVW150S2"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const testUsers = [
  { email: "operaciones@lebaref.com", passwords: ["iPvejazXGQmgLKf", "123456", "admin123", "lebaref2026", "lebaref2025", "Lebaref2026!"] },
  { email: "larry.carrillo@lebaref.com", passwords: ["123456", "admin123", "lebaref2026", "lebaref2025", "Lebaref2026!", "iPvejazXGQmgLKf"] },
  { email: "corporativo@lebaref.com", passwords: ["123456", "admin123", "lebaref2026", "lebaref2025", "Lebaref2026!", "iPvejazXGQmgLKf"] },
  { email: "admin@lebaref.com", passwords: ["123456", "admin123", "lebaref2026", "lebaref2025", "Lebaref2026!", "iPvejazXGQmgLKf"] },
];

async function tryLogins() {
  for (const u of testUsers) {
    for (const p of u.passwords) {
      try {
        const res = await signInWithEmailAndPassword(auth, u.email, p);
        console.log(`🎉 LOGIN EXITOSO en lebaref-169a0 con: ${u.email} | Clave: ${p} | UID: ${res.user.uid}`);
        return { email: u.email, password: p, uid: res.user.uid };
      } catch (err: any) {
        // Continue
      }
    }
  }
  console.log("No se pudo iniciar sesión con las combinaciones automáticas comunes.");
  return null;
}

tryLogins().catch(console.error);
