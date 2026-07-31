document.addEventListener('DOMContentLoaded', () => {
    const resultPanel = document.getElementById('scan-result');
    const resultText = document.getElementById('result-text');
    const copyBtn = document.getElementById('copy-btn');
    const openLinkBtn = document.getElementById('open-link-btn');
    const scanAgainBtn = document.getElementById('scan-again-btn');
    const readerContainer = document.getElementById('reader-container');
    const videoElem = document.getElementById('qr-video');
    const fileInput = document.getElementById('file-input');
    const backBtn = document.getElementById('back-btn');
    
    if (backBtn) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ref') === 'home') {
            backBtn.href = '/home.html';
            backBtn.innerHTML = '<i class="ph ph-arrow-left"></i> Back to Dashboard';
        }
    }
    
    let qrScanner = null;

    function initScanner() {
        resultPanel.style.display = 'none';
        readerContainer.style.display = 'block';

        if (!qrScanner) {
            qrScanner = new QrScanner(
                videoElem,
                result => onScanSuccess(result.data),
                {
                    onDecodeError: error => {
                        // ignore errors during live scanning
                    },
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    maxScansPerSecond: 10
                }
            );
        }
        qrScanner.start().catch(err => {
            console.error("Camera start failed:", err);
            // It's fine, user might use file upload instead
        });
    }

    function onScanSuccess(decodedText) {
        if (qrScanner) {
            qrScanner.stop();
        }
        
        readerContainer.style.display = 'none';
        resultPanel.style.display = 'block';
        resultText.textContent = decodedText;
        
        try {
            const url = new URL(decodedText);
            if(url.protocol === 'http:' || url.protocol === 'https:') {
                openLinkBtn.style.display = 'inline-flex';
                openLinkBtn.href = decodedText;
            } else {
                openLinkBtn.style.display = 'none';
            }
        } catch (_) {
            openLinkBtn.style.display = 'none';
        }
    }

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        // First try standard scan
        QrScanner.scanImage(file, { returnDetailedScanResult: true })
            .then(result => {
                onScanSuccess(result.data);
            })
            .catch(error => {
                // If standard scan fails, try enhanced computer vision pre-processing
                tryEnhancedScan(file);
            });
            
        fileInput.value = ""; // Reset
    });

    async function tryEnhancedScan(file) {
        try {
            const img = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            const enhancements = [
                // 0. No filter (just try jsQR which often works where qr-scanner fails on images)
                (c, x, i) => { c.width = i.width; c.height = i.height; x.filter = 'none'; x.drawImage(i, 0, 0); },
                // 1. Grayscale + High Contrast
                (c, x, i) => { c.width = i.width; c.height = i.height; x.filter = 'grayscale(100%) contrast(300%)'; x.drawImage(i, 0, 0); },
                // 2. Blur + Extreme Contrast
                (c, x, i) => { c.width = i.width; c.height = i.height; x.filter = 'grayscale(100%) blur(2px) contrast(500%)'; x.drawImage(i, 0, 0); },
                // 3. Heavy Blur + Extreme Contrast
                (c, x, i) => { c.width = i.width; c.height = i.height; x.filter = 'grayscale(100%) blur(4px) contrast(800%)'; x.drawImage(i, 0, 0); },
                // 4. Invert colors
                (c, x, i) => { c.width = i.width; c.height = i.height; x.filter = 'invert(100%) grayscale(100%) contrast(300%)'; x.drawImage(i, 0, 0); }
            ];

            for (let applyFilter of enhancements) {
                applyFilter(canvas, ctx, img);
                try {
                    // Try jsQR first since it proved highly effective on these screenshots
                    if (typeof jsQR !== 'undefined') {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code && code.data) {
                            onScanSuccess(code.data);
                            return;
                        }
                    }
                    
                    // Fallback to qr-scanner
                    const result = await QrScanner.scanImage(canvas, { returnDetailedScanResult: true });
                    if (result && result.data) {
                        onScanSuccess(result.data);
                        return;
                    }
                } catch(e) {
                    // Continue to next filter
                }
            }
            alert("Scanner failed. The QR code design might be too extreme for standard scanners. Try generating it with a darker color or square dots.");
        } catch(e) {
            alert("Failed to process the image for scanning.");
        }
    }

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(resultText.textContent);
            const orig = copyBtn.innerHTML;
            copyBtn.innerHTML = `<i class="ph ph-check"></i> Copied!`;
            setTimeout(() => copyBtn.innerHTML = orig, 2000);
        } catch(e) {
            alert("Failed to copy text.");
        }
    });

    scanAgainBtn.addEventListener('click', () => {
        initScanner();
    });

    initScanner();
});


