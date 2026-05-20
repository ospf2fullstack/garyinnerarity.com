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
let currentPostRaw = '';

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

function publishedFromMarkdown(markdown) {
  const match = markdown.match(/^Published:\s*(.+)$/mi);
  return match ? match[1].trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  postList.innerHTML = '';

  const posts = await Promise.all(blogFiles.map(async (filename) => {
    const markdown = await fetchPostContent(filename);
    return {
      filename,
      slug: slugFromFilename(filename),
      title: titleFromMarkdown(markdown, filename),
      published: publishedFromMarkdown(markdown)
    };
  }));

  posts.forEach((post) => {
    const item = document.createElement('li');
    item.classList.add('blog-post-item');
    item.dataset.filename = post.filename;
    item.dataset.slug = post.slug;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');

    const title = document.createElement('span');
    title.classList.add('blog-post-item__title');
    title.textContent = post.title;
    item.appendChild(title);

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
    currentPostRaw = content;
    renderPostContent(content);
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

function renderPostContent(markdown) {
  if (!markedFn) {
    blogView.innerHTML = `
      <div class="skills-toolbar">
        <button class="copy-btn" id="blog-copy-btn">Copy</button>
      </div>
      <div id="note-content"><pre>${escapeHtml(markdown)}</pre></div>`;
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
    <div id="note-content">${html}</div>`;

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
