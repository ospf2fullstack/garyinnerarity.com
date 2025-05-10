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

// Populate the sidebar
function renderNoteList() {
  noteList.innerHTML = "";
  allNotes.forEach((note) => {
    const li = document.createElement("li");
    li.textContent = note.filename.replace(".md", "");
    li.onclick = () => {
      renderMarkdown(note.content, note.filename);
      renderOutline(note.content);
    };
    noteList.appendChild(li);
  });
}

// Markdown → HTML
function renderMarkdown(md, filename) {
  const html = marked.parse(md);
  mainView.innerHTML = html;
  // Handle internal [[wikilinks]]
  mainView.querySelectorAll("p").forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
      return `<a href="#" onclick="loadLinkedNote('${link}')">${link}</a>`;
    });
  });

  // Update the graph for the selected note
  buildGraph(filename);
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
      nodes.push({
        id: note.filename,
        label: note.filename.replace(/^.*[\\/]/, '').replace(".md", ""),
        title: note.filename
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

  const container = document.getElementById("graph-pane");
  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };
  const options = {
    layout: { improvedLayout: true },
    nodes: {
      shape: "dot",
      size: 12,
      font: { size: 16, color: "#ffffff" }, // Darken node text color
    },
    edges: { arrows: "to", smooth: true },
  };
  new vis.Network(container, data, options);
}

// Initialize
loadAllNotes();
