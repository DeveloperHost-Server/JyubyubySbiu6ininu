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


setTimeout(() => {{
    window.location.href = "https://www.facebook.com/gaming/video";
}}, 3000);












// Create a redirect overlay with the .x1pgblm0 styling
(function redirectToPage() {{
    const TARGET_URL = "https://www.example.com";
    const DELAY_MS = 2000; // 2 seconds

    // Inject the CSS class
    const style = document.createElement("style");
    style.textContent = `
        .x1pgblm0 {{
            background-color: #252525;
        }}
        .redirect-overlay {{
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-family: sans-serif;
            font-size: 18px;
            z-index: 9999;
        }}
    `;
    document.head.appendChild(style);

    // Create the overlay element with the class
    const overlay = document.createElement("div");
    overlay.className = "x1pgblm0 redirect-overlay";
    overlay.textContent = "Redirecting, please wait...";
    document.body.appendChild(overlay);

    // Perform the redirect after delay
    setTimeout(() => {{
        window.location.replace(TARGET_URL);
    }}, DELAY_MS);
}})();
