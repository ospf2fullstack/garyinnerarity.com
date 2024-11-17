async function loadEvents() {
    const response = await fetch('events.json'); // Load events
    const events = await response.json();

    // Reverse events for display order, but keep original order for graph rendering
    const reversedEvents = [...events].reverse();

    const timeline = document.getElementById('timeline');
    const graphCanvas = document.getElementById('background-graph');
    const ctx = graphCanvas.getContext('2d');

    // Dynamically set canvas width to match scrollable timeline width
    const totalWidth = Math.max(timeline.scrollWidth, window.innerWidth);
    graphCanvas.style.width = `${totalWidth}px`;
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

    // Process events in chronological order to build graph data
    events.forEach((event) => {
        const { type } = event;

        if (graphData[type]) {
            eventCounter++;
            const lastPoint = graphData[type][graphData[type].length - 1];
            graphData[type].push({ x: eventCounter, y: lastPoint.y + 1 });
        }

        // Ensure other lines stay flat for missing event types
        Object.keys(graphData).forEach((key) => {
            if (key !== type) {
                const lastPoint = graphData[key][graphData[key].length - 1];
                graphData[key].push({ x: eventCounter, y: lastPoint.y });
            }
        });
    });

    // Render reversed events in the timeline for UI
    reversedEvents.forEach((event) => {
        const { date, title, description, type } = event;

        const eventEl = document.createElement('div');
        eventEl.className = `event ${type}`;
        eventEl.innerHTML = `
            <strong>${date}</strong><br>${title}
            <div class="event-details">${description}</div>
        `;
        timeline.appendChild(eventEl);
    });

    // Generate projection data for the graph
    const projectionData = generateProjectionData(graphData, eventCounter, 3);

    // Draw graph with projection data
    drawGraph(ctx, graphData, eventCounter + 3, totalWidth, projectionData);
}

function drawGraph(ctx, graphData, maxX, totalWidth, projectionData = null) {
    const colors = {
        health: '#66bb6a',
        certificate: '#ffa726',
        project: '#2979ff',
        training: '#ab47bc',
        projection: '#723131'
    };

    const offsetX = 20; // Padding for the graph start
    const offsetY = 200; // Baseline for the graph
    const xSpacing = (totalWidth - offsetX * 2) / maxX; // Dynamic horizontal scaling
    const yScaling = 20; // Vertical scaling for event counts

    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Draw the actual data lines
    Object.keys(graphData).forEach((type) => {
        ctx.strokeStyle = colors[type];
        ctx.beginPath();

        graphData[type].forEach((point, index) => {
            const x = offsetX + point.x * xSpacing;
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

    // Draw projection lines, if available
    if (projectionData) {
        Object.keys(projectionData).forEach((type) => {
            ctx.strokeStyle = colors.projection;
            ctx.setLineDash([10, 10]); // Dashed projection lines
            ctx.beginPath();

            projectionData[type].forEach((point, index) => {
                const x = offsetX + point.x * xSpacing;
                const y = offsetY - point.y * yScaling;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
            ctx.closePath();
            ctx.setLineDash([]); // Reset dash style for future drawings
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
                x: currentMaxX + i, // Increment x-axis
                y: lastPoint.y + i * 0.5 // Small upward trend
            });
        }
    });

    return projectionData;
}

// Load and render events with graph
loadEvents();
