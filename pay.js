import { auth, db } from './firebase-config.js';
import { ref as dbRef, update, get, child } from 'firebase/database';

const RAZORPAY_KEY_ID = 'rzp_live_T0c2ezq8B8v1nA';

document.addEventListener('DOMContentLoaded', () => {
    const buySingleBtn = document.getElementById('buy-single-qr-btn');
    const buyProBtn = document.getElementById('buy-pro-plan-btn');

    if (buySingleBtn) {
        buySingleBtn.addEventListener('click', () => initiatePayment(1, 'Single QR Code', 'One-time purchase for a permanent QR code'));
    }

    if (buyProBtn) {
        buyProBtn.addEventListener('click', () => initiatePayment(299, 'Pro Monthly Subscription', 'Unlimited permanent QR codes for 1 month'));
    }
});

export function initiatePayment(amountINR, name, description, scanId = null) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please login first to make a purchase.");
        window.location.href = '/index.html';
        return;
    }

    // Razorpay works with paise (amount * 100)
    const amountPaise = amountINR * 100;

    const options = {
        "key": RAZORPAY_KEY_ID,
        "amount": amountPaise.toString(),
        "currency": "INR",
        "name": "QR Monkey",
        "description": description,
        "image": "/logo.png",
        "handler": async function (response) {
            // Payment successful
            try {
                console.log("Payment successful:", response.razorpay_payment_id);
                
                await handleSuccessfulPayment(amountINR, response.razorpay_payment_id, scanId);
                
                alert(`Payment Successful! Thank you for purchasing ${name}.`);
                
                // Refresh UI or redirect
                window.location.reload();
            } catch (error) {
                console.error("Error updating user status:", error);
                alert("Payment was successful, but there was an error updating your account. Please contact support with Payment ID: " + response.razorpay_payment_id);
            }
        },
        "prefill": {
            "name": user.displayName || "QR Monkey User",
            "email": user.email,
        },
        "theme": {
            "color": "#6366f1" // primary color
        }
    };

    const rzp = new window.Razorpay(options);
    
    rzp.on('payment.failed', function (response){
        console.error("Payment failed:", response.error);
        alert("Payment Failed: " + response.error.description);
    });

    rzp.open();
}

async function handleSuccessfulPayment(amountINR, paymentId, scanId = null) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const userRef = dbRef(db, `users/${user.uid}`);
    
    if (amountINR === 1) {
        // Fetch current credits to increment
        const snapshot = await get(child(dbRef(db), `users/${user.uid}/permanentQRCredits`));
        let credits = snapshot.exists() ? snapshot.val() : 0;

        await update(userRef, {
            permanentQRCredits: credits + 1,
            lastPaymentId: paymentId
        });
        
        // If a specific QR code is being made permanent
        if (scanId) {
            const scanRef = dbRef(db, `scans/${scanId}`);
            await update(scanRef, {
                permanent: true,
                expiresAt: null
            });
        }
    } else if (amountINR === 299) {
        // Pro subscription
        await update(userRef, {
            plan: 'pro',
            proSince: new Date().toISOString(),
            lastPaymentId: paymentId
        });
    }
}
