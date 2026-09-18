import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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
const db = getFirestore(app);

const email = "operaciones@lebaref.com";
const password = "iPvejazXGQmgLKf";

async function verifyOrSetupUser() {
  console.log(`Intentando autenticar en lebaref-169a0 con: ${email}...`);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`✅ Autenticación EXITOSA en lebaref-169a0. UID: ${cred.user.uid}`);
    
    // Verificar o crear doc de usuario en Firestore
    const userDocRef = doc(db, "users", cred.user.uid);
    await setDoc(userDocRef, {
      displayName: "Edgar Ydalimir Arévalo Escobedo",
      email: email,
      role: "admin",
      userCode: "OP",
      department: "Operaciones y Mantenimiento",
      jobTitle: "Gerente de Operaciones",
      phone: "9999887766",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log(`✅ Perfil en Firestore users actualizado con role: 'admin'.`);
  } catch (error: any) {
    console.log(`⚠️ Falló el login directo: ${error.code} - ${error.message}`);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      console.log(`Creando usuario en Firebase Auth para lebaref-169a0...`);
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        console.log(`🎉 Usuario creado exitosamente en Auth! UID: ${newCred.user.uid}`);
        const userDocRef = doc(db, "users", newCred.user.uid);
        await setDoc(userDocRef, {
          displayName: "Edgar Ydalimir Arévalo Escobedo",
          email: email,
          role: "admin",
          userCode: "OP",
          department: "Operaciones y Mantenimiento",
          jobTitle: "Gerente de Operaciones",
          phone: "9999887766",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log(`✅ Perfil en Firestore creado como Admin.`);
      } catch (createError: any) {
        if (createError.code === 'auth/email-already-in-use') {
          console.log("El correo ya existe en Auth, pero la contraseña no coincide.");
        } else {
          console.error("Error al crear usuario:", createError);
        }
      }
    }
  }
}

verifyOrSetupUser().catch(console.error);
