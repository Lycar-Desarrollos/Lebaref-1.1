import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";

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

async function sendReset() {
  try {
    await sendPasswordResetEmail(auth, "operaciones@lebaref.com");
    console.log("✅ Correo de restablecimiento de contraseña enviado a operaciones@lebaref.com");
  } catch (err: any) {
    console.error("Error al enviar reset:", err.code, err.message);
  }
}

sendReset().catch(console.error);
