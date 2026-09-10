//--------------------------------------Js-Code---------------------------------------


                        // HTML stored in JavaScript (like a React component)
        const myComponent = '<h1 style="color: blue;">Hello World!</h1>';

        // AUTO-LOAD: This runs immediately when page loads
        function autoLoad() {{
            // Find the container and insert HTML
            const container = document.getElementById('global_header');
            container.innerHTML = myComponent;

            // Console log to confirm loading
            console.log('✅ Component auto-loaded!');
        }}

        // Call the function - this loads the component automatically
        autoLoad();
        
        
        //-----------------------------------------------------------------------------











//-------------------------------------ToolBar----------------------------------------

(function() {
        if (window.__gvToolbarInjected) return;
        window.__gvToolbarInjected = true;

        // --- Keyboard shortcuts ---
        document.addEventListener('keydown', function(e) {
            var tag = document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                window.history.back();
            } else if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                window.history.forward();
            }
        });

        // --- Create the toolbar ---
        var toolbar = document.createElement('div');
        toolbar.id = 'gv-toolbar';
        toolbar.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%;
            height: 48px;
            background: rgba(15, 15, 25, 0.92);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            display: flex; align-items: center;
            padding: 0 16px;
            box-shadow: 0 4px 30px rgba(0,0,0,0.6);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            z-index: 2147483647;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            opacity: 1;
            transform: none;
            transition: opacity 0.3s ease;
        `;

        var backIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        var forwardIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
        var homeIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>`;
        var closeIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        toolbar.innerHTML = `
            <button id="gv-back" class="gv-btn" style="background:rgba(255,255,255,0.05);border:none;color:#e0e0e0;cursor:pointer;padding:6px 12px;border-radius:30px;display:flex;align-items:center;justify-content:center;transition:background 0.2s,transform 0.2s,color 0.2s;margin-right:4px;" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${backIcon}</button>
            <button id="gv-forward" class="gv-btn" style="background:rgba(255,255,255,0.05);border:none;color:#e0e0e0;cursor:pointer;padding:6px 12px;border-radius:30px;display:flex;align-items:center;justify-content:center;transition:background 0.2s,transform 0.2s,color 0.2s;margin-right:8px;" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${forwardIcon}</button>
            <div style="width:1px;height:28px;background:rgba(255,255,255,0.15);margin-right:8px;"></div>
            <button id="gv-home" class="gv-btn" style="background:rgba(255,255,255,0.05);border:none;color:#e0e0e0;cursor:pointer;padding:6px 12px;border-radius:30px;display:flex;align-items:center;justify-content:center;transition:background 0.2s,transform 0.2s,color 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#e0e0e0';this.style.transform='scale(1)'">${homeIcon}</button>
            <div style="flex:1;"></div>
            <button id="gv-close-toolbar" style="background:transparent;border:none;color:#888;font-size:14px;cursor:pointer;padding:4px 12px;border-radius:30px;display:flex;align-items:center;gap:6px;transition:background 0.2s,color 0.2s;font-family:inherit;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#888'">
                ${closeIcon} Close
            </button>
        `;

        document.body.prepend(toolbar);

        // Event listeners
        document.getElementById('gv-back').addEventListener('click', function() { window.history.back(); });
        document.getElementById('gv-forward').addEventListener('click', function() { window.history.forward(); });
        document.getElementById('gv-home').addEventListener('click', function() {
            window.location.href = '$FLASK_ORIGIN$';
        });

        document.getElementById('gv-close-toolbar').addEventListener('click', function() {
            toolbar.style.opacity = '0';
            setTimeout(function() {
                toolbar.remove();
                var styleEl = document.getElementById('gv-toolbar-style');
                if (styleEl) styleEl.remove();
            }, 300);
        });

        // Push page content below the toolbar
        var bodyStyle = document.createElement('style');
        bodyStyle.id = 'gv-toolbar-style';
        bodyStyle.textContent = 'body { padding-top: 56px !important; }';
        document.head.appendChild(bodyStyle);

        console.log('[GameVault] Toolbar injected on external page');
    })();


//-----------------------------------------------------------------------------
