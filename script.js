async function loadEvents() {
    const response = await fetch('events.json'); // Load the events
    const events = await response.json();
  
    const timeline = document.getElementById('timeline');
    const graphCanvas = document.getElementById('background-graph');
    const ctx = graphCanvas.getContext('2d');
  
    const totalWidth = timeline.scrollWidth + 100; // Add padding
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
      training: [{ x: 0, y: 0 }]
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
        if (!graphData[key].find((point) => point.x === eventCounter)) {
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
  
    const maxX = eventCounter;
    Object.keys(graphData).forEach((type) => {
      const lastPoint = graphData[type][graphData[type].length - 1];
      if (lastPoint.x < maxX) {
        graphData[type].push({ x: maxX, y: lastPoint.y });
      }
    });
  
    drawGraph(ctx, graphData, maxX, totalWidth);
  }
  
  function drawGraph(ctx, graphData, maxX, totalWidth) {
    const colors = {
      health: '#4CAF50',
      certificate: '#FF9800',
      project: '#2196F3',
      training: '#8E44AD'
    };
  
    const offsetX = 0;
    const offsetY = 200;
    const xSpacing = totalWidth / maxX;
    const yScaling = 20;
  
    ctx.lineWidth = 2;
  
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
    });
  }
  
  loadEvents();
  