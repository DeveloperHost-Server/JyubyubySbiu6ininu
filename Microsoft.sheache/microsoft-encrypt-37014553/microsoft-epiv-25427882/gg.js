//--------------------------------------Js-Code---------------------------------------



        
        
        //-----------------------------------------------------------------------------







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
