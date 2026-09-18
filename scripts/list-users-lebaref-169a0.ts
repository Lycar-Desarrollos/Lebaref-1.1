import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

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
const db = getFirestore(app);
const auth = getAuth(app);

async function listUsers() {
  console.log("Consultando colección 'users' en lebaref-169a0...");
  try {
    const snap = await getDocs(collection(db, "users"));
    console.log(`Encontrados ${snap.size} usuarios en Firestore:`);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- UID: ${doc.id} | Email: ${data.email} | Nombre: ${data.displayName || data.name} | Rol: ${data.role}`);
    });
  } catch (err: any) {
    console.log("Error al leer Firestore:", err.code, err.message);
  }
}

listUsers().catch(console.error);
