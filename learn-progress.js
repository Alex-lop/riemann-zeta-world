// The progress rail of learn.html: every step, grouped by stage, with the earlier steps checked off
// and the current one highlighted. It is built from the page's own sections and steps, and follows
// the reader as they scroll. On narrow screens it becomes a thin bar under the site navigation.
(function () {
  const steps = [...document.querySelectorAll('article.step')];
  if (!steps.length) return;

  const rail = document.createElement('aside');
  rail.className = 'progress';
  rail.setAttribute('aria-label', 'Your progress');
  rail.innerHTML =
    '<div class="p-head"><span class="p-count"></span><span class="p-stage"></span></div>' +
    '<div class="p-bar" aria-hidden="true"><i></i></div><ol class="p-list"></ol>';
  const list = rail.querySelector('.p-list');
  const items = [];
  for (const section of document.querySelectorAll('main > section')) {
    const h2 = section.querySelector('h2');
    const stageLabel = h2.querySelector('.stage')?.textContent.trim() || '';
    const stageName = h2.textContent.replace(stageLabel, '').trim();
    const li = document.createElement('li');
    li.className = 'p-stage-item';
    li.innerHTML = `<a href="#${section.id}"><span>${stageLabel}</span> ${stageName}</a><ol></ol>`;
    list.appendChild(li);
    for (const step of section.querySelectorAll('article.step')) {
      const n = step.querySelector('.n')?.textContent.trim() || '';
      const title = step.querySelector('h3').textContent.replace(n, '').trim();
      const s = document.createElement('li');
      s.innerHTML = `<a href="#${step.id}"><b>${n}</b><span>${title}</span></a>`;
      li.querySelector('ol').appendChild(s);
      items.push({ step, li: s, stage: `${stageLabel}: ${stageName}` });
    }
  }
  document.body.appendChild(rail);

  const thin = document.createElement('div'); // the narrow-screen bar
  thin.className = 'p-thin';
  thin.innerHTML = '<i></i>';
  document.body.appendChild(thin);

  const count = rail.querySelector('.p-count'), stageText = rail.querySelector('.p-stage');
  const fill = rail.querySelector('.p-bar i'), thinFill = thin.querySelector('i');
  let shown = -2;

  function update() {
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zw-nav-h')) || 0;
    const line = navH + innerHeight * 0.3; // a step is "current" once its top passes this line
    let cur = -1;
    for (let i = 0; i < items.length; i++) if (items[i].step.getBoundingClientRect().top <= line) cur = i;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = items.length - 1; // the end
    if (cur === shown) return;
    shown = cur;
    items.forEach((it, i) => {
      it.li.classList.toggle('done', i < cur);
      it.li.classList.toggle('current', i === cur);
      if (i === cur) it.li.querySelector('a').setAttribute('aria-current', 'step');
      else it.li.querySelector('a').removeAttribute('aria-current');
    });
    const frac = (cur + 1) / items.length;
    fill.style.width = thinFill.style.width = `${frac * 100}%`;
    if (cur < 0) { count.textContent = `${items.length} steps`; stageText.textContent = 'Scroll down to start'; }
    else { count.textContent = `Step ${cur + 1} of ${items.length}`; stageText.textContent = items[cur].stage; }
    // keep the current step visible inside the rail
    const li = items[Math.max(cur, 0)].li;
    const r = li.getBoundingClientRect(), box = rail.getBoundingClientRect();
    if (r.top < box.top + 60 || r.bottom > box.bottom - 20) rail.scrollTop += r.top - box.top - box.height * 0.4;
  }

  // update at once, then at most every 80 ms while scrolling, with one trailing update at the end
  let last = 0, timer = 0;
  const onScroll = () => {
    const now = performance.now();
    clearTimeout(timer);
    if (now - last > 80) { last = now; update(); }
    timer = setTimeout(update, 90);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();
