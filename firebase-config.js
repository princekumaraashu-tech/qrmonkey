import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAxFidts-OOfxHpM1fr_uQl-acGIunf9p0",
  authDomain: "fir-5b437.firebaseapp.com",
  databaseURL: "https://fir-5b437-default-rtdb.firebaseio.com",
  projectId: "fir-5b437",
  storageBucket: "fir-5b437.firebasestorage.app",
  messagingSenderId: "351554911194",
  appId: "1:351554911194:web:0cd477cf1457c66a46dee3",
  measurementId: "G-KTYPGG3RMN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getDatabase(app);
