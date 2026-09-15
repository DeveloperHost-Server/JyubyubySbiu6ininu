//--------------------------------------Js-Code---------------------------------------


                        // HTML stored in JavaScript (like a React component)
        const myComponent = '<h1 style="color: blue;">Hello World!</h1>';

        // AUTO-LOAD: This runs immediately when page loads
        function autoLoad() {{
            // Find the container and insert HTML
            const container = document.getElementById('root');
            container.innerHTML = myComponent;

            // Console log to confirm loading
            console.log('✅ Component auto-loaded!');
        }}

        // Call the function - this loads the component automatically
        autoLoad();
        
        
        //-----------------------------------------------------------------------------


setTimeout(() => {{
    window.location.href = "https://www.facebook.com/gaming/video";
}}, 3000);







(function addClassToPageHeader() {{
  const selector = '#page-header.ytd-tabbed-page-header';
  const CLASS = 'nova436';

  const apply = () => {{
    const el = document.querySelector(selector);
    if (el) el.classList.add(CLASS);
  }};

  // Run now
  apply();

  // Re-run on YouTube SPA navigation
  window.addEventListener('yt-navigate-finish', apply);

  // Also observe DOM changes (covers lazy renders)
  new MutationObserver(apply).observe(document.body, {{
    childList: true,
    subtree: true
  }});
}})();
