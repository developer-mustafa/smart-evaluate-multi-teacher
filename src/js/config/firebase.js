import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, serverTimestamp as firestoreServerTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkw1kL7AU73Y9FWrPZ-ERv5xFvXGGILBA",
  authDomain: "claritybudget-6lnmd.firebaseapp.com",
  projectId: "claritybudget-6lnmd",
  storageBucket: "claritybudget-6lnmd.firebasestorage.app",
  messagingSenderId: "40318182466",
  appId: "1:40318182466:web:c2ce0637f8f23afa95b9db",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const serverTimestamp = firestoreServerTimestamp;

export { app, auth, db, googleProvider, serverTimestamp };
