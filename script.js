const notesDir = "notes/";
const noteList = document.getElementById("note-list");
const mainView = document.getElementById("main-view");
const outlinePane = document.getElementById("outline-pane");

let allNotes = [];
let files = []; // Declare files globally to store the dynamically fetched file list

// Load all notes at startup
async function loadAllNotes() {
  // Fetch the list of files dynamically
  const res = await fetch(`${notesDir}file-list.json`);
  files = await res.json(); // Store the fetched file paths globally

  allNotes = await Promise.all(
    files.map(async (filename) => {
      const res = await fetch(`${notesDir}${filename}`);
      const content = await res.text();
      return { filename, content };
    })
  );
  renderNoteList();
  buildGraph(); // Use the global files array
}

// Populate the sidebar with intelligent grouping
function renderNoteList() {
  noteList.innerHTML = "";
  // Group notes by folder (e.g., technicals/)
  const groups = {};
  allNotes.forEach((note) => {
    const parts = note.filename.split("/");
    const group = parts.length > 1 ? parts[0] : "General";
    if (!groups[group]) groups[group] = [];
    groups[group].push(note);
  });

  // Render groups
  Object.keys(groups).sort().forEach((group) => {
    const groupHeader = document.createElement("li");
    groupHeader.textContent = group.charAt(0).toUpperCase() + group.slice(1);
    groupHeader.classList.add("folder", "collapsed");
    groupHeader.onclick = () => {
      groupHeader.classList.toggle("collapsed");
      groupHeader.classList.toggle("expanded");
    };
    noteList.appendChild(groupHeader);

    const groupList = document.createElement("ul");
    groups[group].forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note.filename.replace(/^.*\//, "").replace(".md", "");
      li.classList.add("note");
      // Ensure note selection works by checking if `note.content` exists
      li.onclick = () => {
        if (note.content) {
          renderMarkdown(note.content, note.filename);
          renderOutline(note.content);
          // Debugging: Log note content to verify
          console.log(`Rendering note: ${note.filename}`, note.content);
          if (window.innerWidth <= 600) closeSidebar();
        } else {
          console.error(`Content for note ${note.filename} is missing.`);
        }
      };
      groupList.appendChild(li);
    });
    noteList.appendChild(groupList);
  });
}

// Ensure `marked` is correctly accessed
const markedFn = marked.marked || marked;
if (typeof markedFn !== 'function') {
  console.error('The `marked` library is not loaded correctly or is not a function.');
  console.log('Debugging `marked`:', marked);
}

// Markdown → HTML
// Add Mermaid and Highlight.js support
// Add debugging logs to verify
function renderMarkdown(md, filename) {
  console.log(`Rendering Markdown for file: ${filename}`);
  console.log(`Markdown content:`, md);

  const renderer = new markedFn.Renderer();

  // Custom renderer for Mermaid blocks
  renderer.code = (code, language) => {
    // Use the `lang` property if available
    language = language || (typeof code === "object" && code.lang) || "plaintext";
    console.log(`Processing code block with language: ${language}`);
    console.log(`Raw code parameter:`, code);

    // Extract the actual code content if `code` is an object
    const codeContent = typeof code === "object" && code.text ? code.text : String(code);

    if (language === "mermaid") {
      console.log(`Mermaid code:`, codeContent);
      return `<div class="mermaid">${codeContent}</div>`;
    }
    return `<pre><code class="language-${language}">${codeContent}</code></pre>`;
  };

  // Parse Markdown with custom renderer
  const html = markedFn(md, { renderer });
  console.log(`Generated HTML:`, html);

  const noteDiv = `<div id="note-content">${html}</div>`;
  mainView.innerHTML = noteDiv;

  // Handle internal [[wikilinks]]
  mainView.querySelectorAll("#note-content p").forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
      return `<a href="#" onclick="loadLinkedNote('${link}')">${link}</a>`;
    });
  });

  // Initialize Mermaid
  if (window.mermaid) {
    console.log(`Initializing Mermaid diagrams...`);
    mermaid.init(undefined, mainView.querySelectorAll(".mermaid"));
  }

  // Initialize Highlight.js
  if (window.hljs) {
    console.log(`Initializing syntax highlighting...`);
    mainView.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

// Outline from headings
function renderOutline(content) {
  const headings = content.match(/^#{1,6} .+/gm) || [];
  const html = headings
    .map((h) => {
      const level = h.match(/^#+/)[0].length;
      const text = h.replace(/^#+ /, '');
      return `<div style="margin-left:${(level - 1) * 10}px;">${text}</div>`;
    })
    .join("");
  outlinePane.innerHTML = `<h3>🧭 Outline</h3>${html}`;
}

// Follow [[wikilink]]
function loadLinkedNote(linkName) {
  const found = allNotes.find(n => n.filename === `${linkName}.md`);
  if (found) {
    renderMarkdown(found.content, found.filename);
    renderOutline(found.content);
  } else {
    mainView.innerHTML = `<p>🔍 Note not found: ${linkName}.md</p>`;
  }
}

// Graph rendering
function buildGraph(selectedNote = null) {
  const nodes = [];
  const edges = [];

  const folderColors = {};
  const colorPalette = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFF5"];
  let colorIndex = 0;

  if (selectedNote && selectedNote !== "welcome.md") {
    // Filter graph to show only the selected note and its linked nodes
    const selectedNode = allNotes.find(note => note.filename === selectedNote);
    if (selectedNode) {
      nodes.push({
        id: selectedNode.filename,
        label: selectedNode.filename.replace(/^.*[\\/]/, '').replace(".md", ""),
        title: selectedNode.filename
      });

      const links = [...selectedNode.content.matchAll(/\[\[([^\]]+)\]\]/g)];
      links.forEach(link => {
        const target = files.find(f => f.endsWith(`${link[1]}.md`));
        if (target) {
          nodes.push({
            id: target,
            label: target.replace(/^.*[\\/]/, '').replace(".md", ""),
            title: target
          });
          edges.push({ from: selectedNode.filename, to: target });
        }
      });
    }
  } else {
    // Show the full graph
    allNotes.forEach(note => {
      const folder = note.filename.includes("/") ? note.filename.split("/")[0] : "General";
      if (!folderColors[folder]) {
        folderColors[folder] = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;
      }

      nodes.push({
        id: note.filename,
        label: note.filename.replace(/^.*[\\/]/, '').replace(".md", ""),
        title: note.filename,
        group: folder
      });

      const links = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)];
      links.forEach(link => {
        const target = files.find(f => f.endsWith(`${link[1]}.md`));
        if (target) {
          edges.push({ from: note.filename, to: target });
        }
      });
    });
  }

  // Always render in the right pane's graph-pane
  const container = document.getElementById("graph-pane");
  if (!container) return;

  // On mobile, use a mini graph style
  const isMobile = window.innerWidth <= 600;
  const options = {
    layout: { improvedLayout: true },
    nodes: {
      shape: "dot",
      size: isMobile ? 8 : 12,
      font: { size: isMobile ? 10 : 16, color: "#ffffff" },
    },
    edges: { arrows: "to", smooth: true },
    groups: Object.fromEntries(
      Object.entries(folderColors).map(([folder, color]) => [folder, { color: { background: color } }])
    ),
    height: isMobile ? "120px" : "100%",
    width: isMobile ? "100vw" : "100%"
  };
  container.innerHTML = "";
  const network = new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, options);

  // Add click event listener to open the corresponding note
  network.on("click", function (params) {
    if (params.nodes.length > 0) {
      const clickedNodeId = params.nodes[0];
      const clickedNote = allNotes.find(note => note.filename === clickedNodeId);
      if (clickedNote) {
        renderMarkdown(clickedNote.content, clickedNote.filename);
        renderOutline(clickedNote.content);
      }
    }
  });
}

// Add a mobile sidebar toggle button if not present
function ensureSidebarToggle() {
  if (!document.getElementById("sidebar-toggle")) {
    const btn = document.createElement("button");
    btn.id = "sidebar-toggle";
    btn.innerHTML = "☰ Menu";
    btn.setAttribute("aria-label", "Open menu");
    document.body.appendChild(btn);
    btn.onclick = () => {
      sidebar.style.display = "flex";
      sidebarVisible = true;
      btn.style.display = "none";
      // Add overlay to close sidebar
      if (!document.getElementById("sidebar-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "sidebar-overlay";
        overlay.style.position = "fixed";
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(0,0,0,0.3)";
        overlay.style.zIndex = 199;
        overlay.onclick = closeSidebar;
        document.body.appendChild(overlay);
      }
    };
  }
}

function closeSidebar() {
  sidebar.style.display = "none";
  sidebarVisible = false;
  const btn = document.getElementById("sidebar-toggle");
  if (btn) btn.style.display = "block";
  const overlay = document.getElementById("sidebar-overlay");
  if (overlay) overlay.remove();
}

// Show/hide sidebar and toggle button on resize
function handleResize() {
  if (window.innerWidth <= 600) {
    sidebar.style.display = sidebarVisible ? "flex" : "none";
    const btn = document.getElementById("sidebar-toggle");
    if (btn) btn.style.display = sidebarVisible ? "none" : "block";
  } else {
    sidebar.style.display = "flex";
    const btn = document.getElementById("sidebar-toggle");
    if (btn) btn.style.display = "none";
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.remove();
  }
}

window.addEventListener("resize", () => {
  handleResize();
  buildGraph();
});
document.addEventListener("DOMContentLoaded", () => {
  ensureSidebarToggle();
  handleResize();
});

// Initialize
loadAllNotes();
