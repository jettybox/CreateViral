// Import the functions you need from the SDKs you need.
// This single import is sufficient to both load the function and register the service.
import { initializeApp } from "https://aistudiocdn.com/firebase@^10.12.3/app.js";
import { getFirestore, Firestore } from "https://aistudiocdn.com/firebase@^10.12.3/firestore.js";

// Your web app's Firebase configuration from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyA0UV9I-E0pDCR4azCXCp0I1hd1NqCV200",
  authDomain: "createviral-database.firebaseapp.com",
  projectId: "createviral-database",
  storageBucket: "createviral-database.firebasestorage.app",
  messagingSenderId: "985465455751",
  appId: "1:985465455751:web:e636f383a9a343ce346422",
  measurementId: "G-WC24HZVF3D"
};


let db: Firestore | null = null;
let firebaseInitError: string | null = null;

try {
  // Basic check to prevent running with placeholder values.
  if (firebaseConfig.apiKey.startsWith("YOUR_")) {
    throw new Error("Firebase configuration contains placeholder values. Please update firebase-config.ts with your actual project keys.");
  }
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  // Get a reference to the Firestore service
  db = getFirestore(app);
} catch (e: any) {
  console.error("CRITICAL: Firebase initialization failed.", e);
  firebaseInitError = e.message || "An unknown error occurred during Firebase initialization. Check the browser console for more details.";
}

export { db, firebaseInitError };
