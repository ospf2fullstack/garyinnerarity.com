const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://xqhgsd62ea.execute-api.us-east-1.amazonaws.com/Production/visitorCount');
xhr.onload = function() {
    console.log('Lambda function triggered successfully');
};
xhr.onerror = function(err) {
    console.error('Error triggering Lambda function:', err);
};
xhr.send();