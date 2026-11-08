import { auth, db } from './firebase-config.js';
import { ref as dbRef, push, set } from 'firebase/database';

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const successMessage = document.getElementById('successMessage');
    const emailInput = document.getElementById('email');

    // Auto-fill email if logged in
    auth.onAuthStateChanged(user => {
        if (user && user.email) {
            emailInput.value = user.email;
        }
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        const subject = document.getElementById('subject').value;
        const description = document.getElementById('description').value;
        
        if (description.length < 20) {
            alert("Description must be at least 20 characters.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        try {
            // Fetch IP
            let ip_address = 'unknown';
            try {
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                ip_address = ipData.ip;
            } catch (err) {
                console.warn("Could not fetch IP", err);
            }

            const data = {
                email,
                subject,
                description,
                ip_address,
                timestamp: Date.now(),
                status: 'pending'
            };

            const contactUsRef = dbRef(db, 'contactUs');
            const newContactRef = push(contactUsRef);
            await set(newContactRef, data);

            // Show success
            contactForm.style.display = 'none';
            successMessage.style.display = 'block';

        } catch (error) {
            console.error("Error submitting contact form:", error);
            alert("An error occurred while submitting your message. Please try again.");
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    });
});
