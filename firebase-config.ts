// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service.
// This is exported and used by the rest of the application.
export const db = getFirestore(app);
