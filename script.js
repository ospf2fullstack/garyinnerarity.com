function generateProjectionData(graphData, currentMaxX, numFuturePoints = 3) {
    const projectionData = {};

    Object.keys(graphData).forEach((type) => {
        const lastPoint = graphData[type][graphData[type].length - 1];
        projectionData[type] = [];

        for (let i = 1; i <= numFuturePoints; i++) {
            projectionData[type].push({
                x: currentMaxX + i, // Increment the x-axis
                y: lastPoint.y + i * 0.5 // Slight upward trend for the y-axis
            });
        }
    });

    return projectionData;
}

async function loadEvents() {
    const response = await fetch('events.json'); // Load events
    const events = await response.json();

    const timeline = document.getElementById('timeline');
    const graphCanvas = document.getElementById('background-graph');
    const ctx = graphCanvas.getContext('2d');

    const totalWidth = timeline.scrollWidth + 100;
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

    events.forEach((event) => {
        const { date, title, description, type } = event;

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

        const eventEl = document.createElement('div');
        eventEl.className = `event ${type}`;
        eventEl.innerHTML = `
            <strong>${date}</strong><br>${title}
            <div class="event-details">${description}</div>
        `;
        timeline.appendChild(eventEl);
    });

    // Generate projection data
    const projectionData = generateProjectionData(graphData, eventCounter, 3); // 3 future points

    // Draw graph with projections
    drawGraph(ctx, graphData, eventCounter + 3, totalWidth, projectionData);
}

function drawGraph(ctx, graphData, maxX, totalWidth, projectionData = null) {
    const colors = {
        health: '#66bb6a',
        certificate: '#ffa726',
        project: '#2979ff',
        training: '#ab47bc',
        projection: '#723131' // Projection line style
    };

    const offsetX = 0;
    const offsetY = 200;
    const xSpacing = totalWidth / maxX;
    const yScaling = 20;

    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    Object.keys(graphData).forEach((type) => {
        ctx.strokeStyle = colors[type];
        ctx.beginPath();

        graphData[type].forEach((point, index) => {
            const x = point.x * xSpacing + offsetX;
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

    // Draw projection lines
    if (projectionData) {
        Object.keys(projectionData).forEach((type) => {
            ctx.strokeStyle = colors.projection;
            ctx.setLineDash([10, 10]); // Dashed line for projection
            ctx.beginPath();

            projectionData[type].forEach((point, index) => {
                const x = point.x * xSpacing + offsetX;
                const y = offsetY - point.y * yScaling;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
            ctx.closePath();
            ctx.setLineDash([]); // Reset line style
        });
    }
}

loadEvents();
