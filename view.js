import { db } from './firebase-config.js';
import { ref, get, remove } from "firebase/database";

document.addEventListener('DOMContentLoaded', async () => {
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
        showError();
        return;
    }

    try {
        const scanRef = ref(db, `scans/${scanId}`);
        const snapshot = await get(scanRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Check expiry
            if (data.expiresAt && Date.now() > data.expiresAt) {
                // Delete from Firebase!
                remove(scanRef);
                showError("This Free-Tier QR Code has expired (72 hours limit) and was deleted.");
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

    function showError(customMessage) {
        loadingState.style.display = 'none';
        successState.style.display = 'none';
        if(passwordState) passwordState.style.display = 'none';
        errorState.style.display = 'block';
        if(customMessage) {
            const errP = errorState.querySelector('p');
            if(errP) errP.textContent = customMessage;
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
            // Document or URL
            // Since we stored it as base64, we can create a download link or display it if it's a URL
            if(data.type === 'document' && data.data.startsWith('data:')) {
                mediaContainer.innerHTML = `
                    <a href="${data.data}" download="${data.filename}" class="doc-download">
                        <i class="ph-fill ph-file-pdf"></i>
                        <div>
                            <strong style="display:block; text-align:left;">Download File</strong>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${data.filename}</span>
                        </div>
                    </a>
                `;
            } else {
                mediaContainer.innerHTML = `
                    <div style="margin-top: 2rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <p style="word-break: break-all;">${data.data}</p>
                    </div>
                `;
            }
        }
    }
});
