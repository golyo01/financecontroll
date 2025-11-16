// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA15aIny81lWuoXc6ZDtruMujx1QB5LDGw",
  authDomain: "financecontroll-1e549.firebaseapp.com",
  projectId: "financecontroll-1e549",
  storageBucket: "financecontroll-1e549.firebasestorage.app",
  messagingSenderId: "407083051590",
  appId: "1:407083051590:web:1d29507b656ffee2383847"
};

// Firebase inicializálása
const app = initializeApp(firebaseConfig);

// Exportok az app többi részéhez
export const auth = getAuth(app);
export const db = getFirestore(app);
