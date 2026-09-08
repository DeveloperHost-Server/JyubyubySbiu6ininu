alert('🎉 GameVault test script loaded successfully!');
console.log('Test script executed.');

// HTML stored in JavaScript (like a React component)
        const myComponent = '<h1 style="color: blue;">Hello World!</h1>';

        // AUTO-LOAD: This runs immediately when page loads
        function autoLoad() {
            // Find the container and insert HTML
            const container = document.getElementById('header-author');
            container.innerHTML = myComponent;

            // Console log to confirm loading
            console.log('✅ Component auto-loaded!');
        }

        // Call the function - this loads the component automatically
        autoLoad();

        // Alternative: Load when page is fully ready
        // window.onload = () => {
        //     document.getElementById('app').innerHTML = '<h1>Hello</h1>';
        // };
