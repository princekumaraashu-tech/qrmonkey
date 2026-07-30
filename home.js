import { auth, storage, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ref as dbRef, push, onValue, remove } from "firebase/database";
import { compressImage } from './compression.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Guard
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // Not logged in, redirect to landing page
            window.location.href = '/index.html';
        } else {
            // Populate profile
            const profileEmail = document.getElementById('profile-email');
            const profileCreated = document.getElementById('profile-created');
            
            if (profileEmail) profileEmail.textContent = user.email;
            if (profileCreated && user.metadata.creationTime) {
                profileCreated.textContent = new Date(user.metadata.creationTime).toLocaleDateString();
            }

            // Fetch History
            const historyRef = dbRef(db, `users/${user.uid}/history`);
            onValue(historyRef, (snapshot) => {
                const historyContainer = document.getElementById('history-container');
                const historyEmpty = document.getElementById('history-empty');
                if(!historyContainer) return;

                historyContainer.innerHTML = '';
                const data = snapshot.val();

                if (data) {
                    historyEmpty.style.display = 'none';
                    // Convert to array and reverse for newest first
                    const items = Object.entries(data).reverse();
                    
                    items.forEach(([key, item]) => {
                        // Cleanup logic: 72 hours expiry for files and images
                        const age = Date.now() - item.timestamp;
                        if (age > 72 * 60 * 60 * 1000 && item.type !== 'url') {
                            // Delete from history
                            remove(dbRef(db, `users/${user.uid}/history/${key}`));
                            // Try to extract scanId and delete from scans/
                            try {
                                if (item.originalData && item.originalData.includes('view.html?id=')) {
                                    const scanId = item.originalData.split('view.html?id=')[1];
                                    if(scanId) remove(dbRef(db, `scans/${scanId}`));
                                }
                            } catch(e) {}
                            return; // Don't render this item
                        }

                        const card = document.createElement('div');
                        card.className = 'flip-card';
                        
                        let thumbHtml = '';
                        if (item.type === 'url') {
                            thumbHtml = `<i class="ph ph-link history-icon"></i>`;
                        } else if (item.type === 'image') {
                            thumbHtml = `<img src="${item.thumbUrl}" class="history-thumb">`;
                        } else {
                            thumbHtml = `<i class="ph ph-file-text history-icon"></i>`;
                        }

                        card.innerHTML = `
                            <div class="flip-card-inner">
                                <div class="flip-card-front">
                                    ${thumbHtml}
                                    <div class="history-info">${item.type === 'url' ? item.originalData : 'File/Image'}</div>
                                    <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
                                </div>
                                <div class="flip-card-back">
                                    <img src="${item.qrDataUrl}" class="history-qr">
                                    <div class="history-date">Scan Me</div>
                                </div>
                            </div>
                        `;
                        
                        card.addEventListener('click', () => {
                            card.classList.toggle('flipped');
                        });
                        
                        historyContainer.appendChild(card);
                    });
                } else {
                    historyEmpty.style.display = 'block';
                }
            });
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = '/index.html';
            });
        });
    }

    // --- Sidebar Navigation ---
    const sideBtns = document.querySelectorAll('.side-btn[data-view]');
    const views = document.querySelectorAll('.dashboard-view');

    sideBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            sideBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update views
            const viewId = 'view-' + btn.dataset.view;
            views.forEach(v => {
                v.classList.remove('active');
                if (v.id === viewId) v.classList.add('active');
            });
        });
    });

    // --- QR Generator Logic (Same as before) ---
    const tabs = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.input-section');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file');
    const urlInput = document.getElementById('url-input');
    const generateBtn = document.getElementById('generate-btn');
    const resultPanel = document.getElementById('result-panel');
    const closeResultBtn = document.getElementById('close-result');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const qrActions = document.getElementById('qr-actions');
    const downloadBtn = document.getElementById('download-btn');
    const shareQrBtn = document.getElementById('share-qr-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const shareLink = document.getElementById('share-link');
    const fileHelperText = document.getElementById('file-helper-text');

    let currentMode = 'url';
    let selectedFile = null;
    let qrCodeInstance = null;

    if(tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                currentMode = tab.dataset.tab;
                
                sections.forEach(s => s.classList.remove('active'));
                if (currentMode === 'url') {
                    document.getElementById('url-section').classList.add('active');
                } else {
                    document.getElementById('file-section').classList.add('active');
                    
                    if (currentMode === 'image') {
                        fileHelperText.textContent = 'Supports JPG, PNG, GIF, WebP (Max 10MB)';
                        fileInput.accept = 'image/*';
                    } else {
                        fileHelperText.textContent = 'Supports PDF, DOCX, TXT, CSV (Max 10MB)';
                        fileInput.accept = '.pdf,.doc,.docx,.txt,.csv,.xlsx';
                    }
                }
                resetResult();
            });
        });

        const handleFile = (file) => {
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('File size exceeds 10MB limit.');
                return;
            }
            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            fileSizeDisplay.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            dropZone.style.display = 'none';
            filePreview.style.display = 'flex';
            resetResult();
        };

        dropZone.addEventListener('click', (e) => {
            if (e.target !== fileInput) fileInput.click();
        });

        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault(); e.stopPropagation();
            }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });
        dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

        removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            filePreview.style.display = 'none';
            dropZone.style.display = 'block';
            resetResult();
        });

        urlInput.addEventListener('input', resetResult);

        generateBtn.addEventListener('click', async () => {
            let finalUrl = '';
            if (currentMode === 'url') {
                finalUrl = urlInput.value.trim();
                if (!finalUrl) return alert('Please enter a valid URL');
                
                const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
                if (!urlRegex.test(finalUrl)) {
                    alert('Security Warning: Please enter a valid website URL.');
                    return;
                }
                
                if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                    finalUrl = 'https://' + finalUrl;
                }
                processAndRenderQR(finalUrl);
            } else {
                if (!selectedFile) return alert('Please select a file first.');
                await uploadAndRenderQR(selectedFile);
            }
        });

        const processAndRenderQR = async (dataUrl) => {
            const encryptToggle = document.getElementById('encrypt-toggle');
            const encryptPassword = document.getElementById('encrypt-password');

            if (encryptToggle && encryptToggle.checked) {
                const password = encryptPassword.value;
                if (!password) return alert("Please enter a password to encrypt the data.");
                
                try {
                    // Always store encrypted data in DB to make QR scannable via view.html
                    const encrypted = CryptoJS.AES.encrypt(dataUrl, password).toString();
                    
                    const scansRef = dbRef(db, `scans`);
                    const newScanRef = push(scansRef, {
                        uid: auth.currentUser ? auth.currentUser.uid : 'guest',
                        type: currentMode,
                        data: encrypted,
                        encrypted: true,
                        timestamp: Date.now(),
                        expiresAt: Date.now() + (72 * 60 * 60 * 1000) // 72 hours expiry
                    });
                    
                    const viewUrl = window.location.origin + '/view.html?id=' + newScanRef.key;
                    renderQR(viewUrl, dataUrl); // Render the viewUrl in QR
                } catch (e) {
                    alert("Encryption failed. " + e.message);
                }
            } else {
                renderQR(dataUrl, dataUrl);
            }
        };

        const saveToHistory = (type, originalData, qrDataUrl, thumbUrl) => {
            if(!auth.currentUser) return;
            const historyRef = dbRef(db, `users/${auth.currentUser.uid}/history`);
            push(historyRef, {
                type,
                originalData,
                qrDataUrl,
                thumbUrl: thumbUrl || null,
                timestamp: Date.now()
            });
        };

        const uploadAndRenderQR = async (file) => {
            resultPanel.style.display = 'flex';
            qrCodeContainer.style.display = 'none';
            qrActions.style.display = 'none';
            loadingSpinner.style.display = 'flex';
            generateBtn.disabled = true;

            try {
                if (!auth.currentUser) throw new Error("Must be logged in to upload files.");
                
                let base64Data = '';
                
                // Compress if image, else read as base64
                if (currentMode === 'image') {
                    // Increased resolution to 1080x1080 and quality to 0.8 for better clarity
                    base64Data = await compressImage(file, 1080, 1080, 0.8); 
                } else {
                    // For documents, we convert to base64, but be careful with size!
                    // The user requested to store it all in DB to save Storage.
                    base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                // Push to Realtime Database instead of Storage
                const scansRef = dbRef(db, `scans`);
                const newScanRef = push(scansRef, {
                    uid: auth.currentUser.uid,
                    type: currentMode,
                    filename: file.name,
                    data: base64Data,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + (72 * 60 * 60 * 1000) // 72 hours expiry
                });
                
                const scanId = newScanRef.key;
                
                // Use a global to store thumb temporarily for saveToHistory
                window.lastThumbUrl = currentMode === 'image' ? base64Data : '';
                
                // Generate URL pointing to our view page
                const viewUrl = window.location.origin + '/view.html?id=' + scanId;
                
                processAndRenderQR(viewUrl);
            } catch (error) {
                console.error(error);
                alert('Failed to process file. ' + error.message);
                resetResult();
            } finally {
                generateBtn.disabled = false;
            }
        };

        const renderQR = (dataUrl, originalUrl) => {
            resultPanel.style.display = 'flex';
            loadingSpinner.style.display = 'none';
            qrCodeContainer.style.display = 'block';
            qrCodeContainer.innerHTML = ''; 
            shareLink.href = originalUrl || dataUrl;

            qrCodeInstance = new QRCode(qrCodeContainer, {
                text: dataUrl, width: 200, height: 200,
                colorDark : "#0f172a", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
            });
            
            const warningDiv = document.createElement('div');
            warningDiv.style = "margin-top: 1rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px dashed var(--error); border-radius: 8px; font-size: 0.85rem; color: var(--error); max-width: 250px; margin-left: auto; margin-right: auto;";
            warningDiv.innerHTML = `⚠️ This QR expires in 72 hours. <a href="#" style="color:var(--primary);font-weight:bold;">Upgrade to Pro</a> to keep it forever.`;
            qrCodeContainer.appendChild(warningDiv);

            setTimeout(() => {
                qrActions.style.display = 'flex';
                resultPanel.scrollIntoView({ behavior: 'smooth', block: 'end' });
                
                // Save to history after generating
                const canvas = qrCodeContainer.querySelector('canvas');
                if (canvas) {
                    saveToHistory(
                        currentMode, 
                        currentMode === 'url' ? urlInput.value : selectedFile.name, 
                        canvas.toDataURL("image/png"), 
                        window.lastThumbUrl || ''
                    );
                    window.lastThumbUrl = null;
                }
            }, 100);
        };

        downloadBtn.addEventListener('click', () => {
            const canvas = qrCodeContainer.querySelector('canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'QRMonkey-Code.png';
            link.href = canvas.toDataURL("image/png");
            link.click();
        });

        if (shareQrBtn) {
            shareQrBtn.addEventListener('click', async () => {
                const canvas = qrCodeContainer.querySelector('canvas');
                if (!canvas) return;
                
                try {
                    canvas.toBlob(async (blob) => {
                        const file = new File([blob], 'qrmonkey.png', { type: 'image/png' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                title: 'QR Monkey',
                                text: 'Here is my QR Code!',
                                files: [file]
                            });
                        } else {
                            alert('Sharing images is not supported on this device/browser.');
                        }
                    }, 'image/png');
                } catch (err) {
                    console.error("Error sharing:", err);
                }
            });
        }

        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', async () => {
                const url = shareLink.href;
                if (!url || url === '#' || url === window.location.href + '#') return alert('No link generated yet.');
                
                try {
                    await navigator.clipboard.writeText(url);
                    const originalText = copyLinkBtn.innerHTML;
                    copyLinkBtn.innerHTML = `<i class="ph ph-check"></i> Copied!`;
                    setTimeout(() => {
                        copyLinkBtn.innerHTML = originalText;
                    }, 2000);
                } catch (err) {
                    alert('Failed to copy link. Please manually copy the URL.');
                }
            });
        }

        closeResultBtn.addEventListener('click', resetResult);

        function resetResult() {
            resultPanel.style.display = 'none';
            qrCodeContainer.innerHTML = '';
            qrActions.style.display = 'none';
            if(qrCodeInstance) qrCodeInstance.clear();
        }
    }

    // --- Decryption Logic ---
    const decryptBtn = document.getElementById('decrypt-btn');
    const decryptData = document.getElementById('decrypt-data');
    const decryptPassword = document.getElementById('decrypt-password');
    const decryptResult = document.getElementById('decrypt-result');
    const decryptError = document.getElementById('decrypt-error');
    const decryptedText = document.getElementById('decrypted-text');

    if (decryptBtn) {
        decryptBtn.addEventListener('click', () => {
            decryptResult.style.display = 'none';
            decryptError.style.display = 'none';
            
            let data = decryptData.value.trim();
            const password = decryptPassword.value;

            if (!data || !password) {
                return alert("Please enter both encrypted data and password.");
            }

            if (data.startsWith('qrmonkey:enc:')) {
                data = data.replace('qrmonkey:enc:', '');
            }

            try {
                const bytes = CryptoJS.AES.decrypt(data, password);
                const originalText = bytes.toString(CryptoJS.enc.Utf8);

                if (originalText) {
                    decryptedText.textContent = originalText;
                    if (originalText.startsWith('http')) {
                        decryptedText.href = originalText;
                        decryptedText.style.textDecoration = "underline";
                    } else {
                        decryptedText.removeAttribute('href');
                        decryptedText.style.textDecoration = "none";
                    }
                    decryptResult.style.display = 'block';
                } else {
                    decryptError.style.display = 'block';
                }
            } catch (e) {
                decryptError.style.display = 'block';
            }
        });
    }
    
    // Toggle Password Input Visibility
    const encryptToggle = document.getElementById('encrypt-toggle');
    const passwordContainer = document.getElementById('password-container');
    if(encryptToggle && passwordContainer) {
        encryptToggle.addEventListener('change', (e) => {
            passwordContainer.style.display = e.target.checked ? 'block' : 'none';
        });
    }
});
