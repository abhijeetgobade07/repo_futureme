// src/firebase.js

// Import Firebase core and the services you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// You can include analytics only if you really need it
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCEFaLMauKXJZ9oQ897YyJHCfiAYJ8niHs",
  authDomain: "futureme-f044c.firebaseapp.com",
  projectId: "futureme-f044c",
  storageBucket: "futureme-f044c.firebasestorage.app",
  messagingSenderId: "846399201959",
  appId: "1:846399201959:web:cdfd055d82b31a40403182",
  measurementId: "G-6X0V5J8YH9"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and export it
export const auth = getAuth(app);

// (Optional) Initialize Analytics if needed
const analytics = getAnalytics(app);