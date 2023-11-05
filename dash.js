// // theme preferences
// localStorage.getItem("theme");
// localStorage.getItem("theme", updateTheme);

// document.setTheme('.button-link'{
//     function updateTheme() {
//         const systemSettingDark = window.matchMedia("(prefers-color-scheme: dark)");
//         const systemSettingLight = windows.matchMedia("(prefers-color-scheme: light)");
//     }
//     updateTheme();

// );


// date & time data
document.addEventListener("DOMContentLoaded", function() {
    function updateDateTime() {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', dateOptions);
        document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-US');
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// button function to load iframes, or whatever content
document.querySelectorAll('.showGraphButton').forEach(function(button) {
    button.addEventListener('click', function() {
        // Hide all iframes
        document.querySelectorAll('.graph iframe').forEach(function(iframe) {
            iframe.style.display = 'none';
        });

        // Show the associated iframe
        var iframeId = button.getAttribute('data-iframe');
        document.getElementById(iframeId).style.display = 'block';
    });
});

