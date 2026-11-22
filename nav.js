// The site-wide navigation bar: Zeta World (home) · Learn · Explore · The proof.
// Each page loads this with <script src="./nav.js" defer></script>. It inserts the bar as the first
// element of <body> and publishes its height as the CSS variable --zw-nav-h, so pages can offset
// their own fixed panels. It does nothing inside the front page's background view (?bg=1, or framed).
(function () {
  if (new URLSearchParams(location.search).has('bg') || window.top !== window.self) return;

  const PAGES = [
    { key: 'learn', href: './learn.html', label: 'Learn', title: 'From the primes to the proof, step by step' },
    { key: 'explore', href: './landscape.html', label: 'Explore', title: 'The zeta landscape, ξ(s), L(s,χ) and the primes' },
    { key: 'proof', href: './proof.html', label: 'The proof', title: "The announced proof's strategy, in pictures" },
  ];
  const file = location.pathname.split('/').pop() || 'index.html';
  const current = { 'learn.html': 'learn', 'landscape.html': 'explore', 'proof.html': 'proof', 'step4.html': 'proof' }[file] || 'home';
  // Full-screen 3D pages get a fixed bar over the scene; scrolling pages get a sticky one.
  const fixed = current === 'home' || current === 'explore';

  const css = `
    :root { --zw-nav-h: 44px; }
    html { scroll-padding-top: calc(var(--zw-nav-h) + 8px); }
    .zw-nav { position: ${fixed ? 'fixed' : 'sticky'}; top: 0; left: 0; right: 0; z-index: 1000; height: var(--zw-nav-h);
      box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 14px;
      background: rgba(5, 6, 15, 0.84); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1); font: 500 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .zw-nav a { color: #b9b6cc; text-decoration: none; padding: 7px 10px; border-radius: 7px; white-space: nowrap; }
    .zw-nav a:hover, .zw-nav a:focus-visible { color: #ebe9f5; background: rgba(255, 255, 255, 0.07); }
    .zw-nav a[aria-current="page"] { color: #f5c542; background: rgba(245, 197, 66, 0.1); }
    .zw-nav .zw-home { display: flex; align-items: center; gap: 7px; margin-right: auto; color: #ebe9f5; font-weight: 600; }
    .zw-nav .zw-home b { color: #f5c542; font: italic 600 19px/1 Georgia, 'Times New Roman', serif; }
    @media (max-width: 420px) {
      .zw-nav { padding: 0 6px; gap: 0; font-size: 13px; }
      .zw-nav a { padding: 7px 7px; }
      .zw-nav .zw-home span { display: none; }
    }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'zw-nav';
  nav.setAttribute('aria-label', 'Site');
  const home = document.createElement('a');
  home.className = 'zw-home';
  home.href = './index.html';
  home.title = 'Home';
  home.innerHTML = '<b>ζ</b><span>Zeta World</span>';
  if (current === 'home') home.setAttribute('aria-current', 'page');
  nav.appendChild(home);
  for (const p of PAGES) {
    const a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    a.title = p.title;
    if (p.key === current) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }
  document.body.prepend(nav);
})();
