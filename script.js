async function loadEvents() {
    const response = await fetch('events.json'); // Load events
    const events = await response.json();
    const currentDate = new Date(); // Get the current date

    const timeline = document.getElementById('timeline');
    const graphCanvas = document.getElementById('background-graph');
    const ctx = graphCanvas.getContext('2d');

    // Set canvas dimensions
    const totalWidth = graphCanvas.offsetWidth;
    graphCanvas.width = totalWidth;
    graphCanvas.height = 300;

    const devicePixelRatio = window.devicePixelRatio || 1;
    graphCanvas.width = totalWidth * devicePixelRatio;
    graphCanvas.height = 300 * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const graphData = {
        health: [{ x: 0, y: 0 }],
        certificate: [{ x: 0, y: 0 }],
        project: [{ x: 0, y: 0 }],
        training: [{ x: 0, y: 0 }],
    };

    let eventCounter = 0;

    // Build graph data in chronological order
    events.forEach((event) => {
        const { type } = event;

        if (graphData[type]) {
            eventCounter++;
            const lastPoint = graphData[type][graphData[type].length - 1];
            graphData[type].push({ x: eventCounter, y: lastPoint.y + 1 });
        }

        Object.keys(graphData).forEach((key) => {
            if (key !== type) {
                const lastPoint = graphData[key][graphData[key].length - 1];
                graphData[key].push({ x: eventCounter, y: lastPoint.y });
            }
        });
    });

    const projectionData = generateProjectionData(graphData, eventCounter, 3);
    drawGraph(ctx, graphData, eventCounter + 3, totalWidth, projectionData);

    // Display timeline in reverse order for the most recent event first
    [...events].reverse().forEach((event) => {
        const { date, title, description, type } = event;

        // Determine if the event is in-progress based on the date
        const eventDate = new Date(date);
        const isInProgress = eventDate > currentDate;

        const eventEl = document.createElement('div');
        eventEl.className = `event ${isInProgress ? 'in-progress' : type}`;
        eventEl.innerHTML = `
            <strong>${date}</strong><br>${title}
            <div class="event-details">${description}</div>
        `;
        timeline.appendChild(eventEl);
    });

    // Add interaction for graph hover and click
    addGraphHoverClickInteraction(graphCanvas, events, timeline, totalWidth, eventCounter + 3);
}

function addGraphHoverClickInteraction(graphCanvas, events, timeline, totalWidth, maxEvents) {
    const xSpacing = totalWidth / maxEvents; // Calculate spacing between events on the graph

    // Handle mousemove for hover effect
    graphCanvas.addEventListener('mousemove', (event) => {
        const closestEventIndex = getClosestEventIndex(event, graphCanvas, xSpacing, events.length);
        if (closestEventIndex !== null) {
            highlightEvent(closestEventIndex, timeline);
        }
    });

    // Handle click to scroll timeline
    graphCanvas.addEventListener('click', (event) => {
        const closestEventIndex = getClosestEventIndex(event, graphCanvas, xSpacing, events.length);
        if (closestEventIndex !== null) {
            scrollToEvent(timeline.children[events.length - closestEventIndex - 1], timeline);
        }
    });
}

function getClosestEventIndex(event, canvas, xSpacing, eventCount) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // Mouse X relative to canvas
    const closestEventIndex = Math.floor(mouseX / xSpacing);

    return closestEventIndex >= 0 && closestEventIndex < eventCount ? closestEventIndex : null;
}

function highlightEvent(index, timeline) {
    const events = Array.from(timeline.children);
    events.forEach((el, i) => {
        el.classList.toggle('highlight', i === events.length - index - 1);
    });
}

function scrollToEvent(eventEl, timeline) {
    const eventRect = eventEl.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const scrollLeft = timeline.scrollLeft + (eventRect.left - timelineRect.left - timelineRect.width / 2 + eventRect.width / 2);

    timeline.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

function drawGraph(ctx, graphData, maxX, totalWidth, projectionData = null) {
    const colors = {
        health: '#66bb6a',
        certificate: '#ffa726',
        project: '#2979ff',
        training: '#ab47bc',
        projection: '#ff8c8c'
    };

    const offsetX = 0;
    const offsetY = 300;
    const xSpacing = (totalWidth - offsetX * 2) / (maxX - 1);
    const yScaling = 10;

    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    Object.keys(graphData).forEach((type) => {
        ctx.strokeStyle = colors[type];
        ctx.beginPath();

        graphData[type].forEach((point, index) => {
            const x = offsetX + index * xSpacing;
            const y = offsetY - point.y * yScaling;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
        ctx.closePath();
    });

    if (projectionData) {
        Object.keys(projectionData).forEach((type) => {
            ctx.strokeStyle = colors.projection;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();

            projectionData[type].forEach((point, index) => {
                const x = offsetX + (point.x - 1) * xSpacing;
                const y = offsetY - point.y * yScaling;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
            ctx.closePath();
            ctx.setLineDash([]);
        });
    }
}

function generateProjectionData(graphData, currentMaxX, numFuturePoints = 3) {
    const projectionData = {};

    Object.keys(graphData).forEach((type) => {
        const lastPoint = graphData[type][graphData[type].length - 1];
        projectionData[type] = [];

        for (let i = 1; i <= numFuturePoints; i++) {
            projectionData[type].push({
                x: currentMaxX + i,
                y: lastPoint.y + i * 0.1
            });
        }
    });

    return projectionData;
}

// Load events and render graph
loadEvents();
