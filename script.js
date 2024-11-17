async function loadEvents() {
    const response = await fetch('events.json'); // Load the events
    const events = await response.json();
  
    const timeline = document.getElementById('timeline');
    const graphCanvas = document.getElementById('background-graph');
    const ctx = graphCanvas.getContext('2d');
  
    // Ensure the canvas width matches the full scrollable width of the timeline
    const totalWidth = timeline.scrollWidth + 100;
    graphCanvas.style.width = `${totalWidth}px`;
    graphCanvas.width = totalWidth;
    
    // Rest of your script remains the same
    
  
    graphCanvas.height = 300;
  
    // Adjust for high DPI screens
    const devicePixelRatio = window.devicePixelRatio || 1;
    graphCanvas.width = totalWidth * devicePixelRatio;
    graphCanvas.height = 300 * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  
    // Initialize graph data for all event types
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
  
      // Extend other lines to remain flat
      Object.keys(graphData).forEach((key) => {
        if (key !== type) {
          const lastPoint = graphData[key][graphData[key].length - 1];
          graphData[key].push({ x: eventCounter, y: lastPoint.y });
        }
      });
  
      // Create timeline event card
      const eventEl = document.createElement('div');
      eventEl.className = `event ${type}`;
      eventEl.innerHTML = `
        <strong>${date}</strong><br>${title}
        <div class="event-details">${description}</div>
      `;
      timeline.appendChild(eventEl);
    });
  
    // Draw the graph
    drawGraph(ctx, graphData, eventCounter, totalWidth);
  }
  
  function drawGraph(ctx, graphData, maxX, totalWidth) {
    const colors = {
      health: '#66bb6a',
      certificate: '#ffa726',
      project: '#2979ff',
      training: '#ab47bc',
    };
  
    const offsetX = 0;
    const offsetY = 200;
    const xSpacing = totalWidth / maxX; // Dynamically adjust spacing
    const yScaling = 20; // Tick height for each event
  
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
  