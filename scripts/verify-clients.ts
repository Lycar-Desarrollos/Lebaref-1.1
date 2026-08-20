import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBtV2f5KKQJujJLFFElQw4No_w_sfQWXYU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lebaref-demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lebaref-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lebaref-demo.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "646161358842",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:646161358842:web:9e157c1f2b53cfb47c0e43",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-5LRQMQB3BV",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

async function verify() {
  await signInWithEmailAndPassword(auth, "ydalimir12arevalo16@lebaref.com", "Aleman11");
  const snap = await getDocs(collection(db, "clients"));
  console.log(`Total de clientes en la base de datos: ${snap.size}`);
  snap.forEach((d) => {
    const data = d.data();
    console.log(`- [${d.id}] ${data.name} | Estado: ${data.state} | Días crédito: ${data.diasCredito} | Tel: ${data.phone}`);
  });
}

verify().catch(console.error);
