const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://xqhgsd62ea.execute-api.us-east-1.amazonaws.com/Production/visitorCount');
xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
        const response = xhr.responseText;
        document.getElementById('visitorcount').textContent = response;
    }
    // console.log('Lambda function triggered successfully');
};
xhr.onerror = function(err) {
    console.error('Error triggering Lambda function, you may be trying to bypass my CORS policy :)... or this:', err);
};
xhr.send();