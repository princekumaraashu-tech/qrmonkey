import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        // Find all links pointing to index.html
        const createQrLinks = document.querySelectorAll('a[href="/index.html"], a[href="index.html"]');
        
        if (user) {
            // Logged in users should be directed to home.html
            createQrLinks.forEach(link => {
                link.href = '/home.html';
            });
            
            // Also redirect if they are currently ON index.html
            const path = window.location.pathname;
            if (path.endsWith('index.html') || path === '/' || path === '') {
                window.location.href = '/home.html';
            }
        } else {
            // Guests should be directed to index.html
            createQrLinks.forEach(link => {
                link.href = '/index.html';
            });
        }
    });
});
