document.addEventListener('DOMContentLoaded', () => {
    // 1. Fix 100vh issue on mobile browsers (URL bar resizing)
    function setViewportHeight() {
        let vh = window.innerHeight;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    // Set initially and on resize
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    // 2. Add Mobile Overlay to body if it doesn't exist
    let overlay = document.querySelector('.mobile-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);
    }

    // 3. Handle Landing Page Navbar Hamburger (index.html, scan.html)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navDropdown = document.querySelector('.mobile-nav-dropdown');
    
    if (mobileMenuBtn && navDropdown) {
        mobileMenuBtn.addEventListener('click', () => {
            navDropdown.classList.toggle('active');
            overlay.classList.toggle('active');
            
            // Toggle icon
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                if (navDropdown.classList.contains('active')) {
                    icon.classList.replace('ph-list', 'ph-x');
                } else {
                    icon.classList.replace('ph-x', 'ph-list');
                }
            }
        });
    }

    // 4. Handle Dashboard Sidebar Hamburger (home.html)
    const dashboardMenuBtn = document.querySelector('.dashboard-mobile-btn');
    const dashboardSidebar = document.querySelector('.dashboard-sidebar');

    if (dashboardMenuBtn && dashboardSidebar) {
        dashboardMenuBtn.addEventListener('click', () => {
            dashboardSidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }

    // 5. Close menus when overlay is clicked
    overlay.addEventListener('click', () => {
        if (navDropdown && navDropdown.classList.contains('active')) {
            navDropdown.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) icon.classList.replace('ph-x', 'ph-list');
        }
        if (dashboardSidebar && dashboardSidebar.classList.contains('active')) {
            dashboardSidebar.classList.remove('active');
        }
        overlay.classList.remove('active');
    });

    // 6. Add Haptic feedback to buttons on mobile
    const allButtons = document.querySelectorAll('button, .nav-btn, .tab-btn');
    allButtons.forEach(btn => {
        btn.addEventListener('touchstart', () => {
            btn.style.transform = 'scale(0.96)';
        }, {passive: true});
        
        btn.addEventListener('touchend', () => {
            btn.style.transform = '';
            // Attempt to trigger device vibration if supported
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, {passive: true});
    });
});
