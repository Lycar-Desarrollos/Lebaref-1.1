import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCzJQhLQ4PhlYokzALRLEBKWbDtwXpIM3w",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lebaref-169a0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lebaref-169a0",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lebaref-169a0.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "150074723113",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:150074723113:web:becc556cb52b946037c538",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CFLVW150S2",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export function getUserCreationAuth() {
  const apps = getApps();
  const userCreationApp = apps.find(app => app.name === 'userCreation') || initializeApp(firebaseConfig, 'userCreation');
  return getAuth(userCreationApp);
}

export { app, auth, db, firebaseConfig };
