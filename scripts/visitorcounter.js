const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://xqhgsd62ea.execute-api.us-east-1.amazonaws.com/Production/visitorCount');
xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
        const jsonResponse = JSON.parse(xhr.responseText);
        const count = jsonResponse.id;

        document.getElementById('visitorcount').textContent = id;
    }
    // console.log('Lambda function triggered successfully');
};
xhr.onerror = function(err) {
    console.error('Error triggering Lambda function, you may be trying to bypass my CORS policy :)... or this:', err);
};
xhr.send();