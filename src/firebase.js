import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDEA4i5-lbRT9PCwlLv0HZ6htWAZlH2qQU",
  authDomain: "loneliss.firebaseapp.com",
  projectId: "loneliss",
  storageBucket: "loneliss.firebasestorage.app",
  messagingSenderId: "600687956895",
  appId: "1:600687956895:web:0d28974aca3a3963b863aa",
  measurementId: "G-4WY09H504X"
};

const app = initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);