// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCEuZNaJ77wogV7zjtzlZvY2pOfwrJUhF8",
  authDomain: "airtrace-1ba7e.firebaseapp.com",
  projectId: "airtrace-1ba7e",
  storageBucket: "airtrace-1ba7e.firebasestorage.app",
  messagingSenderId: "975859098440",
  appId: "1:975859098440:web:3f615737d829d923df097d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);