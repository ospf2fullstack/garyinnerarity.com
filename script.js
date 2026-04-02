/* ═══════════════════════════════════════════════════════════════
   GARY INNERARITY — PORTFOLIO SCRIPT
   Components:
     1. Nav — active section tracking
     2. Notes viewer — sidebar + markdown content + outline
     3. Timeline — loaded from events.json with filtering
   ═══════════════════════════════════════════════════════════════ */

// ── 1. NAV: ACTIVE SECTION TRACKING ───────────────────────────

// ── Accessibility: live region announcer ──────────────────────
function announceToScreenReader(message) {
  let region = document.getElementById('a11y-live-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'a11y-live-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.appendChild(region);
  }
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

(function initNav() {
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('main > section[id]');

  // Hamburger toggle for mobile
  const hamburger = document.querySelector('.nav-hamburger');
  const navList = document.getElementById('nav-links-list');
  if (hamburger && navList) {
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
      navList.classList.toggle('nav-open');
    });
    // Close menu when a link is clicked
    navList.addEventListener('click', (e) => {
      if (e.target.matches('a')) {
        hamburger.setAttribute('aria-expanded', 'false');
        navList.classList.remove('nav-open');
      }
    });
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navList.classList.contains('nav-open')) {
        hamburger.setAttribute('aria-expanded', 'false');
        navList.classList.remove('nav-open');
        hamburger.focus();
      }
    });
  }

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

// ── 2. MARKDOWN RENDERING (shared by Skills viewer) ───────────

// ── Marked setup ──────────────────────────────────────────────
const markedFn = (typeof marked !== 'undefined')
  ? (marked.marked || marked)
  : null;

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
    container.querySelectorAll('.filter-btn').forEach((b) => {
      b.classList.remove('filter-btn--active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('filter-btn--active');
    btn.setAttribute('aria-pressed', 'true');

    const filter = btn.dataset.filter;

    document.querySelectorAll('.timeline-entry').forEach((entry) => {
      const show = filter === 'all' || entry.dataset.type === filter;
      entry.classList.toggle('hidden', !show);
    });
  });
})();

// ── Init ───────────────────────────────────────────────────────
// Set initial aria-pressed on timeline filter buttons
(function initFilterAria() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.classList.contains('filter-btn--active') ? 'true' : 'false');
  });
})();

loadTimeline();

// ── 4. SKILLS VIEWER ──────────────────────────────────────────
const skillsDir      = 'skills/';
const skillNoteList  = document.getElementById('skills-note-list');
const skillsView     = document.getElementById('skills-main-view');
const skillsOutline  = document.getElementById('skills-outline-pane');

const skillCache = new Map();
let skillFiles = [];
let currentSkillRaw = '';

async function loadSkillList() {
  try {
    const res = await fetch(`${skillsDir}file-list.json`);
    skillFiles = await res.json();
    renderSkillList();
  } catch (err) {
    console.error('Failed to load skill list:', err);
  }
}

async function fetchSkillContent(filename) {
  if (skillCache.has(filename)) return skillCache.get(filename);
  const r = await fetch(`${skillsDir}${filename}`);
  const content = await r.text();
  skillCache.set(filename, content);
  return content;
}

function renderSkillList() {
  if (!skillNoteList) return;
  skillNoteList.innerHTML = '';

  const groups = {};
  skillFiles.forEach((filename) => {
    const parts = filename.split('/');
    const group = parts.length > 1 ? parts[0] : 'General';
    if (!groups[group]) groups[group] = [];
    groups[group].push(filename);
  });

  Object.keys(groups).sort().forEach((group) => {
    const folderLi = document.createElement('li');
    folderLi.textContent = group.charAt(0).toUpperCase() + group.slice(1).replace(/-/g, ' ');
    folderLi.classList.add('folder');
    folderLi.setAttribute('tabindex', '0');
    folderLi.setAttribute('role', 'button');
    folderLi.setAttribute('aria-expanded', 'false');
    skillNoteList.appendChild(folderLi);

    const ul = document.createElement('ul');
    const toggleSkillFolder = () => {
      const isExpanded = folderLi.classList.toggle('expanded');
      ul.classList.toggle('expanded');
      folderLi.setAttribute('aria-expanded', String(isExpanded));
    };
    folderLi.onclick = toggleSkillFolder;
    folderLi.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSkillFolder(); }
    };

    groups[group].forEach((filename) => {
      const li = document.createElement('li');
      li.textContent = filename.replace(/^.*\//, '').replace('.md', '');
      li.classList.add('note');
      li.setAttribute('tabindex', '0');
      li.setAttribute('role', 'button');
      li.dataset.filename = filename;
      li.onclick = () => openSkill(filename);
      li.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSkill(filename); }
      };
      ul.appendChild(li);
    });

    skillNoteList.appendChild(ul);
  });

  // Auto-expand first group if only one
  const folders = skillNoteList.querySelectorAll('li.folder');
  if (folders.length === 1) folders[0].click();
}

async function openSkill(filename) {
  document.querySelectorAll('#skills-note-list .note').forEach((el) => {
    el.classList.toggle('active', el.dataset.filename === filename);
  });

  skillsView.innerHTML = '<div id="note-content"><p style="color:var(--text-faint)">Loading…</p></div>';
  const content = await fetchSkillContent(filename);
  currentSkillRaw = content;
  renderSkillContent(content);
  renderSkillOutline(content);
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
    announceToScreenReader('Skill markdown copied to clipboard');
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
    announceToScreenReader('Skill markdown copied to clipboard');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
});

loadSkillList();

// ── 5. SYSTEM LIFECYCLE INTERACTION ─────────────────────────────
(function initLifecycle() {
  const phaseButtons = document.querySelectorAll('.phase-node');
  const phaseContents = document.querySelectorAll('.phase-content');
  const diagram = document.querySelector('.system-diagram');
  const visitedPhases = new Set();

  if (!phaseButtons.length) return;

  // Mark initial active phase as visited
  const initialActive = document.querySelector('.phase-node.active');
  if (initialActive) {
    visitedPhases.add(initialActive.dataset.phase);
    initialActive.classList.add('visited');
  }

  phaseButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const phase = btn.dataset.phase;

      // Track visited phases
      visitedPhases.add(phase);
      btn.classList.add('visited');

      // Update button states
      phaseButtons.forEach((b) => {
        const isActive = b.dataset.phase === phase;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });

      // Show corresponding content
      phaseContents.forEach((content) => {
        const isTarget = content.dataset.phase === phase;
        if (isTarget) {
          content.hidden = false;
          content.classList.add('active');
        } else {
          content.hidden = true;
          content.classList.remove('active');
        }
      });

      // When all 4 phases visited, collapse staircase into vertical stack
      if (visitedPhases.size === 4 && diagram) {
        diagram.classList.add('completed');
        announceToScreenReader('All phases explored — lifecycle complete');
      }

      // Announce to screen readers
      announceToScreenReader(`Viewing ${phase} phase`);
    });

    // Keyboard navigation
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = btn.nextElementSibling?.classList?.contains('phase-node')
          ? btn.nextElementSibling
          : phaseButtons[0];
        next?.focus();
        next?.click();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = btn.previousElementSibling?.classList?.contains('phase-node')
          ? btn.previousElementSibling
          : phaseButtons[phaseButtons.length - 1];
        prev?.focus();
        prev?.click();
      }
    });
  });
})();

// ── 6. SCROLL-DRIVEN NARRATIVE ENGINE ──────────────────────────

(function initScrollExperience() {
  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    // Instantly reveal everything
    document.querySelectorAll('.scroll-reveal, .narrative-bridge__text, .narrative-bridge__sub, .timeline-entry').forEach((el) => {
      el.classList.add('revealed');
    });
    return;
  }

  // ── Scroll Progress Bar ────────────────────────────────────
  const progressBar = document.getElementById('scroll-progress');
  if (progressBar) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          progressBar.style.width = progress + '%';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ── Scroll Reveal Observer ─────────────────────────────────
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -80px 0px', threshold: 0.1 }
  );

  // Observe all scroll-reveal elements
  document.querySelectorAll('.scroll-reveal').forEach((el) => {
    revealObserver.observe(el);
  });

  // ── Narrative Bridge Observer ──────────────────────────────
  const bridgeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.narrative-bridge__text, .narrative-bridge__sub').forEach((el) => {
            el.classList.add('revealed');
          });
          bridgeObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -60px 0px', threshold: 0.3 }
  );

  document.querySelectorAll('.narrative-bridge').forEach((bridge) => {
    bridgeObserver.observe(bridge);
  });

  // ── Staggered Card Reveals ─────────────────────────────────
  document.querySelectorAll('.stagger-parent').forEach((parent) => {
    const children = parent.children;
    Array.from(children).forEach((child, index) => {
      child.classList.add('scroll-reveal');
      child.style.setProperty('--stagger-index', index);
      revealObserver.observe(child);
    });
  });

  // ── Timeline Progressive Reveal ────────────────────────────
  const timelineObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          timelineObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.15 }
  );

  // Observe timeline entries after they're loaded
  const timelineList = document.getElementById('timeline-list');
  if (timelineList) {
    const timelineMo = new MutationObserver(() => {
      timelineList.querySelectorAll('.timeline-entry:not(.revealed)').forEach((entry) => {
        timelineObserver.observe(entry);
      });
    });
    timelineMo.observe(timelineList, { childList: true });
  }

  // ── Hero Parallax (subtle) ─────────────────────────────────
  const heroContainer = document.querySelector('#hero .container');
  if (heroContainer) {
    let heroTicking = false;
    window.addEventListener('scroll', () => {
      if (!heroTicking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const heroH = document.getElementById('hero').offsetHeight;
          if (scrollY < heroH) {
            const progress = scrollY / heroH;
            heroContainer.style.opacity = 1 - progress * 0.6;
            heroContainer.style.transform = `translateY(${scrollY * 0.15}px)`;
          }
          heroTicking = false;
        });
        heroTicking = true;
      }
    }, { passive: true });
  }

  // ── Immediately reveal hero elements that are in view ──────
  requestAnimationFrame(() => {
    document.querySelectorAll('#hero .scroll-reveal').forEach((el) => {
      el.classList.add('revealed');
    });
  });
})();