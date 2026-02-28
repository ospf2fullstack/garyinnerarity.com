/* ═══════════════════════════════════════════════════════════════
   GARY INNERARITY — PORTFOLIO SCRIPT
   Components:
     1. Nav — active section tracking
     2. Notes viewer — sidebar + markdown content + outline
     3. Timeline — loaded from events.json with filtering
   ═══════════════════════════════════════════════════════════════ */

// ── 1. NAV: ACTIVE SECTION TRACKING ───────────────────────────
(function initNav() {
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('main > section[id]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.toggle(
              'active',
              link.getAttribute('href') === `#${entry.target.id}`
            );
          });
        }
      });
    },
    { rootMargin: `-${60}px 0px -60% 0px`, threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
})();

// ── 2. NOTES VIEWER ───────────────────────────────────────────
const notesDir = 'notes/';
const noteList = document.getElementById('note-list');
const mainView = document.getElementById('main-view');
const outlinePane = document.getElementById('outline-pane');

let allNotes = [];
let files = [];

// ── Marked setup ──────────────────────────────────────────────
const markedFn = (typeof marked !== 'undefined')
  ? (marked.marked || marked)
  : null;

if (markedFn) {
  // Wikilink extension [[Note Name]]
  try {
    marked.use({
      extensions: [{
        name: 'wikilink',
        level: 'inline',
        start(src) { return src.indexOf('[['); },
        tokenizer(src) {
          const match = /^\[\[([^\]]+)\]\]/.exec(src);
          if (match) return { type: 'wikilink', raw: match[0], text: match[1].trim() };
        },
        renderer(token) {
          return `<a href="#" data-wikilink="${token.text}">${token.text}</a>`;
        }
      }]
    });
  } catch (e) {
    console.warn('wikilink extension failed:', e);
  }
}

// ── Load notes ────────────────────────────────────────────────
async function loadAllNotes() {
  try {
    const res = await fetch(`${notesDir}file-list.json`);
    files = await res.json();

    allNotes = await Promise.all(
      files.map(async (filename) => {
        const r = await fetch(`${notesDir}${filename}`);
        const content = await r.text();
        return { filename, content };
      })
    );

    renderNoteList();
  } catch (err) {
    console.error('Failed to load notes:', err);
  }
}

// ── Render sidebar note list ───────────────────────────────────
function renderNoteList() {
  noteList.innerHTML = '';

  const groups = {};
  allNotes.forEach((note) => {
    const parts = note.filename.split('/');
    const group = parts.length > 1 ? parts[0] : 'General';
    if (!groups[group]) groups[group] = [];
    groups[group].push(note);
  });

  Object.keys(groups).sort().forEach((group) => {
    const folderLi = document.createElement('li');
    folderLi.textContent = group.charAt(0).toUpperCase() + group.slice(1).replace(/-/g, ' ');
    folderLi.classList.add('folder');
    noteList.appendChild(folderLi);

    const ul = document.createElement('ul');
    folderLi.onclick = () => {
      folderLi.classList.toggle('expanded');
      ul.classList.toggle('expanded');
    };

    groups[group].forEach((note) => {
      const li = document.createElement('li');
      li.textContent = note.filename.replace(/^.*\//, '').replace('.md', '');
      li.classList.add('note');
      li.dataset.filename = note.filename;
      li.onclick = () => openNote(note);
      ul.appendChild(li);
    });

    noteList.appendChild(ul);
  });
}

// ── Open / render a note ───────────────────────────────────────
function openNote(note) {
  // Mark active
  document.querySelectorAll('#note-list .note').forEach((el) => {
    el.classList.toggle('active', el.dataset.filename === note.filename);
  });

  renderMarkdown(note.content, note.filename);
  renderOutline(note.content);
}

function renderMarkdown(md, filename) {
  if (!markedFn) {
    mainView.innerHTML = `<div id="note-content"><pre>${md}</pre></div>`;
    return;
  }

  const renderer = new markedFn.Renderer();

  renderer.code = (code, language) => {
    language = language || (typeof code === 'object' && code.lang) || 'plaintext';
    const content = typeof code === 'object' && code.text ? code.text : String(code);
    if (language === 'mermaid') {
      return `<div class="mermaid">${content}</div>`;
    }
    return `<pre><code class="language-${language}">${content}</code></pre>`;
  };

  const html = markedFn(md, { renderer });
  mainView.innerHTML = `<div id="note-content">${html}</div>`;

  // Mermaid
  if (window.mermaid) {
    try {
      mermaid.init(undefined, mainView.querySelectorAll('.mermaid'));
    } catch (e) { /* */ }
  }

  // Highlight.js
  if (window.hljs) {
    mainView.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

function renderOutline(content) {
  const headings = content.match(/^#{1,6} .+/gm) || [];
  if (!headings.length) {
    outlinePane.innerHTML = '';
    return;
  }

  const heading = document.createElement('h3');
  heading.textContent = 'Outline';
  outlinePane.innerHTML = '';
  outlinePane.appendChild(heading);

  headings.forEach((h) => {
    const level = h.match(/^#+/)[0].length;
    const text = h.replace(/^#+ /, '');
    const div = document.createElement('div');
    div.textContent = text;
    div.style.paddingLeft = `${(level - 1) * 12}px`;
    outlinePane.appendChild(div);
  });
}

// ── Wikilink click delegation ──────────────────────────────────
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-wikilink]');
  if (!a) return;
  e.preventDefault();
  const linkBase = a.getAttribute('data-wikilink');
  const resolved = resolveNoteFilename(linkBase);
  if (resolved) {
    const note = allNotes.find((n) => n.filename === resolved);
    if (note) openNote(note);
  } else {
    mainView.innerHTML = `<div id="note-content"><p style="color:var(--text-faint);font-family:var(--mono);font-size:.875rem;">Note not found: ${linkBase}</p></div>`;
  }
});

function resolveNoteFilename(linkBase) {
  if (!files.length) return null;
  let candidate = files.find((f) => f === `${linkBase}.md`);
  if (candidate) return candidate;
  candidate = files.find((f) => f.split('/').pop() === `${linkBase}.md`);
  if (candidate) return candidate;
  const lower = linkBase.toLowerCase();
  return files.find((f) => f.split('/').pop().toLowerCase() === `${lower}.md`) || null;
}

// ── 3. TIMELINE ────────────────────────────────────────────────
async function loadTimeline() {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  try {
    const res = await fetch('events.json');
    const events = await res.json();

    // Sort newest first
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    events.forEach((event) => {
      const li = document.createElement('li');
      li.classList.add('timeline-entry');
      li.dataset.type = event.type;

      const date = new Date(event.date + 'T12:00:00');
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short'
      });

      li.innerHTML = `
        <div class="timeline-date">${formatted}</div>
        <span class="timeline-type timeline-type--${event.type}">${event.type}</span>
        <div class="timeline-title">${event.title}</div>
        <div class="timeline-desc">${event.description}</div>
      `;

      list.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load timeline:', err);
  }
}

// ── Timeline filters ───────────────────────────────────────────
(function initTimelineFilters() {
  const container = document.querySelector('.timeline-filters');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    // Update active button
    container.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('filter-btn--active'));
    btn.classList.add('filter-btn--active');

    const filter = btn.dataset.filter;

    document.querySelectorAll('.timeline-entry').forEach((entry) => {
      const show = filter === 'all' || entry.dataset.type === filter;
      entry.classList.toggle('hidden', !show);
    });
  });
})();

// ── Init ───────────────────────────────────────────────────────
loadAllNotes();
loadTimeline();

// ── 4. SKILLS VIEWER ──────────────────────────────────────────
const skillsDir      = 'skills/';
const skillNoteList  = document.getElementById('skills-note-list');
const skillsView     = document.getElementById('skills-main-view');
const skillsOutline  = document.getElementById('skills-outline-pane');

let allSkills = [];
let skillFiles = [];
let currentSkillRaw = '';

async function loadAllSkills() {
  try {
    const res = await fetch(`${skillsDir}file-list.json`);
    skillFiles = await res.json();

    allSkills = await Promise.all(
      skillFiles.map(async (filename) => {
        const r = await fetch(`${skillsDir}${filename}`);
        const content = await r.text();
        return { filename, content };
      })
    );

    renderSkillList();
  } catch (err) {
    console.error('Failed to load skills:', err);
  }
}

function renderSkillList() {
  if (!skillNoteList) return;
  skillNoteList.innerHTML = '';

  const groups = {};
  allSkills.forEach((skill) => {
    const parts = skill.filename.split('/');
    const group = parts.length > 1 ? parts[0] : 'General';
    if (!groups[group]) groups[group] = [];
    groups[group].push(skill);
  });

  Object.keys(groups).sort().forEach((group) => {
    const folderLi = document.createElement('li');
    folderLi.textContent = group.charAt(0).toUpperCase() + group.slice(1).replace(/-/g, ' ');
    folderLi.classList.add('folder');
    skillNoteList.appendChild(folderLi);

    const ul = document.createElement('ul');
    folderLi.onclick = () => {
      folderLi.classList.toggle('expanded');
      ul.classList.toggle('expanded');
    };

    groups[group].forEach((skill) => {
      const li = document.createElement('li');
      li.textContent = skill.filename.replace(/^.*\//, '').replace('.md', '');
      li.classList.add('note');
      li.dataset.filename = skill.filename;
      li.onclick = () => openSkill(skill);
      ul.appendChild(li);
    });

    skillNoteList.appendChild(ul);
  });

  // Auto-expand first group if only one
  const folders = skillNoteList.querySelectorAll('li.folder');
  if (folders.length === 1) folders[0].click();
}

function openSkill(skill) {
  currentSkillRaw = skill.content;

  document.querySelectorAll('#skills-note-list .note').forEach((el) => {
    el.classList.toggle('active', el.dataset.filename === skill.filename);
  });

  renderSkillContent(skill.content);
  renderSkillOutline(skill.content);
}

function renderSkillContent(md) {
  if (!markedFn) {
    skillsView.innerHTML = `
      <div class="skills-toolbar">
        <button class="copy-btn" id="skills-copy-btn">Copy</button>
      </div>
      <div id="note-content"><pre>${md}</pre></div>`;
    return;
  }

  const renderer = new markedFn.Renderer();
  renderer.code = (code, language) => {
    language = language || (typeof code === 'object' && code.lang) || 'plaintext';
    const content = typeof code === 'object' && code.text ? code.text : String(code);
    if (language === 'mermaid') return `<div class="mermaid">${content}</div>`;
    return `<pre><code class="language-${language}">${content}</code></pre>`;
  };

  const html = markedFn(md, { renderer });
  skillsView.innerHTML = `
    <div class="skills-toolbar">
      <button class="copy-btn" id="skills-copy-btn">Copy</button>
    </div>
    <div id="note-content">${html}</div>`;

  if (window.mermaid) {
    try { mermaid.init(undefined, skillsView.querySelectorAll('.mermaid')); } catch (e) { /* */ }
  }
  if (window.hljs) {
    skillsView.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
  }
}

function renderSkillOutline(content) {
  if (!skillsOutline) return;
  const headings = content.match(/^#{1,6} .+/gm) || [];
  if (!headings.length) { skillsOutline.innerHTML = ''; return; }

  const heading = document.createElement('h3');
  heading.textContent = 'Outline';
  skillsOutline.innerHTML = '';
  skillsOutline.appendChild(heading);

  headings.forEach((h) => {
    const level = h.match(/^#+/)[0].length;
    const text  = h.replace(/^#+ /, '');
    const div   = document.createElement('div');
    div.textContent = text;
    div.style.paddingLeft = `${(level - 1) * 12}px`;
    skillsOutline.appendChild(div);
  });
}

// ── Copy button ────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#skills-copy-btn');
  if (!btn || !currentSkillRaw) return;

  navigator.clipboard.writeText(currentSkillRaw).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = currentSkillRaw;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
});

loadAllSkills();
