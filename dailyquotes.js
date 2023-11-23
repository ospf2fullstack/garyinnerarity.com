document.addEventListener('DOMContentLoaded', function() {
    fetchQuotes().then(data => {
        if (data && data.daily && data.daily.quotes) {
            displayRandomQuote(data.daily.quotes);
        }
    });
});

function fetchQuotes() {
    const url = 'https://xqhgsd62ea.execute-api.us-east-1.amazonaws.com/Production/quotes';
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.statusCode === 200) {
                return data.body;
            } else {
                console.error('Failed to fetch quotes');
                return null;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            return null;
        });
}

function displayRandomQuote(quotes) {
    const container = document.getElementById('quotes-container');
    container.innerHTML = ''; // Clear existing content

    if (quotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const selectedQuote = quotes[randomIndex].quote;

        const p = document.createElement('p');
        p.textContent = selectedQuote;
        container.appendChild(p);
    } else {
        container.textContent = 'No quotes available.';
    }
}
