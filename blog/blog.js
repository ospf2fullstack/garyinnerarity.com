/* Blog reader for Markdown-backed posts. */

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

(function initBlogNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const navList = document.getElementById('nav-links-list');
  if (!hamburger || !navList) return;

  hamburger.addEventListener('click', () => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!expanded));
    navList.classList.toggle('nav-open');
  });

  navList.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      hamburger.setAttribute('aria-expanded', 'false');
      navList.classList.remove('nav-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navList.classList.contains('nav-open')) {
      hamburger.setAttribute('aria-expanded', 'false');
      navList.classList.remove('nav-open');
      hamburger.focus();
    }
  });
})();

const markedFn = (typeof marked !== 'undefined')
  ? (marked.marked || marked)
  : null;

const blogDir = './';
const postList = document.getElementById('blog-post-list');
const blogView = document.getElementById('blog-main-view');
const postCache = new Map();
let blogFiles = [];
let blogPosts = [];
let currentPostRaw = '';
let activeFilters = { type: 'all', tag: 'all' };

const metadataFields = new Set(['published', 'date', 'path', 'type', 'tags', 'category', 'categories', 'summary', 'description', 'audio']);

function slugFromFilename(filename) {
  return filename
    .replace(/^.*\//, '')
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFromMarkdown(markdown, filename) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return filename.replace(/^.*\//, '').replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
}

function parseMetadataLine(line) {
  const match = line.match(/^([A-Za-z][\w -]*):\s*(.+)?$/);
  if (!match) return null;
  const key = match[1].trim().toLowerCase().replace(/\s+/g, '-');
  if (!metadataFields.has(key)) return null;
  return [key, (match[2] || '').trim()];
}

function parseMetadataValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  if (trimmed.includes(',')) return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatterBlock(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)([\s\S]*)$/);
  if (!match) return null;

  const metadata = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const parsed = parseMetadataLine(line);
    if (!parsed) return;
    metadata[parsed[0]] = parseMetadataValue(parsed[1]);
  });

  return { metadata, body: match[2].trimStart() };
}

function parsePostMarkdown(markdown, filename) {
  const frontmatter = parseFrontmatterBlock(markdown);
  const metadata = frontmatter ? { ...frontmatter.metadata } : {};
  const source = frontmatter ? frontmatter.body : markdown;
  const lines = source.split(/\r?\n/);
  const bodyLines = [];

  lines.forEach((line, index) => {
    const parsed = parseMetadataLine(line);
    const isTopMetadata = parsed && (index < 12 || bodyLines.every((bodyLine) => bodyLine.trim() === '' || bodyLine.startsWith('#')));
    if (isTopMetadata) {
      metadata[parsed[0]] = parseMetadataValue(parsed[1]);
      return;
    }
    bodyLines.push(line);
  });

  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trimStart();
  return {
    filename,
    slug: slugFromFilename(filename),
    title: titleFromMarkdown(body, filename),
    published: metadata.published || metadata.date || '',
    metadata,
    body
  };
}

function getMetadataList(metadata, key) {
  const value = metadata[key];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function filterValue(value) {
  return String(value).trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAudioSource(metadata) {
  const [audio] = getMetadataList(metadata, 'audio');
  return audio ? String(audio).trim() : '';
}

function renderAudioPlayer(audioSrc, title) {
  if (!audioSrc) return '';
  const safeTitle = title ? `Listen to ${title}` : 'Listen to this post';
  return `
    <section class="blog-audio-player" aria-label="Audio version">
      <div class="blog-audio-player__eyebrow">Audio version</div>
      <div class="blog-audio-player__title">${escapeHtml(safeTitle)}</div>
      <audio class="blog-audio-player__control" controls preload="none" playsinline>
        <source src="${escapeHtml(audioSrc)}" type="audio/mpeg">
        Your browser does not support audio playback.
      </audio>
      <a class="blog-audio-player__link" href="${escapeHtml(audioSrc)}">Open audio in a new tab</a>
    </section>`;
}

async function fetchPostContent(filename) {
  if (postCache.has(filename)) return postCache.get(filename);
  const response = await fetch(`${blogDir}${filename}`);
  if (!response.ok) throw new Error(`Unable to load ${filename}`);
  const content = await response.text();
  postCache.set(filename, content);
  return content;
}

async function loadBlogList() {
  try {
    const response = await fetch(`${blogDir}file-list.json`);
    if (!response.ok) throw new Error('Unable to load blog file list');
    blogFiles = await response.json();
    await renderPostList();
    openInitialPost();
  } catch (error) {
    console.error('Failed to load blog list:', error);
    blogView.innerHTML = '<div class="notes-placeholder"><p>Blog posts are unavailable right now.</p></div>';
  }
}

async function renderPostList() {
  if (!postList) return;

  blogPosts = await Promise.all(blogFiles.map(async (filename) => {
    const markdown = await fetchPostContent(filename);
    return parsePostMarkdown(markdown, filename);
  }));

  renderBlogFilters();
  renderFilteredPostList();
}

function renderBlogFilters() {
  const sidebar = document.getElementById('blog-sidebar');
  if (!sidebar) return;

  let controls = document.getElementById('blog-filter-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'blog-filter-controls';
    controls.className = 'blog-filter-controls';
    sidebar.insertBefore(controls, postList);
  }

  const types = [...new Set(blogPosts.flatMap((post) => getMetadataList(post.metadata, 'type')))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const tags = [...new Set(blogPosts.flatMap((post) => getMetadataList(post.metadata, 'tags')))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const groups = [
    { key: 'type', label: 'Type', values: types },
    { key: 'tag', label: 'Tags', values: tags }
  ].filter((group) => group.values.length > 1);

  if (!groups.length) {
    controls.innerHTML = '';
    controls.hidden = true;
    return;
  }

  controls.hidden = false;
  controls.innerHTML = groups.map((group) => `
    <div class="blog-filter-group${group.key === 'tag' ? ' blog-filter-group--tags' : ''}" aria-label="Filter posts by ${escapeHtml(group.label.toLowerCase())}">
      <div class="blog-filter-label-row">
        <div class="blog-filter-label">${escapeHtml(group.label)}</div>
        ${group.key === 'tag' && group.values.length > 6 ? '<span class="blog-filter-note">Scroll</span>' : ''}
      </div>
      <div class="blog-filter-buttons${group.key === 'tag' ? ' blog-filter-buttons--tags' : ''}">
        ${['all', ...group.values].map((value) => {
    const label = value === 'all' ? 'All' : String(value);
    const isActive = activeFilters[group.key] === filterValue(value);
    return `<button class="filter-btn blog-filter-btn${isActive ? ' filter-btn--active' : ''}" type="button" data-filter-group="${group.key}" data-filter-value="${escapeHtml(filterValue(value))}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
  }).join('')}
      </div>
    </div>`).join('');
}

function renderFilteredPostList() {
  postList.innerHTML = '';

  const posts = blogPosts.filter((post) => {
    const matchesType = activeFilters.type === 'all' || getMetadataList(post.metadata, 'type').some((value) => filterValue(value) === activeFilters.type);
    const matchesTag = activeFilters.tag === 'all' || getMetadataList(post.metadata, 'tags').some((value) => filterValue(value) === activeFilters.tag);
    return matchesType && matchesTag;
  });

  if (!posts.length) {
    const empty = document.createElement('li');
    empty.classList.add('blog-post-empty');
    empty.textContent = 'No posts match these filters.';
    postList.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const item = document.createElement('li');
    item.classList.add('blog-post-item');
    item.dataset.filename = post.filename;
    item.dataset.slug = post.slug;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');

    const titleRow = document.createElement('div');
    titleRow.classList.add('blog-post-item__row');

    const title = document.createElement('span');
    title.classList.add('blog-post-item__title');
    title.textContent = post.title;
    titleRow.appendChild(title);

    if (getAudioSource(post.metadata)) {
      const audioBadge = document.createElement('span');
      audioBadge.classList.add('blog-post-item__badge');
      audioBadge.textContent = 'Audio';
      audioBadge.setAttribute('aria-label', 'Audio version available');
      titleRow.appendChild(audioBadge);
    }

    item.appendChild(titleRow);

    if (post.published) {
      const meta = document.createElement('span');
      meta.classList.add('blog-post-item__meta');
      meta.textContent = post.published;
      item.appendChild(meta);
    }

    item.addEventListener('click', () => openPost(post.filename, true));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPost(post.filename, true);
      }
    });

    postList.appendChild(item);
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.blog-filter-btn');
  if (!button) return;

  activeFilters[button.dataset.filterGroup] = button.dataset.filterValue;
  renderBlogFilters();
  renderFilteredPostList();
  announceToScreenReader('Blog filters updated');
});

function openInitialPost() {
  if (!blogFiles.length) return;
  const params = new URLSearchParams(window.location.search);
  const requestedPost = params.get('post');
  const match = blogFiles.find((filename) => (
    filename === requestedPost || slugFromFilename(filename) === requestedPost
  ));
  openPost(match || blogFiles[0], false);
}

async function openPost(filename, updateUrl) {
  document.querySelectorAll('#blog-post-list .blog-post-item').forEach((item) => {
    const isActive = item.dataset.filename === filename;
    item.classList.toggle('active', isActive);
    if (isActive) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  });

  blogView.innerHTML = '<div class="notes-placeholder"><p>Loading post...</p></div>';

  try {
    const content = await fetchPostContent(filename);
    const post = parsePostMarkdown(content, filename);
    currentPostRaw = post.body;
    renderPostContent(post);
    if (updateUrl) {
      const slug = slugFromFilename(filename);
      window.history.pushState({ post: filename }, '', `?post=${encodeURIComponent(slug)}`);
    }
    announceToScreenReader('Blog post loaded');
  } catch (error) {
    console.error('Failed to open post:', error);
    blogView.innerHTML = '<div class="notes-placeholder"><p>This post could not be loaded.</p></div>';
  }
}

function renderPostContent(post) {
  const markdown = post.body;
  const audioPlayer = renderAudioPlayer(getAudioSource(post.metadata), post.title);

  if (!markedFn) {
    blogView.innerHTML = `
      <div class="skills-toolbar">
        <button class="copy-btn" id="blog-copy-btn">Copy</button>
      </div>
      <div id="note-content">${audioPlayer}<pre>${escapeHtml(markdown)}</pre></div>`;
    return;
  }

  const renderer = new markedFn.Renderer();
  renderer.code = (code, language) => {
    const lang = language || (typeof code === 'object' && code.lang) || 'plaintext';
    const content = typeof code === 'object' && code.text ? code.text : String(code);
    return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(content)}</code></pre>`;
  };

  const html = markedFn(markdown, { renderer });
  blogView.innerHTML = `
    <div class="skills-toolbar">
      <button class="copy-btn" id="blog-copy-btn">Copy</button>
    </div>
    <div id="note-content">${audioPlayer}${html}</div>`;

  if (window.hljs) {
    blogView.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('#blog-copy-btn');
  if (!button || !currentPostRaw) return;

  navigator.clipboard.writeText(currentPostRaw).then(() => {
    button.textContent = 'Copied!';
    button.classList.add('copied');
    announceToScreenReader('Blog markdown copied to clipboard');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = currentPostRaw;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    button.textContent = 'Copied!';
    button.classList.add('copied');
    announceToScreenReader('Blog markdown copied to clipboard');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, 2000);
  });
});

window.addEventListener('popstate', openInitialPost);

loadBlogList();
