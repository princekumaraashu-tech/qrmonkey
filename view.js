import { db, storage } from './firebase-config.js';
import { ref, get, update } from "firebase/database";
import { ref as storageRef, deleteObject } from "firebase/storage";

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Lottie Loader if container exists
    const lottieContainer = document.getElementById('lottie-loader');
    if (lottieContainer) {
        lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: '/lottie-loading.json'
        });
    }

    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const successState = document.getElementById('success-state');
    const passwordState = document.getElementById('password-state');
    const mediaContainer = document.getElementById('media-container');
    const fileNameDisplay = document.getElementById('file-name-display');

    // Get ID from URL
    const params = new URLSearchParams(window.location.search);
    const scanId = params.get('id');

    if (!scanId) {
        showError("Invalid QR Code Link.");
        return;
    }
    
    // Always show the QR ID badge at the top right
    const qrIdBadge = document.getElementById('qr-id-badge');
    const displayQrId = document.getElementById('display-qr-id');
    if (qrIdBadge && displayQrId) {
        displayQrId.textContent = scanId;
        qrIdBadge.style.display = 'block';
    }

    try {
        const scanRef = ref(db, `scans/${scanId}`);
        const snapshot = await get(scanRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Check expiry or if manually soft-deleted
            if (data.deleted || (data.expiresAt && Date.now() > data.expiresAt)) {
                
                // Soft delete if not already marked
                if (!data.deleted) {
                    if (data.storagePath) {
                        try {
                            await deleteObject(storageRef(storage, data.storagePath));
                        } catch(err) { console.error("Storage delete error", err); }
                    }
                    
                    await update(scanRef, {
                        data: null,
                        storagePath: null,
                        deleted: true,
                        expired: true
                    });
                }

                showError(`Sorry, this QR Code has expired. But this QR ID is <strong>${scanId}</strong>.<br><br>Contact <a href="/" style="color:var(--primary); text-decoration:underline;">QR Monkey</a> for any query.`);
                return;
            }

            if (data.encrypted) {
                showPasswordPrompt(data);
            } else {
                showSuccess(data);
            }
        } else {
            showError();
        }
    } catch (error) {
        console.error("Error fetching scan data:", error);
        showError();
    }

    function showError(message = null) {
        loadingState.style.display = 'none';
        if(passwordState) passwordState.style.display = 'none';
        successState.style.display = 'none';
        errorState.style.display = 'block';
        
        if (message) {
            const errorMsgEl = document.getElementById('error-message');
            if (errorMsgEl) errorMsgEl.innerHTML = message;
        }

        // Show the ID for reporting
        if (scanId) {
            const errorQrIdContainer = document.getElementById('error-qr-id-container');
            const errorQrId = document.getElementById('error-qr-id');
            if (errorQrIdContainer && errorQrId) {
                errorQrId.textContent = scanId;
                errorQrIdContainer.style.display = 'block';
            }
        }
    }

    function showPasswordPrompt(data) {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        successState.style.display = 'none';
        passwordState.style.display = 'block';
        
        const unlockBtn = document.getElementById('unlock-btn');
        unlockBtn.onclick = () => {
            const pass = document.getElementById('unlock-password').value;
            try {
                const decrypted = CryptoJS.AES.decrypt(data.data, pass).toString(CryptoJS.enc.Utf8);
                if(!decrypted) throw new Error("Wrong password");
                data.data = decrypted;
                passwordState.style.display = 'none';
                showSuccess(data);
            } catch(e) {
                alert("Incorrect password! Please try again.");
            }
        }
    }

    function showSuccess(data) {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        if(passwordState) passwordState.style.display = 'none';
        successState.style.display = 'block';

        fileNameDisplay.textContent = data.filename || 'QR Code Content';

        if (data.type === 'image') {
            mediaContainer.innerHTML = `<img src="${data.data}" alt="Scanned Image">`;
        } else {
            if(data.type === 'document' && data.data.startsWith('data:')) {
                mediaContainer.innerHTML = `
                    <a href="${data.data}" download="${data.filename}" class="doc-download">
                        <div class="doc-icon-wrap">
                            <i class="ph-fill ph-file-arrow-down"></i>
                        </div>
                        <div class="doc-info">
                            <strong>Download File</strong>
                            <span>${data.filename}</span>
                        </div>
                        <div class="doc-download-icon">
                            <i class="ph ph-download-simple"></i>
                        </div>
                    </a>
                `;
            } else {
                mediaContainer.innerHTML = `
                    <div class="text-content-box">
                        <p>${data.data}</p>
                    </div>
                `;
            }
        }
    }
});
