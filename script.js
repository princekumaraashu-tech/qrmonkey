import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInAnonymously
} from "firebase/auth";
import { ref as dbRef, push, set, update } from "firebase/database";

document.addEventListener('DOMContentLoaded', () => {
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

    // --- Auth Elements ---
    const loggedOutState = document.getElementById('logged-out-state');
    const loggedInState = document.getElementById('logged-in-state');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navSignupBtn = document.getElementById('nav-signup-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const userEmailDisplay = document.getElementById('user-email-display');
    const navDashboardBtn = document.getElementById('nav-dashboard-btn');
    const heroGetStartedBtn = document.getElementById('hero-get-started-btn');

    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error');
    
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');
    const modalToggleText = document.getElementById('modal-toggle-text');
    const googleSigninBtn = document.getElementById('google-signin-btn');

    let authMode = 'login'; 

    // Handle Redirect Result
    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            window.location.href = '/home.html';
        }
    }).catch((error) => {
        if (authError) {
            authError.textContent = error.message.replace('Firebase: ', '');
            authError.style.display = 'block';
            if (authModal) authModal.style.display = 'flex';
        }
    });

    let userIp = 'unknown';
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => { userIp = data.ip; })
        .catch(() => {});

    // --- Auth Logic ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Redirect logged-in users to home.html if they are on the index page
            const path = window.location.pathname;
            if (path.endsWith('index.html') || path === '/' || path === '') {
                window.location.href = '/home.html';
                return;
            }

            // User is signed in
            if (loggedOutState) loggedOutState.style.display = 'none';
            if (loggedInState) loggedInState.style.display = 'flex';
            if (authModal) authModal.style.display = 'none';

            // Check if user is the admin from Database
            import("firebase/database").then(({ get, child }) => {
                get(child(dbRef(db), `users/${user.uid}/profile`)).then((snapshot) => {
                    let isAdmin = false;
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        isAdmin = true;
                        if (userEmailDisplay) userEmailDisplay.textContent = 'Hello Admin';
                        // Show alert once per session
                        if (!sessionStorage.getItem('adminWelcomed')) {
                            alert('Hello Admin');
                            sessionStorage.setItem('adminWelcomed', 'true');
                        }
                    } else {
                        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
                    }
                }).catch(e => {
                    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
                });
            });

            // Track user in database
            const profileData = {
                email: user.email,
                lastLogin: Date.now(),
                ip_address: userIp
            };
            
            update(dbRef(db, `users/${user.uid}/profile`), profileData)
                .catch(e => console.error("Tracking error", e));

        } else {
            // User is signed out
            if (loggedInState) loggedInState.style.display = 'none';
            if (loggedOutState) loggedOutState.style.display = 'flex';
        }
    });

    const openModal = (mode) => {
        authMode = mode;
        if(authError) authError.style.display = 'none';
        if(authForm) authForm.reset();
        
        if (mode === 'login') {
            modalTitle.textContent = 'Welcome Back';
            modalSubtitle.textContent = 'Log in to your QR Monkey account';
            authSubmitBtn.textContent = 'Log In';
            modalToggleText.innerHTML = `Don't have an account? <span id="toggle-auth-mode">Sign Up</span>`;
        } else {
            modalTitle.textContent = 'Create Account';
            modalSubtitle.textContent = 'Join QR Monkey today';
            authSubmitBtn.textContent = 'Sign Up';
            modalToggleText.innerHTML = `Already have an account? <span id="toggle-auth-mode">Log In</span>`;
        }
        
        document.getElementById('toggle-auth-mode').addEventListener('click', () => {
            openModal(authMode === 'login' ? 'signup' : 'login');
        });

        if(authModal) authModal.style.display = 'flex';
    };

    if(navLoginBtn) navLoginBtn.addEventListener('click', () => openModal('login'));
    if(navSignupBtn) navSignupBtn.addEventListener('click', () => openModal('signup'));
    if(closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.style.display = 'none');
    if(heroGetStartedBtn) heroGetStartedBtn.addEventListener('click', () => {
        if(auth.currentUser) {
            window.location.href = '/home.html';
        } else {
            openModal('signup');
        }
    });
    if(navDashboardBtn) navDashboardBtn.addEventListener('click', () => {
        window.location.href = '/home.html';
    });

    if(authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.style.display = 'none';
            }
        });
    }

    if(navLogoutBtn) {
        navLogoutBtn.addEventListener('click', () => {
            signOut(auth).catch((error) => console.error('Sign out error:', error));
        });
    }

    if(authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = authEmail.value.trim();
            const password = authPassword.value;
            
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = 'Please wait...';
            authError.style.display = 'none';

            if (authMode === 'login') {
                signInWithEmailAndPassword(auth, email, password)
                    .then(() => {
                        window.location.href = '/home.html';
                    })
                    .catch((error) => {
                        authError.textContent = error.message.replace('Firebase: ', '');
                        authError.style.display = 'block';
                    })
                    .finally(() => {
                        authSubmitBtn.disabled = false;
                        authSubmitBtn.textContent = 'Log In';
                    });
            } else {
                createUserWithEmailAndPassword(auth, email, password)
                    .then(() => {
                        window.location.href = '/home.html';
                    })
                    .catch((error) => {
                        authError.textContent = error.message.replace('Firebase: ', '');
                        authError.style.display = 'block';
                    })
                    .finally(() => {
                        authSubmitBtn.disabled = false;
                        authSubmitBtn.textContent = 'Sign Up';
                    });
            }
        });
    }

    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            googleSigninBtn.disabled = true;
            if (authError) authError.style.display = 'none';

            signInWithPopup(auth, provider)
                .then((result) => {
                    window.location.href = '/home.html';
                })
                .catch((error) => {
                    if (error.code === 'auth/popup-blocked') {
                        // Fallback to redirect if popup is blocked
                        signInWithRedirect(auth, provider);
                    } else if (authError) {
                        authError.textContent = error.message.replace('Firebase: ', '');
                        authError.style.display = 'block';
                        googleSigninBtn.disabled = false;
                    }
                });
        });
    }

    // --- Guest QR Generator Logic ---
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
    const shareLink = document.getElementById('share-link');
    const fileHelperText = document.getElementById('file-helper-text');
    const encryptToggle = document.getElementById('encrypt-toggle');
    const passwordContainer = document.getElementById('password-container');

    let currentMode = 'url';
    let selectedFile = null;
    let qrCodeInstance = null;

    if (encryptToggle && passwordContainer) {
        encryptToggle.addEventListener('change', (e) => {
            passwordContainer.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    if(tabs.length > 0 && generateBtn) {
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
                return alert('File size exceeds 10MB limit.');
            }
            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            fileSizeDisplay.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            dropZone.style.display = 'none';
            filePreview.style.display = 'flex';
            resetResult();
        };

        if(dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-active'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-active'), false);
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    handleFile(dt.files[0]);
                }
            });
        }
        if(fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
        if(removeFileBtn) removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            filePreview.style.display = 'none';
            dropZone.style.display = 'block';
            resetResult();
        });

        generateBtn.addEventListener('click', async () => {
            let finalData = '';
            if (currentMode === 'url') {
                finalData = urlInput.value.trim();
                if (!finalData) {
                    alert('Please enter a URL');
                    return;
                }
                const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
                if (!urlRegex.test(finalData)) {
                    alert('Security Warning: Please enter a valid website URL.');
                    return;
                }
                if (!finalData.startsWith('http')) {
                    finalData = 'https://' + finalData;
                }
            } else {
                if (!selectedFile) return alert('Please select a file first.');
                // Read as base64
                finalData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(selectedFile);
                });
            }

            resultPanel.style.display = 'flex';
            qrCodeContainer.style.display = 'none';
            qrActions.style.display = 'none';
            loadingSpinner.style.display = 'flex';
            generateBtn.disabled = true;

            try {
                // Ensure anonymous login if no user
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }

                // Fetch IP and details
                let ipDetails = {};
                try {
                    const ipRes = await fetch('https://ipapi.co/json/');
                    if (ipRes.ok) ipDetails = await ipRes.json();
                } catch(e) { console.warn("Could not fetch IP details"); }

                // Encryption
                const encryptPassword = document.getElementById('encrypt-password');
                let dataToStore = finalData;
                let isEncrypted = false;
                
                if (encryptToggle && encryptToggle.checked) {
                    const pass = encryptPassword.value;
                    if (!pass) throw new Error("Please enter a password for encryption.");
                    dataToStore = CryptoJS.AES.encrypt(finalData, pass).toString();
                    isEncrypted = true;
                }

                const db = getDatabase();
                const scansRef = dbRef(db, `scans`);
                const newScanRef = await push(scansRef, {
                    uid: auth.currentUser.uid,
                    type: currentMode,
                    data: dataToStore,
                    encrypted: isEncrypted,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + (72 * 60 * 60 * 1000), // 72 hours expiry
                    guest: true,
                    ipInfo: ipDetails
                });
                
                const scanId = newScanRef.key;
                
                // Write to Audit Trail
                try {
                    await set(dbRef(db, `qr_logs/${scanId}`), {
                        uid: auth.currentUser.uid,
                        ip_address: ipDetails.ip || 'unknown',
                        timestamp: Date.now()
                    });
                } catch (e) {
                    console.error("Audit log failed", e);
                }

                const viewUrl = window.location.origin + '/view.html?id=' + scanId;
                
                // The QR code is always the viewUrl, ensuring it's scannable
                renderQR(viewUrl);
            } catch (error) {
                alert('Error generating QR: ' + error.message);
                resetResult();
            } finally {
                generateBtn.disabled = false;
            }
        });

        const renderQR = (dataUrl) => {
            loadingSpinner.style.display = 'none';
            qrCodeContainer.style.display = 'block';
            qrCodeContainer.innerHTML = ''; 
            if(shareLink) shareLink.href = dataUrl;

            qrCodeInstance = new QRCodeStyling({
                width: 200,
                height: 200,
                data: dataUrl,
                dotsOptions: {
                    color: "#4f46e5",
                    type: "rounded"
                },
                backgroundOptions: {
                    color: "#ffffff"
                },
                imageOptions: {
                    crossOrigin: "anonymous",
                    margin: 8
                },
                cornersSquareOptions: {
                    type: "extra-rounded",
                    color: "#1e293b"
                }
            });
            qrCodeInstance.append(qrCodeContainer);
            
            const warningDiv = document.createElement('div');
            warningDiv.style = "margin-top: 1rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px dashed var(--error); border-radius: 8px; font-size: 0.85rem; color: var(--error); max-width: 250px; margin-left: auto; margin-right: auto;";
            warningDiv.innerHTML = `⚠️ This QR expires in 72 hours. <a href="#" style="color:var(--primary);font-weight:bold;">Upgrade to Pro</a> to keep it forever.`;
            qrCodeContainer.appendChild(warningDiv);

            setTimeout(() => {
                qrActions.style.display = 'flex';
            }, 100);
        };

        if(downloadBtn) downloadBtn.addEventListener('click', () => {
            const canvas = qrCodeContainer.querySelector('canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'QRMonkey-Guest.png';
            link.href = canvas.toDataURL("image/png");
            link.click();
        });

        if(closeResultBtn) closeResultBtn.addEventListener('click', resetResult);

        function resetResult() {
            if(resultPanel) resultPanel.style.display = 'none';
            if(qrCodeContainer) qrCodeContainer.innerHTML = '';
            if(qrActions) qrActions.style.display = 'none';
            if(qrCodeInstance) qrCodeInstance.clear();
        }
    }
});
