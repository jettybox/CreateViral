// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "https://aistudiocdn.com/firebase@^10.12.3/app.js";
import { getFirestore, Firestore } from "https://aistudiocdn.com/firebase@^10.12.3/firestore.js";

// Your web app's Firebase configuration from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyA0UV9I-E0pDCR4azCXCp0I1hdlNqCV200",
  authDomain: "createviral-database.firebaseapp.com",
  projectId: "createviral-database",
  storageBucket: "createviral-database.firebasestorage.app",
  messagingSenderId: "985465455751",
  appId: "1:985465455751:web:e636f383a9a343ce346422",
  measurementId: "G-WC24HZVF3D"
};

// Singleton instances to ensure we only initialize once.
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let firebaseInitError: string | null = null;

/**
 * Initializes Firebase and Firestore, but only if they haven't been initialized yet.
 * This singleton pattern prevents race conditions by controlling the exact moment of initialization.
 * @returns An object containing the Firestore instance (`db`) and any initialization error (`firebaseInitError`).
 */
export function initializeFirebase() {
  // If we've already tried to initialize, return the previous result.
  if (db || firebaseInitError) {
    return { db, firebaseInitError };
  }

  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    // Get a reference to the Firestore service
    db = getFirestore(app);
  } catch (e: any) {
    console.error("CRITICAL: Firebase initialization failed.", e);
    firebaseInitError = e.message || "An unknown error occurred during Firebase initialization. Check the browser console for more details.";
    // Ensure db is null on error so we don't try to use a broken instance.
    db = null;
  }
  
  return { db, firebaseInitError };
}
