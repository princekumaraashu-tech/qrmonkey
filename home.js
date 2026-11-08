import { auth, storage, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, deleteUser } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { ref as dbRef, push, onValue, remove, set, update, get } from "firebase/database";
import { compressImage } from './compression.js';
import jsQR from 'jsqr';
import { initiatePayment } from './pay.js';

document.addEventListener('DOMContentLoaded', () => {
    // Guest Tracking Logic
    let guestId = localStorage.getItem('guest_device_id');
    if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('guest_device_id', guestId);
    }
    window.guestDeviceId = guestId;

    // Fetch User IP dynamically
    window.userIp = 'unknown';
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => { window.userIp = data.ip; })
        .catch(err => console.error("Could not fetch IP", err));

    // ===== QR Design Studio — Full Customizer =====

    // Default state
    window.qrCustomizerState = {
        dotType: 'rounded',
        dotColor: '#4f46e5',
        cornerSquareType: 'extra-rounded',
        cornerSquareColor: '#1e293b',
        cornerDotType: 'dot',
        cornerDotColor: '#1e293b',
        bgColor: '#ffffff',
        bgTransparent: false,
        bgImage: null,      // base64
        bgImageOpacity: 30,
        logoImage: null,    // base64
        logoSize: 20,
        frameBg: 'none',
        frameBgColor: '#0f172a',
        framePadding: 20,
        frameRadius: 12,
        qrSize: 250,
        errorCorrection: 'M',
        customShape: null // 'heart', 'diamond', 'triangle', or null
    };

    // Quick Templates
    const quickTemplates = [
        { name: 'Standard', dotType: 'rounded', dotColor: '#4f46e5', cornerSquareType: 'extra-rounded', cornerSquareColor: '#1e293b', cornerDotType: 'dot', cornerDotColor: '#1e293b', bgColor: '#ffffff', frameBg: 'none' },
        { name: 'Dark Neon', dotType: 'dots', dotColor: '#00ff88', cornerSquareType: 'dot', cornerSquareColor: '#00ff88', cornerDotType: 'dot', cornerDotColor: '#00ff88', bgColor: '#0f172a', frameBg: '#0f172a' },
        { name: 'Pastel', dotType: 'classy-rounded', dotColor: '#8b5cf6', cornerSquareType: 'extra-rounded', cornerSquareColor: '#7c3aed', cornerDotType: 'dot', cornerDotColor: '#7c3aed', bgColor: '#faf5ff', frameBg: '#ede9fe' },
        { name: 'Love', dotType: 'extra-rounded', dotColor: '#ef4444', cornerSquareType: 'dot', cornerSquareColor: '#b91c1c', cornerDotType: 'dot', cornerDotColor: '#b91c1c', bgColor: '#fff1f2', frameBg: '#ffe4e6' },
        { name: 'Ocean', dotType: 'rounded', dotColor: '#0ea5e9', cornerSquareType: 'extra-rounded', cornerSquareColor: '#0284c7', cornerDotType: 'dot', cornerDotColor: '#0284c7', bgColor: '#f0f9ff', frameBg: '#e0f2fe' },
        { name: 'Midnight', dotType: 'classy', dotColor: '#e2e8f0', cornerSquareType: 'square', cornerSquareColor: '#94a3b8', cornerDotType: 'square', cornerDotColor: '#94a3b8', bgColor: '#020617', frameBg: '#020617' },
        { name: 'Cyberpunk', dotType: 'square', dotColor: '#f97316', cornerSquareType: 'square', cornerSquareColor: '#eab308', cornerDotType: 'square', cornerDotColor: '#f97316', bgColor: '#111827', frameBg: '#1f2937' },
        { name: 'Minimal', dotType: 'dots', dotColor: '#171717', cornerSquareType: 'dot', cornerSquareColor: '#171717', cornerDotType: 'dot', cornerDotColor: '#171717', bgColor: '#f5f5f5', frameBg: 'none' },
        { name: 'Card/Ikka', dotType: 'classy', dotColor: '#dc2626', cornerSquareType: 'extra-rounded', cornerSquareColor: '#000000', cornerDotType: 'dot', cornerDotColor: '#dc2626', bgColor: '#ffffff', frameBg: '#fecaca' },
        { name: 'Diamond', dotType: 'classy-rounded', dotColor: '#06b6d4', cornerSquareType: 'dot', cornerSquareColor: '#0891b2', cornerDotType: 'dot', cornerDotColor: '#0891b2', bgColor: '#ecfeff', frameBg: 'none' }
    ];

    // --- Render Quick Template Bar ---
    const templateBar = document.getElementById('template-quick-bar');
    if (templateBar) {
        quickTemplates.forEach((tpl, i) => {
            const btn = document.createElement('button');
            btn.className = `template-quick-btn ${i === 0 ? 'active' : ''}`;
            btn.innerHTML = `
                <div class="tpl-preview" style="background: ${tpl.frameBg === 'none' ? tpl.bgColor : tpl.frameBg};">
                    <div class="tpl-dot" style="background: ${tpl.dotColor};"></div>
                </div>
                <span>${tpl.name}</span>
            `;
            btn.addEventListener('click', () => {
                templateBar.querySelectorAll('.template-quick-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyTemplate(tpl);
            });
            templateBar.appendChild(btn);
        });
    }

    function applyTemplate(tpl) {
        const s = window.qrCustomizerState;
        s.dotType = tpl.dotType;
        s.dotColor = tpl.dotColor;
        s.cornerSquareType = tpl.cornerSquareType;
        s.cornerSquareColor = tpl.cornerSquareColor;
        s.cornerDotType = tpl.cornerDotType;
        s.cornerDotColor = tpl.cornerDotColor;
        s.bgColor = tpl.bgColor;
        s.bgTransparent = false;
        if (tpl.frameBg === 'none') {
            s.frameBg = 'none';
        } else {
            s.frameBg = tpl.frameBg;
            s.frameBgColor = tpl.frameBg;
        }
        syncControlsToState();
        renderStudioPreview();
    }

    function syncControlsToState() {
        const s = window.qrCustomizerState;
        // Sync color pickers
        setVal('dot-color', s.dotColor); setVal('dot-color-text', s.dotColor);
        setVal('corner-sq-color', s.cornerSquareColor); setVal('corner-sq-color-text', s.cornerSquareColor);
        setVal('corner-dot-color', s.cornerDotColor); setVal('corner-dot-color-text', s.cornerDotColor);
        setVal('qr-bg-color', s.bgColor); setVal('qr-bg-color-text', s.bgColor);
        setChecked('qr-bg-transparent', s.bgTransparent);
        setVal('frame-bg-color', s.frameBgColor); setVal('frame-bg-color-text', s.frameBgColor);
        setChecked('frame-bg-none', s.frameBg === 'none');
        setVal('frame-padding', s.framePadding); setText('frame-padding-val', s.framePadding);
        setVal('frame-radius', s.frameRadius); setText('frame-radius-val', s.frameRadius);
        setVal('qr-size', s.qrSize); setText('qr-size-val', s.qrSize);
        setVal('bg-image-opacity', s.bgImageOpacity); setText('bg-opacity-val', s.bgImageOpacity);
        setVal('logo-size', s.logoSize); setText('logo-size-val', s.logoSize);
        // Sync style grids
        setActiveInGrid('dot-style-grid', s.dotType);
        setActiveInGrid('corner-sq-style-grid', s.cornerSquareType);
        setActiveInGrid('corner-dot-style-grid', s.cornerDotType);
        // Error correction
        const ecSelect = document.getElementById('qr-error-correction');
        if (ecSelect) ecSelect.value = s.errorCorrection;
    }

    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
    function setChecked(id, val) { const el = document.getElementById(id); if (el) el.checked = val; }
    function setActiveInGrid(gridId, value) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.style-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }

    // --- Studio Live Preview ---
    let studioQRInstance = null;
    let renderTimeout = null;

    function renderStudioPreview() {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(_doRender, 200);
    }

    function _doRender() {
        const container = document.getElementById('studio-preview-qr');
        const frame = document.getElementById('studio-preview-frame');
        const bgOverlay = document.getElementById('studio-preview-bg-overlay');
        const emptyMsg = document.getElementById('studio-empty-msg');
        if (!container || !frame) return;

        const s = window.qrCustomizerState;
        const previewUrl = document.getElementById('studio-preview-url');
        const data = window._studioQRData || (previewUrl && previewUrl.value.trim()) || '';

        // Show empty state if no data
        if (!data) {
            container.innerHTML = '';
            if (emptyMsg) {
                container.appendChild(emptyMsg);
                emptyMsg.style.display = 'block';
            }
            updateScanScore(0, 'none');
            return;
        }
        // Hide empty message
        if (emptyMsg) emptyMsg.style.display = 'none';

        // Frame styling
        if (s.frameBg === 'none') {
            frame.style.background = 'transparent';
            frame.style.padding = '10px';
        } else {
            frame.style.background = s.frameBgColor || s.frameBg;
            frame.style.padding = s.framePadding + 'px';
        }
        frame.style.borderRadius = s.frameRadius + 'px';

        // Background image overlay (FIXED: use dedicated overlay div with proper opacity)
        if (bgOverlay) {
            if (s.bgImage) {
                bgOverlay.style.backgroundImage = `url(${s.bgImage})`;
                bgOverlay.style.opacity = s.bgImageOpacity / 100;
                bgOverlay.style.display = 'block';
            } else {
                bgOverlay.style.backgroundImage = 'none';
                bgOverlay.style.opacity = 0;
                bgOverlay.style.display = 'none';
            }
        }

        // QR container background — transparent when bg image is present so dots overlay on image
        container.style.background = (s.bgTransparent || s.bgImage) ? 'transparent' : s.bgColor;
        container.style.boxShadow = (s.bgTransparent && !s.bgImage) ? 'none' : '0 4px 12px rgba(0,0,0,0.15)';

        // Clear old QR
        container.innerHTML = '';
        if (studioQRInstance) { try { studioQRInstance.clear(); } catch(e) {} }

        // Build QR options
        const qrOpts = {
            width: s.qrSize,
            height: s.qrSize,
            type: 'svg',
            data: data,
            dotsOptions: { color: s.dotColor, type: s.dotType },
            backgroundOptions: { color: (s.bgTransparent || s.bgImage) ? 'transparent' : s.bgColor },
            cornersSquareOptions: { type: s.cornerSquareType, color: s.cornerSquareColor },
            cornersDotOptions: { type: s.cornerDotType, color: s.cornerDotColor },
            imageOptions: { crossOrigin: 'anonymous', margin: Math.round(s.qrSize * 0.03) },
            qrOptions: { errorCorrectionLevel: s.errorCorrection }
        };

        // Center logo
        if (s.logoImage) {
            qrOpts.image = s.logoImage;
            qrOpts.imageOptions.imageSize = s.logoSize / 100;
        }

        studioQRInstance = new QRCodeStyling(qrOpts);
        studioQRInstance.append(container);

        // Apply custom shape CSS filter if set
        if (s.customShape) {
            setTimeout(() => applyCustomShapeFilter(container, s.customShape), 50);
        }

        // Run scanability check after render settles
        setTimeout(() => checkScanability(container, data), 400);
    }

    // Custom shape visual filter via SVG filter overlay
    function applyCustomShapeFilter(container, shape) {
        const svg = container.querySelector('svg');
        if (!svg) return;

        // Add a unique defs section with a custom filter pattern
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.insertBefore(defs, svg.firstChild);
        }

        // Remove old custom pattern
        const old = defs.querySelector('#custom-dot-pattern');
        if (old) old.remove();

        // Create repeating pattern based on shape
        const patternSize = 7; // matches approximate module size
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'custom-dot-pattern');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', patternSize);
        pattern.setAttribute('height', patternSize);

        const shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const half = patternSize / 2;
        const full = patternSize;

        if (shape === 'heart') {
            // Heart path scaled to pattern
            shapeEl.setAttribute('d', `M${half} ${full*0.35} C${half} ${full*0.15}, ${full*0.05} ${full*0.15}, ${full*0.05} ${full*0.4} C${full*0.05} ${full*0.65}, ${half} ${full*0.85}, ${half} ${full*0.85} C${half} ${full*0.85}, ${full*0.95} ${full*0.65}, ${full*0.95} ${full*0.4} C${full*0.95} ${full*0.15}, ${half} ${full*0.15}, ${half} ${full*0.35}Z`);
        } else if (shape === 'diamond') {
            shapeEl.setAttribute('d', `M${half} ${full*0.05} L${full*0.95} ${half} L${half} ${full*0.95} L${full*0.05} ${half} Z`);
        } else if (shape === 'triangle') {
            shapeEl.setAttribute('d', `M${half} ${full*0.05} L${full*0.95} ${full*0.95} L${full*0.05} ${full*0.95} Z`);
        }
        shapeEl.setAttribute('fill', 'white');

        // Black background + white shape = mask
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', patternSize);
        bgRect.setAttribute('height', patternSize);
        bgRect.setAttribute('fill', 'black');

        pattern.appendChild(bgRect);
        pattern.appendChild(shapeEl);
        defs.appendChild(pattern);

        // Create mask using the pattern
        let mask = defs.querySelector('#custom-dot-mask');
        if (mask) mask.remove();
        mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.setAttribute('id', 'custom-dot-mask');
        
        const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        maskRect.setAttribute('width', '100%');
        maskRect.setAttribute('height', '100%');
        maskRect.setAttribute('fill', 'url(#custom-dot-pattern)');
        mask.appendChild(maskRect);
        defs.appendChild(mask);

        // Apply mask to the QR dots layer (first child group after defs)
        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            // Don't mask the corner patterns (finder patterns)
            if (!g.querySelector('rect[width="7"]') && !g.querySelector('rect[rx="7"]')) {
                g.setAttribute('mask', 'url(#custom-dot-mask)');
            }
        });
    }

    // ===== Scanability Checker (Heuristic Logic) =====
    async function checkScanability(container, expectedData) {
        try {
            let score = 100;
            let status = 'perfect';
            
            // 1. Data Density Penalty
            const dataLength = expectedData ? expectedData.length : 0;
            if (dataLength > 100) {
                // Subtract 2 points for every 50 characters over 100
                score -= Math.floor((dataLength - 100) / 50) * 2;
            }

            // 2. Settings Penalties
            const s = window.qrCustomizerState || {};
            
            // Error Correction
            if (s.errorCorrection === 'L') score -= 15;
            else if (s.errorCorrection === 'M') score -= 5;
            else if (s.errorCorrection === 'H') score = Math.min(100, score + 5);

            // Logo Penalties
            if (s.logoImage) {
                const size = s.logoSize || 0;
                if (size > 40) score -= 30; // Very dangerous size
                else if (size > 30) score -= 15;
                else score -= 5;
            }

            // Background / Contrast Penalties
            if (s.bgImage && s.bgImageOpacity > 70) score -= 15;
            
            // Hard caps
            score = Math.max(0, Math.min(100, score));

            if (score >= 90) status = 'perfect';
            else if (score >= 70) status = 'warning';
            else status = 'fail';

            updateScanScore(score, status);
        } catch(e) {
            console.error('Scanability check error:', e);
            updateScanScore(0, 'error');
        }
    }

    function updateScanScore(score, status) {
        const bar = document.getElementById('scan-score-bar');
        const text = document.getElementById('scan-score-text');
        const hint = document.getElementById('scan-score-hint');
        if (!bar || !text || !hint) return;

        if (status === 'none') {
            bar.style.width = '0%';
            text.textContent = '—';
            text.style.color = 'var(--text-muted)';
            hint.textContent = 'Generate a QR to check scan quality';
            return;
        }

        bar.style.width = score + '%';
        text.textContent = score + '%';

        if (score >= 90) {
            bar.style.background = '#10b981';
            text.style.color = '#10b981';
            hint.textContent = '✅ Excellent! QR scans perfectly.';
        } else if (score >= 70) {
            bar.style.background = '#f59e0b';
            text.style.color = '#f59e0b';
            hint.textContent = '⚠️ Acceptable. Consider increasing Error Correction or reducing logo size.';
        } else if (score > 0) {
            bar.style.background = '#ef4444';
            text.style.color = '#ef4444';
            hint.textContent = '❌ Poor scan quality. Increase contrast, reduce logo, or set Error Correction to High.';
        } else {
            bar.style.background = '#ef4444';
            text.style.color = '#ef4444';
            hint.textContent = status === 'error' ? '⚠️ Could not analyze. Try adjusting settings.' : '❌ QR is not scannable! Increase contrast or reduce customization.';
        }
    }

    // --- Wire up all controls ---
    function setupStyleGrid(gridId, stateKey) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.style-option').forEach(btn => {
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.style-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.qrCustomizerState[stateKey] = btn.dataset.value;
                renderStudioPreview();
            });
        });
    }

    function setupColorPicker(colorId, textId, stateKey) {
        const picker = document.getElementById(colorId);
        const textInput = document.getElementById(textId);
        if (picker) {
            picker.addEventListener('input', () => {
                window.qrCustomizerState[stateKey] = picker.value;
                if (textInput) textInput.value = picker.value;
                renderStudioPreview();
            });
        }
        if (textInput) {
            textInput.addEventListener('change', () => {
                let val = textInput.value.trim();
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    window.qrCustomizerState[stateKey] = val;
                    if (picker) picker.value = val;
                    renderStudioPreview();
                }
            });
        }
    }

    function setupRangeSlider(sliderId, valId, stateKey, isInt = true) {
        const slider = document.getElementById(sliderId);
        const valEl = document.getElementById(valId);
        if (slider) {
            slider.addEventListener('input', () => {
                const v = isInt ? parseInt(slider.value) : parseFloat(slider.value);
                window.qrCustomizerState[stateKey] = v;
                if (valEl) valEl.textContent = v;
                renderStudioPreview();
            });
        }
    }

    // Style grids
    // Special handling for dot-style-grid to capture custom shapes
    const dotGrid = document.getElementById('dot-style-grid');
    if (dotGrid) {
        dotGrid.querySelectorAll('.style-option').forEach(btn => {
            btn.addEventListener('click', () => {
                dotGrid.querySelectorAll('.style-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.qrCustomizerState.dotType = btn.dataset.value;
                window.qrCustomizerState.customShape = btn.dataset.customShape || null;
                renderStudioPreview();
            });
        });
    }
    setupStyleGrid('corner-sq-style-grid', 'cornerSquareType');
    setupStyleGrid('corner-dot-style-grid', 'cornerDotType');

    // Color pickers
    setupColorPicker('dot-color', 'dot-color-text', 'dotColor');
    setupColorPicker('corner-sq-color', 'corner-sq-color-text', 'cornerSquareColor');
    setupColorPicker('corner-dot-color', 'corner-dot-color-text', 'cornerDotColor');
    setupColorPicker('qr-bg-color', 'qr-bg-color-text', 'bgColor');
    setupColorPicker('frame-bg-color', 'frame-bg-color-text', 'frameBgColor');

    // Transparent toggle
    const bgTransToggle = document.getElementById('qr-bg-transparent');
    if (bgTransToggle) {
        bgTransToggle.addEventListener('change', () => {
            window.qrCustomizerState.bgTransparent = bgTransToggle.checked;
            renderStudioPreview();
        });
    }

    // Frame none toggle
    const frameNoneToggle = document.getElementById('frame-bg-none');
    if (frameNoneToggle) {
        frameNoneToggle.addEventListener('change', () => {
            window.qrCustomizerState.frameBg = frameNoneToggle.checked ? 'none' : window.qrCustomizerState.frameBgColor;
            renderStudioPreview();
        });
    }

    // Frame bg color — also update frameBg state if not "none"
    const frameBgColorPicker = document.getElementById('frame-bg-color');
    if (frameBgColorPicker) {
        const origHandler = frameBgColorPicker.oninput;
        frameBgColorPicker.addEventListener('input', () => {
            if (!frameNoneToggle || !frameNoneToggle.checked) {
                window.qrCustomizerState.frameBg = frameBgColorPicker.value;
            }
        });
    }

    // Range sliders
    setupRangeSlider('bg-image-opacity', 'bg-opacity-val', 'bgImageOpacity');
    setupRangeSlider('logo-size', 'logo-size-val', 'logoSize');
    setupRangeSlider('frame-padding', 'frame-padding-val', 'framePadding');
    setupRangeSlider('frame-radius', 'frame-radius-val', 'frameRadius');
    setupRangeSlider('qr-size', 'qr-size-val', 'qrSize');

    // Error correction
    const ecSelect = document.getElementById('qr-error-correction');
    if (ecSelect) {
        ecSelect.addEventListener('change', () => {
            window.qrCustomizerState.errorCorrection = ecSelect.value;
            renderStudioPreview();
        });
    }

    // Preview URL
    const previewUrlInput = document.getElementById('studio-preview-url');
    if (previewUrlInput) {
        previewUrlInput.addEventListener('input', () => {
            window._studioQRData = null; // clear file data when typing URL
            renderStudioPreview();
        });
    }

    // --- Studio Mode Tabs (Link / Image / File) ---
    const studioModeBtns = document.querySelectorAll('.studio-mode-btn');
    const studioInputLink = document.getElementById('studio-input-link');
    const studioInputFile = document.getElementById('studio-input-file');
    const studioFileInput = document.getElementById('studio-file-input');
    const studioFileLabel = document.getElementById('studio-file-label');
    let studioMode = 'link';

    studioModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            studioModeBtns.forEach(b => {
                b.style.borderColor = 'transparent';
                b.style.background = 'rgba(255,255,255,0.05)';
                b.style.color = 'var(--text-muted)';
            });
            btn.style.borderColor = 'var(--primary)';
            btn.style.background = 'rgba(99,102,241,0.15)';
            btn.style.color = 'var(--primary)';
            studioMode = btn.dataset.studioMode;

            if (studioMode === 'link') {
                if (studioInputLink) studioInputLink.style.display = 'flex';
                if (studioInputFile) studioInputFile.style.display = 'none';
            } else {
                if (studioInputLink) studioInputLink.style.display = 'none';
                if (studioInputFile) {
                    studioInputFile.style.display = 'block';
                    if (studioFileInput) {
                        studioFileInput.accept = studioMode === 'image' ? 'image/*' : '*';
                    }
                    if (studioFileLabel) {
                        studioFileLabel.textContent = studioMode === 'image' ? 'Click to upload Image' : 'Click to upload File';
                    }
                }
            }
        });
    });

    // Studio file input handler
    if (studioFileInput) {
        studioFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (studioFileLabel) studioFileLabel.textContent = file.name;

            if (file.type.startsWith('image/')) {
                // For image preview, use a data URL directly
                const reader = new FileReader();
                reader.onload = (ev) => {
                    window._studioQRData = ev.target.result.substring(0, 200); // shortened for preview QR
                    renderStudioPreview();
                };
                reader.readAsDataURL(file);
            } else {
                // For file, just generate a placeholder URL for preview
                window._studioQRData = 'https://qrmonkey.app/file/' + file.name;
                renderStudioPreview();
            }
        });
    }

    // --- File uploads (bg image & logo) with validation ---
    function setupFileUpload(inputId, previewId, thumbId, nameId, removeId, stateKey, onDone) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const thumb = document.getElementById(thumbId);
        const nameEl = document.getElementById(nameId);
        const removeBtn = document.getElementById(removeId);
        if (!input) return;

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert('Only image files allowed.'); return; }
            if (file.size > 2 * 1024 * 1024) { alert('File too large. Max 2MB.'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => {
                window.qrCustomizerState[stateKey] = ev.target.result;
                if (thumb) thumb.src = ev.target.result;
                if (nameEl) nameEl.textContent = file.name;
                if (preview) preview.style.display = 'block';
                renderStudioPreview();
            };
            reader.readAsDataURL(file);
        });

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                window.qrCustomizerState[stateKey] = null;
                input.value = '';
                if (preview) preview.style.display = 'none';
                renderStudioPreview();
            });
        }
    }

    setupFileUpload('bg-image-input', 'bg-image-preview', 'bg-image-thumb', 'bg-image-name', 'bg-image-remove', 'bgImage');
    setupFileUpload('logo-image-input', 'logo-image-preview', 'logo-image-thumb', 'logo-image-name', 'logo-image-remove', 'logoImage');

    // --- Studio Download ---
    const studioDownloadBtn = document.getElementById('studio-download-btn');
    if (studioDownloadBtn) {
        studioDownloadBtn.addEventListener('click', async () => {
            const frame = document.getElementById('studio-preview-frame');
            if (!frame) return;
            try {
                studioDownloadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';
                studioDownloadBtn.disabled = true;
                const canvas = await html2canvas(frame, { backgroundColor: null, scale: 3 });
                const link = document.createElement('a');
                link.download = 'QRMonkey-Custom.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch(e) {
                console.error(e);
                alert('Could not save image.');
            } finally {
                studioDownloadBtn.innerHTML = '<i class="ph ph-download-simple"></i> Download';
                studioDownloadBtn.disabled = false;
            }
        });
    }

    // --- Studio Share ---
    const studioShareBtn = document.getElementById('studio-share-btn');
    if (studioShareBtn) {
        studioShareBtn.addEventListener('click', async () => {
            const frame = document.getElementById('studio-preview-frame');
            if (!frame) return;
            try {
                studioShareBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...';
                studioShareBtn.disabled = true;
                const canvas = await html2canvas(frame, { backgroundColor: null, scale: 3 });
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'QRMonkey-Custom.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'My Custom QR Code', text: 'Check out this custom QR code!' });
                    } else {
                        alert('Sharing is not supported on this browser. Download instead.');
                    }
                    studioShareBtn.innerHTML = '<i class="ph ph-share-network"></i> Share';
                    studioShareBtn.disabled = false;
                });
            } catch(e) {
                console.error(e);
                studioShareBtn.innerHTML = '<i class="ph ph-share-network"></i> Share';
                studioShareBtn.disabled = false;
            }
        });
    }

    // Initial render — show empty state (no auto QR)
    setTimeout(() => renderStudioPreview(), 300);

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

            // Fetch User Role and update Profile UI
            get(dbRef(db, `users/${user.uid}/profile`)).then((snapshot) => {
                if (snapshot.exists()) {
                    const profileData = snapshot.val();
                    window.userRole = profileData.role || 'free';
                    window.userProExpiry = profileData.pro_expiry || null;
                    
                    const planBadge = document.getElementById('profile-plan-badge');
                    const subscriptionSection = document.getElementById('subscription-info-section');
                    const settingsPlanName = document.getElementById('settings-plan-name');
                    const settingsPlanExpiry = document.getElementById('settings-plan-expiry');
                    const refundSection = document.getElementById('refund-section');
                    const refundEmailInput = document.getElementById('refund-email');
                    
                    if (window.userRole === 'admin') {
                        if (profileEmail) profileEmail.textContent = 'Admin (' + user.email + ')';
                        if (planBadge) {
                            planBadge.textContent = 'Admin Role';
                            planBadge.style.background = 'var(--primary)';
                            planBadge.style.color = '#fff';
                        }
                        
                        // Unhide Admin Nav
                        const navAdminBtn = document.getElementById('nav-admin-btn');
                        if (navAdminBtn) navAdminBtn.style.display = 'flex';
                        
                        const profileAdminShortcut = document.getElementById('profile-admin-shortcut');
                        if (profileAdminShortcut) profileAdminShortcut.style.display = 'block';
                        
                        // Show subscription info for admin
                        if (subscriptionSection) {
                            subscriptionSection.style.display = 'block';
                            if (settingsPlanName) settingsPlanName.textContent = 'Admin (Unlimited)';
                            if (settingsPlanExpiry) { settingsPlanExpiry.textContent = 'Never'; settingsPlanExpiry.style.color = 'var(--success)'; }
                        }
                    } else if (window.userRole === 'pro') {
                        if (profileEmail) profileEmail.textContent = 'Pro User (' + user.email + ')';
                        if (planBadge) {
                            planBadge.textContent = 'Pro Tier';
                            planBadge.style.background = 'gold';
                            planBadge.style.color = '#000';
                        }
                        
                        // Show subscription info for pro
                        if (subscriptionSection) {
                            subscriptionSection.style.display = 'block';
                            if (settingsPlanName) settingsPlanName.textContent = 'Pro Monthly';
                            if (settingsPlanExpiry && window.userProExpiry) {
                                const expiryDate = new Date(window.userProExpiry);
                                settingsPlanExpiry.textContent = expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                                if (expiryDate < new Date()) {
                                    settingsPlanExpiry.style.color = 'var(--error)';
                                    settingsPlanExpiry.textContent += ' (Expired)';
                                } else {
                                    settingsPlanExpiry.style.color = 'var(--success)';
                                }
                            } else if (settingsPlanExpiry) {
                                settingsPlanExpiry.textContent = 'Unlimited';
                                settingsPlanExpiry.style.color = 'var(--success)';
                            }
                        }
                    } else {
                        // Free user
                        if (planBadge) {
                            planBadge.textContent = 'Free Plan';
                            planBadge.style.background = 'rgba(255,255,255,0.1)';
                            planBadge.style.color = 'var(--text-muted)';
                        }
                    }
                    
                    // Refund Section: Show only if user has a recent payment (within 24 hours)
                    if (refundSection && refundEmailInput) {
                        refundEmailInput.value = user.email;
                    }
                    get(dbRef(db, `users/${user.uid}`)).then((userSnap) => {
                        if (userSnap.exists()) {
                            const userData = userSnap.val();
                            const lastPaymentTime = userData.lastPaymentTime;
                            const now = Date.now();
                            const twentyFourHours = 24 * 60 * 60 * 1000;
                            
                            if (lastPaymentTime && (now - lastPaymentTime) <= twentyFourHours) {
                                // Payment within 24 hours, show refund form
                                if (refundSection) refundSection.style.display = 'block';
                            } else if (lastPaymentTime) {
                                // Has paid before but > 24 hours ago, show section with disabled message
                                if (refundSection) {
                                    refundSection.style.display = 'block';
                                    const formContainer = document.getElementById('refund-form-container');
                                    if (formContainer) {
                                        formContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;"><i class="ph-fill ph-clock"></i> Your last payment was more than 24 hours ago. Refund window has expired.</p>';
                                    }
                                }
                            }
                            // If never paid, refund section stays hidden
                        }
                    }).catch(e => console.error("Refund check error:", e));
                    
                } else {
                    window.userRole = 'free';
                }
            }).catch(e => {
                console.error("Role fetch error:", e);
                window.userRole = 'free';
            });

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
                                let scanId = item.scanId;
                                if (!scanId && item.originalData && item.originalData.includes('view.html?id=')) {
                                    scanId = item.originalData.split('view.html?id=')[1];
                                }
                                if(scanId) remove(dbRef(db, `scans/${scanId}`));
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
                                    <div id="perm-badge-${key}" style="display: none; position: absolute; top: 8px; left: 8px; background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 5;"><i class="ph-fill ph-crown"></i> PRO</div>
                                    <button class="delete-history-btn" title="Delete this QR" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: var(--error); cursor: pointer; z-index: 10; transition: all 0.3s ease;">
                                        <i class="ph-bold ph-trash"></i>
                                    </button>
                                    <button class="show-password-btn" title="Show Password" data-pwd="${item.password || ''}" style="position: absolute; top: 8px; right: 45px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: var(--primary); cursor: pointer; z-index: 10; transition: all 0.3s ease;">
                                        <i class="ph-bold ph-dots-three-vertical"></i>
                                    </button>
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

                        // Fetch permanent status
                        let scanId = item.scanId;
                        if (!scanId && item.originalData && item.originalData.includes('view.html?id=')) {
                            scanId = item.originalData.split('view.html?id=')[1];
                        }
                        if (scanId) {
                            get(dbRef(db, `scans/${scanId}`)).then((snap) => {
                                if (snap.exists() && snap.val().permanent) {
                                    const badge = document.getElementById(`perm-badge-${key}`);
                                    if (badge) badge.style.display = 'block';
                                }
                            }).catch(() => {});
                        }
                        
                        card.addEventListener('click', (e) => {
                            // Don't flip if clicking the delete or password button
                            if (e.target.closest('.delete-history-btn') || e.target.closest('.show-password-btn')) return;
                            card.classList.toggle('flipped');
                        });
                        
                        const pwdBtn = card.querySelector('.show-password-btn');
                        pwdBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const pwd = pwdBtn.getAttribute('data-pwd');
                            if (pwd) {
                                alert("Password: " + pwd);
                            } else {
                                alert("Password: None");
                            }
                        });

                        const delBtn = card.querySelector('.delete-history-btn');
                        delBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            
                            let scanId = item.scanId;
                            if (!scanId && item.originalData && item.originalData.includes('view.html?id=')) {
                                scanId = item.originalData.split('view.html?id=')[1];
                            }

                            let isPermanent = false;
                            let scanData = null;

                            if (scanId) {
                                try {
                                    const scanSnap = await get(dbRef(db, `scans/${scanId}`));
                                    if (scanSnap.exists()) {
                                        scanData = scanSnap.val();
                                        isPermanent = scanData.permanent === true;
                                    }
                                } catch(e) {
                                    console.error("Failed to check permanent status", e);
                                }
                            }

                            let confirmDeleteHistory = false;
                            let confirmDeleteServer = false;

                            if (isPermanent) {
                                const msg = "Aapne is QR code ko hamesha ke liye (Permanent) banaya hua hai.\n\n" +
                                            "Kya aap isko pure server se delete karna chahte hain?\n" +
                                            "OK = Pure server se udao (QR live nahi rahega)\n" +
                                            "Cancel = Sirf meri history se hatao (QR live rahega)";
                                
                                if (confirm(msg)) {
                                    confirmDeleteHistory = true;
                                    confirmDeleteServer = true;
                                } else {
                                    const keepLiveConfirm = confirm("Theek hai, QR live rahega. Par kya aap isko apni History se hatana chahte hain?");
                                    if (keepLiveConfirm) {
                                        confirmDeleteHistory = true;
                                        confirmDeleteServer = false;
                                    }
                                }
                            } else {
                                if (confirm("Are you sure you want to delete this QR code permanently?")) {
                                    confirmDeleteHistory = true;
                                    confirmDeleteServer = true;
                                }
                            }

                            if (!confirmDeleteHistory && !confirmDeleteServer) return; // User cancelled completely

                            try {
                                // Delete from history
                                if (confirmDeleteHistory) {
                                    await remove(dbRef(db, `users/${user.uid}/history/${key}`));
                                }
                                
                                if (confirmDeleteServer && scanId) {
                                    if (scanData && scanData.storagePath) {
                                        try {
                                            await deleteObject(storageRef(storage, scanData.storagePath));
                                        } catch(err) { console.error("Storage delete error", err); }
                                    }

                                    // Remove scan completely from Firebase Realtime Database
                                    await remove(dbRef(db, `scans/${scanId}`));
                                }
                            } catch (error) {
                                console.error("Failed to delete", error);
                                alert("Could not delete. Please try again.");
                            }
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
                    const newScanRef = push(scansRef);
                    const isPermanent = (window.userRole === 'pro' || window.userRole === 'admin');
                    await set(newScanRef, {
                        uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
                        email: auth.currentUser ? auth.currentUser.email : 'guest@unknown',
                        ip_address: window.userIp,
                        type: currentMode,
                        data: encrypted,
                        encrypted: true,
                        timestamp: Date.now(),
                        permanent: isPermanent,
                        expiresAt: isPermanent ? null : Date.now() + (72 * 60 * 60 * 1000) // 72 hours expiry
                    });
                    const scanId = newScanRef.key;
                    if (auth.currentUser) logAuditTrail(scanId, auth.currentUser.uid);
                    
                    const viewUrl = window.location.origin + '/view.html?id=' + scanId;
                    renderQR(viewUrl, dataUrl, password); // Render the viewUrl in QR
                } catch (e) {
                    alert("Encryption failed. " + e.message);
                }
            } else {
                renderQR(dataUrl, dataUrl);
            }
        };

        const logAuditTrail = async (scanId, uid) => {
            try {
                let ipAddress = 'unknown';
                try {
                    const ipRes = await fetch('https://ipapi.co/json/');
                    if (ipRes.ok) {
                        const ipData = await ipRes.json();
                        ipAddress = ipData.ip || 'unknown';
                    }
                } catch(e) {}
                
                set(dbRef(db, `qr_logs/${scanId}`), {
                    uid: uid,
                    ip_address: ipAddress,
                    timestamp: Date.now()
                });
            } catch (err) {
                console.error("Audit log failed", err);
            }
        };

        const saveToHistory = (type, originalData, qrDataUrl, thumbUrl, scanId = null, password = null) => {
            if(!auth.currentUser) return;
            const historyRef = dbRef(db, `users/${auth.currentUser.uid}/history`);
            push(historyRef, {
                type,
                originalData,
                qrDataUrl,
                thumbUrl: thumbUrl || null,
                scanId: scanId,
                timestamp: Date.now(),
                password: password
            });
        };

        const uploadAndRenderQR = async (file) => {
            resultPanel.style.display = 'flex';
            qrCodeContainer.style.display = 'none';
            qrActions.style.display = 'none';
            loadingSpinner.style.display = 'flex';
            generateBtn.disabled = true;

            try {
                // Guests are now allowed to upload files too! No auth check here.
                
                let base64Data = '';
                
                // Compress if image, else read as base64
                if (currentMode === 'image') {
                    // Increased resolution to 2048x2048
                    base64Data = await compressImage(file, 2048, 2048, 0.95);
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

                const encryptToggle = document.getElementById('encrypt-toggle');
                const encryptPassword = document.getElementById('encrypt-password');
                let isEncrypted = false;
                let dataToStore = base64Data;
                let usedPassword = null;
                
                if (encryptToggle && encryptToggle.checked) {
                    const password = encryptPassword.value;
                    if (!password) {
                        alert("Please enter a password to encrypt the data.");
                        resetResult();
                        generateBtn.disabled = false;
                        return;
                    }
                    dataToStore = CryptoJS.AES.encrypt(base64Data, password).toString();
                    isEncrypted = true;
                    usedPassword = password;
                }

                const scansRef = dbRef(db, `scans`);
                const newScanRef = push(scansRef);
                const isPermanent = (window.userRole === 'pro' || window.userRole === 'admin');
                await set(newScanRef, {
                    uid: auth.currentUser ? auth.currentUser.uid : window.guestDeviceId,
                    email: auth.currentUser ? auth.currentUser.email : 'guest@unknown',
                    ip_address: window.userIp,
                    type: currentMode,
                    filename: file.name,
                    data: dataToStore,
                    encrypted: isEncrypted,
                    timestamp: Date.now(),
                    permanent: isPermanent,
                    expiresAt: isPermanent ? null : Date.now() + (72 * 60 * 60 * 1000) // 72 hours expiry
                });
                
                const scanId = newScanRef.key;
                if (auth.currentUser) logAuditTrail(scanId, auth.currentUser.uid);
                
                window.lastThumbUrl = currentMode === 'image' ? base64Data : '';
                
                const viewUrl = window.location.origin + '/view.html?id=' + scanId;
                
                renderQR(viewUrl, viewUrl, usedPassword);
            } catch (error) {
                console.error(error);
                alert('Failed to process file. ' + error.message);
                resetResult();
            } finally {
                generateBtn.disabled = false;
            }
        };

        const renderQR = (dataUrl, originalUrl, password = null) => {
            resultPanel.style.display = 'flex';
            loadingSpinner.style.display = 'none';
            qrCodeContainer.style.display = 'block';
            qrCodeContainer.innerHTML = ''; 
            shareLink.href = originalUrl || dataUrl;

            const s = window.qrCustomizerState || {};

            // Apply wrapper background using customizer state
            const wrapper = document.getElementById('qr-frame-wrapper');
            if (wrapper) {
                if (s.frameBg === 'none' || !s.frameBg) {
                    wrapper.style.background = 'none';
                    wrapper.style.padding = '20px';
                    wrapper.style.borderRadius = '12px';
                } else {
                    wrapper.style.background = s.frameBgColor || s.frameBg;
                    wrapper.style.padding = (s.framePadding || 20) + 'px';
                    wrapper.style.borderRadius = (s.frameRadius || 12) + 'px';
                }
            }

            // Apply background image to container
            if (s.bgImage) {
                qrCodeContainer.style.background = `url(${s.bgImage})`;
                qrCodeContainer.style.backgroundSize = 'cover';
                qrCodeContainer.style.backgroundPosition = 'center';
            } else {
                qrCodeContainer.style.background = s.bgTransparent ? 'transparent' : (s.bgColor || '#ffffff');
            }
            qrCodeContainer.style.boxShadow = s.bgTransparent ? 'none' : '0 4px 12px rgba(0,0,0,0.15)';
            qrCodeContainer.style.borderRadius = '8px';
            qrCodeContainer.style.display = 'inline-flex';
            qrCodeContainer.style.padding = '8px';

            // Build QR options from customizer state
            const qrOpts = {
                width: s.qrSize || 250,
                height: s.qrSize || 250,
                margin: 15, // Required quiet zone for scannability
                type: 'svg', // Ensure SVG for crisp rendering during html2canvas scaling
                qrOptions: { errorCorrectionLevel: 'H' }, // High error correction for custom dots
                data: dataUrl,
                dotsOptions: {
                    color: s.dotColor || '#4f46e5',
                    type: s.dotType || 'rounded'
                },
                backgroundOptions: {
                    color: (s.bgTransparent || s.bgImage) ? 'transparent' : (s.bgColor || '#ffffff')
                },
                imageOptions: {
                    crossOrigin: 'anonymous',
                    margin: Math.round((s.qrSize || 250) * 0.03)
                },
                cornersSquareOptions: {
                    type: s.cornerSquareType || 'extra-rounded',
                    color: s.cornerSquareColor || '#1e293b'
                },
                cornersDotOptions: {
                    type: s.cornerDotType || 'dot',
                    color: s.cornerDotColor || '#1e293b'
                },
                qrOptions: {
                    errorCorrectionLevel: s.errorCorrection || 'M'
                }
            };

            // Center logo from customizer
            if (s.logoImage) {
                qrOpts.image = s.logoImage;
                qrOpts.imageOptions.imageSize = (s.logoSize || 20) / 100;
            }

            qrCodeInstance = new QRCodeStyling(qrOpts);
            qrCodeInstance.append(qrCodeContainer);
            
            // Fix SVG scaling by adding viewBox (qr-code-styling doesn't add it by default)
            const svgEl = qrCodeContainer.querySelector('svg');
            if (svgEl) {
                const w = svgEl.getAttribute('width');
                const h = svgEl.getAttribute('height');
                if (w && h) {
                    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
                    svgEl.style.width = '100%';
                    svgEl.style.height = 'auto';
                }
            }

            setTimeout(() => {
                qrActions.style.display = 'flex';
                resultPanel.scrollIntoView({ behavior: 'smooth', block: 'end' });
                
                // Save to history after generating
                const element = qrCodeContainer.querySelector('canvas') || qrCodeContainer.querySelector('svg');
                if (element) {
                    let extractedScanId = null;
                    if (dataUrl.includes('view.html?id=')) {
                        extractedScanId = dataUrl.split('view.html?id=')[1];
                    }
                    let thumbData = '';
                    if (element.tagName.toLowerCase() === 'canvas') {
                        thumbData = element.toDataURL("image/png");
                    } else if (element.tagName.toLowerCase() === 'svg') {
                        const svgData = new XMLSerializer().serializeToString(element);
                        thumbData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                    }

                    saveToHistory(
                        currentMode, 
                        currentMode === 'url' ? urlInput.value : selectedFile.name, 
                        thumbData, 
                        window.lastThumbUrl || '',
                        extractedScanId,
                        password
                    );
                    window.lastThumbUrl = null;

                    // Bind monetization prompt buttons
                    const promptPanel = document.getElementById('permanent-prompt-panel');
                    if (promptPanel) {
                        promptPanel.style.display = 'block';
                        
                        // Clear old listeners by cloning
                        const singleBtn = document.getElementById('result-buy-single-btn');
                        const newSingleBtn = singleBtn.cloneNode(true);
                        singleBtn.parentNode.replaceChild(newSingleBtn, singleBtn);
                        
                        const proBtn = document.getElementById('result-buy-pro-btn');
                        const newProBtn = proBtn.cloneNode(true);
                        proBtn.parentNode.replaceChild(newProBtn, proBtn);

                        newSingleBtn.addEventListener('click', () => initiatePayment(1, 'Single QR Code', 'Make this specific QR code permanent', extractedScanId));
                        newProBtn.addEventListener('click', () => initiatePayment(299, 'Pro Monthly Subscription', 'Unlimited permanent QR codes', null));
                    }
                }
            }, 100);
        };

        downloadBtn.addEventListener('click', async () => {
            const wrapper = document.getElementById('qr-frame-wrapper');
            if (!wrapper) return;
            try {
                const originalHtml = downloadBtn.innerHTML;
                downloadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';
                downloadBtn.disabled = true;
                const canvas = await html2canvas(wrapper, { backgroundColor: null, scale: 2 });
                const link = document.createElement('a');
                link.download = 'QRMonkey-Custom.png';
                link.href = canvas.toDataURL("image/png");
                link.click();
                downloadBtn.innerHTML = originalHtml;
                downloadBtn.disabled = false;
            } catch(e) {
                console.error(e);
                alert("Could not save image.");
                downloadBtn.disabled = false;
            }
        });

        if (shareQrBtn) {
            shareQrBtn.addEventListener('click', async () => {
                const wrapper = document.getElementById('qr-frame-wrapper');
                if (!wrapper) return;
                try {
                    const originalHtml = shareQrBtn.innerHTML;
                    shareQrBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...';
                    shareQrBtn.disabled = true;
                    const canvas = await html2canvas(wrapper, { backgroundColor: null, scale: 2 });
                    canvas.toBlob(async (blob) => {
                        const file = new File([blob], 'QRMonkey-Custom.png', { type: 'image/png' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'My Custom QR Code',
                                text: 'Check out this custom QR code!'
                            });
                        } else {
                            alert('Sharing files is not supported on this browser.');
                        }
                        shareQrBtn.innerHTML = originalHtml;
                        shareQrBtn.disabled = false;
                    });
                } catch(e) {
                    console.error(e);
                    shareQrBtn.disabled = false;
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

    // Toggle Password Input Visibility
    const encryptToggle = document.getElementById('encrypt-toggle');
    const passwordContainer = document.getElementById('password-container');
    if(encryptToggle && passwordContainer) {
        encryptToggle.addEventListener('change', (e) => {
            passwordContainer.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // --- Delete Account Logic ---
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!auth.currentUser) return;
            
            const confirmed = confirm("Are you sure you want to permanently delete your account and all data? This action cannot be undone.");
            if (!confirmed) return;
            
            const user = auth.currentUser;
            const uid = user.uid;
            const email = user.email || 'anonymous';
            
            deleteAccountBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Deleting...';
            deleteAccountBtn.disabled = true;
            
            try {
                // 1. Fetch IP Address for logging
                let ipAddress = 'unknown';
                try {
                    const ipRes = await fetch('https://ipapi.co/json/');
                    if (ipRes.ok) {
                        const ipData = await ipRes.json();
                        ipAddress = ipData.ip || 'unknown';
                    }
                } catch(e) { console.warn("Could not fetch IP"); }
                
                // 2. Log to deleted_users node
                await set(dbRef(db, `deleted_users/${uid}`), {
                    email: email,
                    ip_address: ipAddress,
                    deleted_at: Date.now(),
                    date_string: new Date().toISOString()
                });
                
                // 3. Delete user data (history, profile info) from users node
                await remove(dbRef(db, `users/${uid}`));
                
                // 4. Delete user account from Firebase Auth
                await deleteUser(user);
                
                // 5. Done. It will automatically trigger auth state change and redirect.
                alert("Your account and data have been permanently deleted.");
            } catch (error) {
                console.error("Error deleting account:", error);
                if (error.code === 'auth/requires-recent-login') {
                    alert("Security required: Please log out and log back in before deleting your account.");
                    signOut(auth).then(() => window.location.href = '/index.html');
                } else {
                    alert("Failed to delete account. Please try again or contact support.");
                    deleteAccountBtn.innerHTML = '<i class="ph-bold ph-trash"></i> Delete Account';
                    deleteAccountBtn.disabled = false;
                }
            }
        });
    }

    // --- Admin Panel Logic ---
    const openAdminPanelBtn = document.getElementById('open-admin-panel-btn');
    if (openAdminPanelBtn) {
        openAdminPanelBtn.addEventListener('click', () => {
            const navAdminBtn = document.getElementById('nav-admin-btn');
            if (navAdminBtn) navAdminBtn.click();
        });
    }

    // 1. Role Management
    const adminApplyRoleBtn = document.getElementById('admin-apply-role-btn');
    if (adminApplyRoleBtn) {
        adminApplyRoleBtn.addEventListener('click', async () => {
            const email = document.getElementById('admin-user-email').value.trim().toLowerCase();
            const action = document.getElementById('admin-user-action').value;
            const duration = document.getElementById('admin-user-duration').value;
            const statusEl = document.getElementById('admin-role-status');
            
            if (!email) {
                statusEl.textContent = 'Please enter an email address.';
                statusEl.style.color = 'var(--error)';
                return;
            }

            statusEl.textContent = 'Searching for user...';
            statusEl.style.color = 'var(--text-muted)';
            
            try {
                const usersRef = dbRef(db, 'users');
                const snapshot = await get(usersRef);
                if (!snapshot.exists()) {
                    statusEl.textContent = 'No users found in database.';
                    return;
                }
                
                let targetUid = null;
                snapshot.forEach(childSnap => {
                    const profile = childSnap.val().profile;
                    if (profile && profile.email && profile.email.toLowerCase() === email) {
                        targetUid = childSnap.key;
                    }
                });

                if (!targetUid) {
                    statusEl.textContent = 'User not found.';
                    statusEl.style.color = 'var(--error)';
                    return;
                }

                const updates = {};
                if (action === 'revoke') {
                    updates.role = 'free';
                    updates.pro_expiry = null;
                } else if (action === 'admin') {
                    updates.role = 'admin';
                    updates.pro_expiry = null;
                } else if (action === 'pro') {
                    updates.role = 'pro';
                    if (duration === 'unlimited') {
                        updates.pro_expiry = 'unlimited';
                    } else {
                        const months = parseInt(duration);
                        const expiryDate = new Date();
                        expiryDate.setMonth(expiryDate.getMonth() + months);
                        updates.pro_expiry = expiryDate.getTime();
                    }
                }

                await update(dbRef(db, `users/${targetUid}/profile`), updates);
                statusEl.textContent = `Success! ${email} updated.`;
                statusEl.style.color = 'var(--success)';
                
            } catch (error) {
                console.error(error);
                statusEl.textContent = `Error: ${error.message}`;
                statusEl.style.color = 'var(--error)';
            }
        });
    }

    // 2. Fetch Users
    const fetchUsersBtn = document.getElementById('admin-fetch-users-btn');
    if (fetchUsersBtn) {
        fetchUsersBtn.addEventListener('click', async () => {
            const listEl = document.getElementById('admin-users-list');
            listEl.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
            
            try {
                const usersRef = dbRef(db, 'users');
                const snapshot = await get(usersRef);
                
                if (!snapshot.exists()) {
                    listEl.innerHTML = '<tr><td colspan="4" style="text-align:center;">No users found.</td></tr>';
                    return;
                }

                listEl.innerHTML = '';
                const users = [];
                snapshot.forEach(childSnap => {
                    const profile = childSnap.val().profile;
                    if (profile) {
                        users.push({
                            uid: childSnap.key,
                            email: profile.email || 'Unknown',
                            role: profile.role || 'free',
                            ip: profile.ip_address || 'Unknown',
                            joinDate: profile.lastLogin ? new Date(profile.lastLogin).toLocaleDateString() : 'Unknown'
                        });
                    }
                });
                
                // Sort by newest login
                users.reverse();
                
                users.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 0.75rem;">${u.email}</td>
                        <td style="padding: 0.75rem;"><span class="badge" style="${u.role==='admin'?'background:var(--primary);color:white;':(u.role==='pro'?'background:gold;color:black;':'')}">${u.role.toUpperCase()}</span></td>
                        <td style="padding: 0.75rem; font-family: monospace; font-size: 0.8rem;">${u.ip}</td>
                        <td style="padding: 0.75rem;">${u.joinDate}</td>
                    `;
                    listEl.appendChild(tr);
                });
                
            } catch (error) {
                console.error(error);
                listEl.innerHTML = `<tr><td colspan="4" style="color:var(--error);text-align:center;">Error: ${error.message}</td></tr>`;
            }
        });
    }

    // 3. QR Enquiry
    const trackQrBtn = document.getElementById('admin-track-qr-btn');
    if (trackQrBtn) {
        trackQrBtn.addEventListener('click', async () => {
            let qrId = document.getElementById('admin-qr-id').value.trim();
            const resultEl = document.getElementById('admin-enquiry-result');
            
            if (!qrId) {
                alert('Please enter a QR ID or encrypted string.');
                return;
            }
            
            // Clean up if they pasted full string or URL
            if (qrId.includes('?id=')) {
                qrId = qrId.split('?id=')[1].split('&')[0];
            } else if (qrId.includes('id=')) {
                qrId = qrId.split('id=')[1].split('&')[0];
            }
            if (qrId.startsWith('qrmonkey:enc:')) qrId = qrId.replace('qrmonkey:enc:', '');
            if (qrId.includes('::')) qrId = qrId.split('::')[0];
            
            // Limit length but don't break valid Firebase IDs
            if (qrId.length > 200) qrId = qrId.substring(0, 200);

            resultEl.style.display = 'block';
            resultEl.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Searching across all users...';
            
            try {
                const usersRef = dbRef(db, 'users');
                const snapshot = await get(usersRef);
                let foundMatch = null;
                
                if (snapshot.exists()) {
                    snapshot.forEach(childSnap => {
                        const history = childSnap.val().history;
                        const profile = childSnap.val().profile;
                        if (history) {
                            Object.keys(history).forEach(key => {
                                const item = history[key];
                                // Check if id matches, scanId matches, or if encrypted string matches
                                if (key === qrId || (item.scanId && item.scanId === qrId) || (item.encrypted && item.encrypted.includes(qrId)) || (item.originalData && item.originalData.includes(qrId))) {
                                    foundMatch = {
                                        email: profile?.email || 'Unknown',
                                        ip: profile?.ip_address || 'Unknown',
                                        role: profile?.role || 'free',
                                        date: item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown',
                                        type: item.type
                                    };
                                }
                            });
                        }
                    });
                }
                
                if (foundMatch) {
                    resultEl.innerHTML = `
                        <h4 style="color: var(--success); margin-bottom: 0.5rem;"><i class="ph-fill ph-check-circle"></i> Match Found!</h4>
                        <p><strong>Creator Email:</strong> ${foundMatch.email}</p>
                        <p><strong>Creator IP:</strong> <span style="font-family: monospace;">${foundMatch.ip}</span></p>
                        <p><strong>Account Role:</strong> ${foundMatch.role}</p>
                        <p><strong>QR Created On:</strong> ${foundMatch.date}</p>
                        <p><strong>QR Type:</strong> ${foundMatch.type}</p>
                    `;
                } else {
                    resultEl.innerHTML = `<span style="color: var(--error);"><i class="ph ph-warning-circle"></i> No exact match found in database for that ID or string.</span>`;
                }
                
            } catch (error) {
                console.error(error);
                resultEl.innerHTML = `<span style="color: var(--error);">Error: ${error.message}</span>`;
            }
        });
    }

    // --- Refund Form Submit ---
    const submitRefundBtn = document.getElementById('submit-refund-btn');
    if (submitRefundBtn) {
        submitRefundBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return alert('Please login first.');
            
            const reason = document.getElementById('refund-reason')?.value?.trim();
            const paymentId = document.getElementById('refund-payment-id')?.value?.trim();
            const statusMsg = document.getElementById('refund-status-msg');
            
            if (!reason || reason.length < 10) {
                if (statusMsg) { statusMsg.textContent = 'Please provide a detailed reason (at least 10 characters).'; statusMsg.style.color = 'var(--error)'; }
                return;
            }
            
            submitRefundBtn.disabled = true;
            submitRefundBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Submitting...';
            
            try {
                let ipAddress = window.userIp || 'unknown';
                
                await push(dbRef(db, 'refundRequests'), {
                    uid: user.uid,
                    email: user.email,
                    paymentId: paymentId || 'Not provided',
                    reason: reason,
                    ip_address: ipAddress,
                    timestamp: Date.now(),
                    status: 'pending'
                });
                
                if (statusMsg) { statusMsg.textContent = '✅ Refund request submitted successfully! We will process it within 5-7 business days.'; statusMsg.style.color = 'var(--success)'; }
                submitRefundBtn.innerHTML = '<i class="ph ph-check-circle"></i> Submitted';
            } catch (error) {
                console.error('Refund submit error:', error);
                if (statusMsg) { statusMsg.textContent = 'Error: ' + error.message; statusMsg.style.color = 'var(--error)'; }
                submitRefundBtn.disabled = false;
                submitRefundBtn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Submit Refund Request';
            }
        });
    }

    // --- Admin: Fetch Contact Us Applications ---
    const fetchContactsBtn = document.getElementById('admin-fetch-contacts-btn');
    if (fetchContactsBtn) {
        fetchContactsBtn.addEventListener('click', async () => {
            const contactsList = document.getElementById('admin-contacts-list');
            if (!contactsList) return;
            
            contactsList.innerHTML = '<tr><td colspan="6" style="padding: 1rem; text-align: center;"><i class="ph ph-spinner ph-spin"></i> Loading...</td></tr>';
            
            try {
                const snapshot = await get(dbRef(db, 'contactUs'));
                if (!snapshot.exists()) {
                    contactsList.innerHTML = '<tr><td colspan="6" style="padding: 1rem; text-align: center; color: var(--text-muted);">No contact requests found.</td></tr>';
                    return;
                }
                
                const contacts = snapshot.val();
                let rows = '';
                
                Object.entries(contacts).reverse().forEach(([key, contact]) => {
                    const date = contact.timestamp ? new Date(contact.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '--';
                    const statusColor = contact.status === 'pending' ? 'var(--primary)' : 'var(--success)';
                    const truncDesc = (contact.description || '').length > 50 ? contact.description.substring(0, 50) + '...' : (contact.description || '--');
                    
                    rows += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 0.75rem; font-size: 0.85rem;">${contact.email || '--'}</td>
                        <td style="padding: 0.75rem;">${contact.subject || '--'}</td>
                        <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(contact.description || '').replace(/"/g, '&quot;')}">${truncDesc}</td>
                        <td style="padding: 0.75rem; font-family: monospace; font-size: 0.8rem;">${contact.ip_address || '--'}</td>
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;"><span style="color: ${statusColor}; font-weight: 600; text-transform: capitalize;">${contact.status || 'pending'}</span></td>
                    </tr>`;
                });
                
                contactsList.innerHTML = rows || '<tr><td colspan="6" style="padding: 1rem; text-align: center; color: var(--text-muted);">No contacts found.</td></tr>';
            } catch (error) {
                console.error('Fetch contacts error:', error);
                contactsList.innerHTML = `<tr><td colspan="6" style="padding: 1rem; text-align: center; color: var(--error);">Error: ${error.message}</td></tr>`;
            }
        });
    }

});
