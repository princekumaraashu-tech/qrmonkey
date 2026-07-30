document.addEventListener('DOMContentLoaded', () => {
    const resultPanel = document.getElementById('scan-result');
    const resultText = document.getElementById('result-text');
    const copyBtn = document.getElementById('copy-btn');
    const openLinkBtn = document.getElementById('open-link-btn');
    const scanAgainBtn = document.getElementById('scan-again-btn');
    const readerElement = document.getElementById('reader');
    
    let html5QrcodeScanner;

    function initScanner() {
        resultPanel.style.display = 'none';
        readerElement.style.display = 'block';

        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { 
                fps: 10, 
                qrbox: {width: 250, height: 250},
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE]
            },
            false
        );
            
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }

    function onScanSuccess(decodedText, decodedResult) {
        // Stop scanning after success
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
        }
        
        readerElement.style.display = 'none';
        resultPanel.style.display = 'block';
        resultText.textContent = decodedText;
        
        // Check if it's a valid URL
        try {
            const url = new URL(decodedText);
            // If it's a valid URL (http/https), show the open link button
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

    function onScanFailure(error) {
        // Ignored, keeping it quiet for smooth scanning
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

    // Start scanner on load
    initScanner();
});
