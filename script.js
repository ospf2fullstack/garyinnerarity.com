const notesDir = "notes/";
const noteList = document.getElementById("note-list");
const mainView = document.getElementById("main-view");
const outlinePane = document.getElementById("outline-pane");

let allNotes = [];

// Simulated file list (replace with real file discovery if served from a backend)
const files = [
  "welcome.md",
  "projects.md",
  "about.md"
];

// Load all notes at startup
async function loadAllNotes() {
  allNotes = await Promise.all(
    files.map(async (filename) => {
      const res = await fetch(`${notesDir}${filename}`);
      const content = await res.text();
      return { filename, content };
    })
  );
  renderNoteList();
  buildGraph();
}

// Populate the sidebar
function renderNoteList() {
  noteList.innerHTML = "";
  allNotes.forEach((note) => {
    const li = document.createElement("li");
    li.textContent = note.filename.replace(".md", "");
    li.onclick = () => {
      renderMarkdown(note.content);
      renderOutline(note.content);
    };
    noteList.appendChild(li);
  });
}

// Markdown → HTML
function renderMarkdown(md) {
  const html = marked.parse(md);
  mainView.innerHTML = html;
  // Handle internal [[wikilinks]]
  mainView.querySelectorAll("p").forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
      return `<a href="#" onclick="loadLinkedNote('${link}')">${link}</a>`;
    });
  });
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
    renderMarkdown(found.content);
    renderOutline(found.content);
  } else {
    mainView.innerHTML = `<p>🔍 Note not found: ${linkName}.md</p>`;
  }
}

// Graph rendering
function buildGraph() {
  const nodes = allNotes.map(note => ({ id: note.filename, label: note.filename.replace(".md", "") }));
  const edges = [];

  allNotes.forEach(note => {
    const links = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)];
    links.forEach(link => {
      const target = `${link[1]}.md`;
      if (files.includes(target)) {
        edges.push({ from: note.filename, to: target });
      }
    });
  });

  const container = document.getElementById("graph-pane");
  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };
  const options = {
    layout: { improvedLayout: true },
    nodes: { shape: "dot", size: 12, font: { size: 16 } },
    edges: { arrows: "to", smooth: true },
  };
  new vis.Network(container, data, options);
}

// Initialize
loadAllNotes();
