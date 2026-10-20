(() => {
  'use strict';

  const state = { data: null, year: 'all', publicationSearch: '', patentFilter: 'all', patentSearch: '' };
  const $ = id => document.getElementById(id);
  const string = value => value == null ? '' : String(value);
  const list = value => Array.isArray(value) ? value : value ? [value] : [];
  const normalize = value => string(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const textOf = value => Array.isArray(value) ? value.map(textOf).join(' ') : typeof value === 'object' && value ? Object.values(value).map(textOf).join(' ') : string(value);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = string(text);
    return node;
  }

  function safeUrl(value) {
    if (!value || typeof value !== 'string') return '';
    try {
      const parsed = new URL(value, window.location.href);
      return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) ? value : '';
    } catch { return ''; }
  }

  function link(label, url, className, arrow = false) {
    const href = safeUrl(url);
    if (!href) return element('span', className, label);
    const node = element('a', className, label);
    node.href = href;
    if (/^https?:\/\//i.test(href)) {
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }
    if (arrow) {
      const icon = element('span', 'external-arrow', '↗');
      icon.setAttribute('aria-hidden', 'true');
      node.append(' ', icon);
    }
    return node;
  }

  function paragraphs(target, values) {
    target.replaceChildren(...list(values).filter(Boolean).map(value => element('p', '', value)));
  }

  function authorsNode(authors, className = 'authors') {
    const node = element('p', className);
    const source = Array.isArray(authors) ? authors.join(', ') : string(authors);
    const parts = source.split(/(Yan\s+Chang\*?)/gi);
    parts.forEach(part => node.append(/^Yan\s+Chang\*?$/i.test(part) ? element('strong', '', part) : document.createTextNode(part)));
    return node;
  }

  function renderProfile() {
    const profile = state.data.profile || {};
    const name = profile.name || 'Yan Chang';
    $('profile-name').textContent = name;
    $('footer-name').textContent = name;
    const role = $('profile-role');
    role.replaceChildren();
    if (profile.title) role.append(profile.title);
    if (profile.affiliation) {
      if (profile.title) role.append(' at ');
      role.append(element('strong', '', profile.affiliation));
    }
    paragraphs($('profile-bio'), profile.bio);
    const photo = $('profile-photo');
    photo.alt = name;
    if (profile.portrait) photo.src = profile.portrait;
    photo.addEventListener('error', () => {
      photo.closest('figure').hidden = true;
      photo.closest('.profile').classList.add('no-portrait');
    });
    $('portrait-caption').textContent = profile.portraitCaption || '';
    const links = list(profile.links);
    $('profile-links').replaceChildren(...links.map(item => link(item.label, item.url, '', true)));
    $('about-links').replaceChildren(...links.map(item => link(item.label, item.url, '', true)));
    if (profile.eyebrow) document.querySelector('.profile .eyebrow').textContent = profile.eyebrow;
  }

  function renderYearFilters() {
    const years = [...new Set(state.data.publications.map(item => Number(item.year)).filter(Boolean))].sort((a, b) => b - a);
    $('publication-years').replaceChildren(...['all', ...years].map(year => {
      const button = element('button', 'filter-chip' + (String(year) === state.year ? ' is-active' : ''), year === 'all' ? 'All' : year);
      button.type = 'button';
      button.dataset.year = year;
      button.setAttribute('aria-pressed', String(String(year) === state.year));
      button.addEventListener('click', () => {
        state.year = String(year);
        document.querySelectorAll('[data-year]').forEach(chip => {
          const active = chip.dataset.year === state.year;
          chip.classList.toggle('is-active', active);
          chip.setAttribute('aria-pressed', String(active));
        });
        renderPublications();
      });
      return button;
    }));
  }

  function publicationNode(item, index) {
    const article = element('article', 'publication' + (!item.image && !item.video ? ' no-visual' : ''));
    if (item.id) article.id = item.id;
    if (item.image || item.video) {
      const destination = item.project || item.paper || item.url;
      const visual = destination ? link('', destination, 'publication-visual') : element('div', 'publication-visual');
      if (item.imageFit === 'contain') visual.classList.add('contain');
      if (destination) visual.setAttribute('aria-label', `${item.title} — ${item.project ? 'project website' : 'paper'}`);
      const media = document.createElement(item.video ? 'video' : 'img');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      media.src = !item.video && item.poster && reduceMotion ? item.poster : item.video || item.image;
      if (item.video) {
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (item.image) media.poster = item.image;
        media.setAttribute('aria-label', item.alt || item.title);
        media.preload = 'metadata';
      } else {
        media.alt = item.alt || `${item.title} project overview`;
        media.loading = index > 2 ? 'lazy' : 'eager';
        media.decoding = 'async';
        media.width = 440;
        media.height = 264;
      }
      media.addEventListener('error', () => {
        visual.remove();
        article.classList.add('no-visual');
      }, { once: true });
      visual.append(media);
      article.append(visual);
    }

    const content = element('div', 'publication-content');
    const heading = element('h3');
    heading.append(link(item.title, item.project || item.paper || item.url));
    content.append(heading);
    if (item.authors) content.append(authorsNode(item.authors));
    if (item.authorsFull && normalize(textOf(item.authorsFull)) !== normalize(textOf(item.authors))) {
      const disclosure = element('details', 'full-authors');
      disclosure.append(element('summary', '', 'All authors'), authorsNode(item.authorsFull));
      content.append(disclosure);
    }
    const venue = item.venue && new RegExp(`\\b${item.year}\\b`).test(item.venue)
      ? item.venue
      : [item.venue, item.year].filter(Boolean).join(' · ');
    if (venue) content.append(element('p', 'publication-venue', venue));
    if (item.summary) content.append(element('p', 'publication-summary', item.summary));
    const resourceLinks = element('div', 'publication-links');
    [['Paper', item.paper], ['Project', item.project], ['Code', item.code], ...list(item.links).map(entry => [entry.label, entry.url])].forEach(([label, url]) => {
      if (safeUrl(url)) resourceLinks.append(link(label, url));
    });
    if (resourceLinks.childNodes.length) content.append(resourceLinks);
    article.append(content);
    return article;
  }

  function byYear(items, nodeFactory) {
    const fragment = document.createDocumentFragment();
    const years = [...new Set(items.map(item => item.year || 'Earlier'))].sort((a, b) => Number(b) - Number(a));
    let itemIndex = 0;
    years.forEach(year => {
      const group = element('section', 'year-group');
      const heading = element('h3', 'year-label', year);
      group.setAttribute('aria-label', `${year}`);
      group.append(heading);
      items.filter(item => (item.year || 'Earlier') === year).forEach(item => group.append(nodeFactory(item, itemIndex++)));
      fragment.append(group);
    });
    return fragment;
  }

  function renderPublications() {
    const query = normalize(state.publicationSearch.trim());
    const items = state.data.publications.filter(item =>
      (state.year === 'all' || String(item.year) === state.year) &&
      (!query || normalize(textOf([item.title, item.authors, item.authorsFull, item.venue, item.summary, item.year])).includes(query))
    );
    $('publication-list').replaceChildren(byYear(items, publicationNode));
    $('publication-empty').hidden = items.length > 0;
    const total = state.data.publications.length;
    $('publication-count').textContent = state.year === 'all' && !query
      ? `${total} publication${total === 1 ? '' : 's'}`
      : `${items.length} of ${total} publication${total === 1 ? '' : 's'}`;
  }

  function patentKind(item) {
    const status = normalize([item.kind, item.type, item.status].filter(Boolean).join(' '));
    if (/application|pending|published/.test(status) && !/grant/.test(status)) return 'application';
    if (/grant|issued/.test(status)) return 'grant';
    const number = string(item.number).replace(/\s/g, '');
    if (/A\d?$/.test(number)) return 'application';
    if (/B\d?$/.test(number)) return 'grant';
    return '';
  }

  function patentNode(item) {
    const article = element('article', 'patent');
    const heading = element('h3');
    heading.append(link(item.title, item.url));
    article.append(heading);
    const meta = element('div', 'patent-meta');
    if (item.number) meta.append(element('span', 'patent-number', item.number));
    const status = item.status || (patentKind(item) === 'grant' ? 'Granted' : patentKind(item) === 'application' ? 'Application' : '');
    if (status) meta.append(element('span', 'patent-status', status));
    if (item.publicationDate || item.date) meta.append(element('span', 'patent-date', item.publicationDate ? `Published ${item.publicationDate}` : item.date));
    if (meta.childNodes.length) article.append(meta);
    if (item.inventors) article.append(authorsNode(item.inventors, 'patent-inventors'));
    if (item.detail) article.append(element('p', 'patent-detail', item.detail));
    if (item.assignee) article.append(element('p', 'patent-assignee', `Assignee: ${textOf(item.assignee)}`));
    return article;
  }

  function renderPatents() {
    const query = normalize(state.patentSearch.trim());
    const items = state.data.patents.filter(item =>
      (state.patentFilter === 'all' || patentKind(item) === state.patentFilter) &&
      (!query || normalize(textOf([item.title, item.number, item.inventors, item.assignee, item.year, item.status])).includes(query))
    );
    $('patent-list').replaceChildren(byYear(items, patentNode));
    $('patent-empty').hidden = items.length > 0;
    const total = state.data.patents.length;
    $('patent-count').textContent = state.patentFilter === 'all' && !query
      ? `${total} patent record${total === 1 ? '' : 's'}`
      : `${items.length} of ${total} patent record${total === 1 ? '' : 's'}`;
  }

  function renderAbout() {
    const about = state.data.about || {};
    const profile = state.data.profile || {};
    paragraphs($('about-bio'), about.bio || about.text || profile.bio);
    $('research-areas').replaceChildren(...list(profile.researchAreas || about.researchAreas).map(area => element('span', 'research-area', area)));
    const background = $('about-background');
    [['Experience', about.experience], ['Education', about.education]].forEach(([label, entries]) => {
      if (!list(entries).length) return;
      const section = element('section', 'background-section');
      section.append(element('h2', '', label));
      list(entries).forEach(item => {
        const row = element('div', 'background-item');
        row.append(element('div', 'period', item.period || item.date || ''));
        const content = element('div');
        content.append(element('h3', '', item.title || item.degree || item.role));
        if (item.organization || item.institution) content.append(element('p', '', item.organization || item.institution));
        if (item.description) content.append(element('p', '', item.description));
        row.append(content);
        section.append(row);
      });
      background.append(section);
    });

    const writing = list(state.data.writing);
    $('writing-section').hidden = writing.length === 0;
    $('writing-list').replaceChildren(...writing.map(item => {
      const article = element('article', 'writing-item');
      const heading = element('h3');
      heading.append(link(item.title, item.url, '', true));
      article.append(heading);
      const metadata = [item.source, item.date].filter(Boolean).join(' · ');
      if (metadata) article.append(element('p', 'writing-meta', metadata));
      if (item.description) article.append(element('p', 'writing-description', item.description));
      return article;
    }));
    $('patents-intro').textContent = state.data.patentsIntro || about.patentsIntro || '';
    const news = list(state.data.news).slice(0, 3);
    $('news-section').hidden = news.length === 0;
    $('news-list').replaceChildren(...news.map(item => {
      const row = element('div', 'news-item');
      row.append(element('span', 'news-date', item.date || ''));
      const content = element('p');
      content.append(link(item.title || item.text, item.url));
      row.append(content);
      return row;
    }));
  }

  function route(focus = false) {
    const requested = window.location.hash.slice(1);
    const current = ['research', 'patents', 'about'].includes(requested) ? requested : 'research';
    document.querySelectorAll('.page-panel').forEach(panel => { panel.hidden = panel.id !== current; });
    document.querySelectorAll('[data-route]').forEach(item => {
      if (item.dataset.route === current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const name = state.data?.profile?.name || 'Yan Chang';
    document.title = `${name} — ${current === 'research' ? 'Research' : current === 'patents' ? 'Patents' : 'About'}`;
    if (focus) {
      $('main').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function bindControls() {
    $('publication-search').addEventListener('input', event => { state.publicationSearch = event.target.value; renderPublications(); });
    $('patent-search').addEventListener('input', event => { state.patentSearch = event.target.value; renderPatents(); });
    $('patent-filters').addEventListener('click', event => {
      const chip = event.target.closest('[data-patent-filter]');
      if (!chip) return;
      state.patentFilter = chip.dataset.patentFilter;
      document.querySelectorAll('[data-patent-filter]').forEach(button => {
        const active = button === chip;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      renderPatents();
    });
    $('publication-reset').addEventListener('click', () => {
      state.year = 'all';
      state.publicationSearch = '';
      $('publication-search').value = '';
      renderYearFilters();
      renderPublications();
      $('publication-search').focus();
    });
    $('patent-reset').addEventListener('click', () => {
      state.patentFilter = 'all';
      state.patentSearch = '';
      $('patent-search').value = '';
      document.querySelectorAll('[data-patent-filter]').forEach(button => {
        const active = button.dataset.patentFilter === 'all';
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      renderPatents();
      $('patent-search').focus();
    });
    window.addEventListener('hashchange', () => route(true));
  }

  async function start() {
    try {
      if (window.YAN_CHANG_DATA) {
        state.data = window.YAN_CHANG_DATA;
      } else {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Unable to load research data');
        state.data = await response.json();
      }
      state.data.publications = list(state.data.publications).filter(item => Number(item.year) >= 2021 && Number(item.year) <= 2026).sort((a, b) => Number(b.year) - Number(a.year));
      state.data.patents = list(state.data.patents).sort((a, b) => Number(b.year) - Number(a.year));
      renderProfile();
      renderYearFilters();
      renderPublications();
      renderPatents();
      renderAbout();
      bindControls();
      $('loading').hidden = true;
      route();
    } catch (error) {
      $('loading').hidden = true;
      $('load-error').hidden = false;
      console.error('Site data could not be loaded.', error);
    }
  }

  start();
})();
