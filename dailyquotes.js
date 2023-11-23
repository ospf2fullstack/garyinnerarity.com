document.addEventListener('DOMContentLoaded', function() {
    fetchQuote();
});

function fetchQuote() {
    const url = 'https://xqhgsd62ea.execute-api.us-east-1.amazonaws.com/Production/quotes';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.statusCode === 200) {
                // Parse the 'body' since it's a JSON string
                const quoteData = JSON.parse(data.body);
                displayQuote(quoteData);
            } else {
                throw new Error('Response status was not OK');
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            displayQuote({ quote: "Failed to load quote." });
        });
}

function displayQuote(quoteData) {
    const container = document.getElementById('quotes-container');
    if (container) {
        container.textContent = quoteData.quote;
    }
}

