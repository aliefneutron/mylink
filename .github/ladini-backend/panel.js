(() => {
  const apiBase = document.querySelector('meta[name="ladini-api"]').content;
  const localPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (!apiBase && !localPreview) return;
  const root = apiBase || location.origin;
  const activate = (id) => document.getElementById(id);
  const dialog = activate('admin-dialog');
  const login = activate('admin-login');
  const loginCode = activate('admin-code');
  const reveal = activate('admin-reveal-code');
  const dashboard = activate('admin-dashboard');
  const itemForm = activate('admin-item');
  const accountForm = activate('admin-create-account');
  const message = activate('admin-message');
  const codeBox = activate('admin-created-code');
  const codeInput = activate('admin-generated-code');
  const labels = {
    video: 'Video edukasi', layanan: 'Layanan', informasi: 'Informasi',
    pengumuman: 'Pengumuman', tautan: 'Tautan lainnya'
  };
  let session = '';
  let editing = '';

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function notice(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = {};
    if (auth) headers.Authorization = 'Bearer ' + session;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch(root + '/api/' + path, { method, headers, body: body && JSON.stringify(body) });
    if (response.status === 204) return;
    const result = await response.json();
    if (!response.ok) {
      if (auth && response.status === 401) signedOut();
      throw new Error(result.error || 'Permintaan tidak berhasil.');
    }
    return result;
  }

  function clearEdit() {
    editing = '';
    itemForm.reset();
    activate('admin-save').textContent = 'Tambah tautan';
    activate('admin-cancel').hidden = true;
  }

  function signedOut() {
    session = '';
    login.reset();
    showCode(false);
    login.hidden = false;
    dashboard.hidden = true;
    dialog.classList.add('admin-login-mode');
    dialog.setAttribute('aria-labelledby', 'admin-login-title');
    codeBox.hidden = true;
    codeInput.value = '';
    clearEdit();
  }

  async function run(control, operation) {
    control.disabled = true;
    notice('');
    try {
      await operation();
    } catch (error) {
      notice(error instanceof Error && error.message !== 'Failed to fetch' ? error.message : 'Layanan admin tidak dapat dihubungi.', true);
    } finally {
      control.disabled = false;
    }
  }

  function action(label, operation) {
    const button = element('button', label, 'button profile-button');
    button.type = 'button';
    button.addEventListener('click', () => run(button, operation));
    return button;
  }

  function row(title, detail, ...actions) {
    const li = element('li');
    const content = element('div');
    content.append(element('strong', title), element('small', detail));
    li.append(content, ...actions);
    return li;
  }

  async function refreshDashboard() {
    const { account, items, accounts } = await request('admin', { auth: true });
    login.hidden = true;
    dashboard.hidden = false;
    dialog.classList.remove('admin-login-mode');
    dialog.setAttribute('aria-labelledby', 'admin-title');
    activate('admin-account').textContent = account.name + ' · ' + (account.role === 'owner' ? 'Pemilik' : 'Editor');
    activate('admin-accounts-section').hidden = account.role !== 'owner';
    activate('admin-items').replaceChildren(...(items.length ? items.map((item) => row(item.title, labels[item.kind],
      action('Edit', async () => {
        editing = item.id;
        for (const field of ['kind', 'title', 'url', 'description']) itemForm.elements[field].value = item[field];
        activate('admin-save').textContent = 'Simpan perubahan';
        activate('admin-cancel').hidden = false;
        itemForm.elements.title.focus();
      }),
      action('Hapus', async () => {
        if (!window.confirm('Hapus tautan “' + item.title + '”?')) return;
        await request('admin/content/' + item.id, { method: 'DELETE', auth: true });
        if (editing === item.id) clearEdit();
        await Promise.all([refreshDashboard(), refreshContent()]);
        notice('Tautan dihapus.');
      })
    )) : [row('Belum ada tautan tambahan.', '')]));

    activate('admin-accounts').replaceChildren(...accounts.map((account) => {
      const disabled = account.disabled ? 'Dicabut' : account.role === 'owner' ? 'Pemilik' : 'Editor aktif';
      if (account.role !== 'editor' || account.disabled) return row(account.name, disabled);
      return row(account.name, disabled, action('Cabut akses', async () => {
        if (!window.confirm('Cabut akses untuk “' + account.name + '”?')) return;
        await request('admin/accounts/' + account.id, { method: 'DELETE', auth: true });
        await refreshDashboard();
        notice('Akses dicabut.');
      }));
    }));
  }

  const adminButton = activate('admin-open');
  function showCode(visible) {
    loginCode.type = visible ? 'text' : 'password';
    reveal.setAttribute('aria-pressed', String(visible));
    reveal.setAttribute('aria-label', visible ? 'Sembunyikan kode akses' : 'Tampilkan kode akses');
  }
  reveal.addEventListener('click', () => showCode(loginCode.type === 'password'));
  adminButton.hidden = false;
  adminButton.addEventListener('click', () => {
    notice('');
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    codeBox.hidden = true;
    codeInput.value = '';
    login.reset();
    showCode(false);
  });
  login.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = login.elements.code.value;
    void run(event.submitter, async () => {
      const result = await request('login', { method: 'POST', body: { code } });
      session = result.session;
      login.reset();
      showCode(false);
      await refreshDashboard();
    });
  });
  activate('admin-logout').addEventListener('click', (event) => {
    void run(event.currentTarget, async () => {
      await request('admin/logout', { method: 'POST', auth: true });
      signedOut();
    });
  });
  activate('admin-cancel').addEventListener('click', clearEdit);
  itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(itemForm));
    void run(event.submitter, async () => {
      await request(editing ? 'admin/content/' + editing : 'admin/content', {
        auth: true, method: editing ? 'PATCH' : 'POST', body
      });
      clearEdit();
      await Promise.all([refreshDashboard(), refreshContent()]);
      notice('Tautan tersimpan dan sudah tampil di LADINI.');
    });
  });
  accountForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(accountForm));
    void run(event.submitter, async () => {
      const result = await request('admin/accounts', { method: 'POST', auth: true, body });
      codeInput.value = result.code;
      codeBox.hidden = false;
      accountForm.reset();
      await refreshDashboard();
    });
  });
  activate('admin-copy-code').addEventListener('click', () => {
    codeInput.select();
    navigator.clipboard.writeText(codeInput.value).then(() => notice('Kode disalin.'),
      () => notice('Kode dipilih. Salin secara manual.'));
  });

  function externalLink(item) {
    const anchor = element('a', '', 'managed-link');
    const url = new URL(item.url);
    if (url.protocol !== 'https:') return anchor;
    anchor.href = url.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.dataset.managed = 'true';
    anchor.append(element('strong', item.title));
    if (item.description) anchor.append(element('small', item.description));
    return anchor;
  }

  function addExternal(item, target, wrapped = false) {
    const link = externalLink(item);
    if (!link.hasAttribute('href') || !target) return;
    const block = element(wrapped ? 'li' : 'article', '', wrapped ? '' : 'service glass');
    block.dataset.managed = 'true';
    block.append(link);
    target.append(block);
  }

  function addVideo(item) {
    const article = element('article', '', 'video glass');
    article.dataset.managed = 'true';
    const button = element('button', '', 'video-trigger');
    button.type = 'button';
    button.setAttribute('aria-label', 'Putar ' + item.title);
    button.dataset.title = item.title;
    button.dataset.video = item.youtube_id || '';
    button.dataset.videoUrl = item.url;
    const thumb = element('span', '', 'thumb');
    if (/^[\w-]{11}$/.test(item.youtube_id || '')) {
      const image = element('img');
      image.alt = '';
      image.loading = 'lazy';
      image.src = 'https://i.ytimg.com/vi/' + item.youtube_id + '/hqdefault.jpg';
      thumb.append(image);
    }
    thumb.append(element('span', '▶'));
    button.append(thumb, element('span', item.title, 'video-label'));
    button.addEventListener('click', () => {
      if (button.dataset.video) {
        openVideo(button);
        return;
      }
      const url = new URL(item.url);
      if (url.protocol !== 'https:') return;
      lastVideoButton = button;
      videoHeading.textContent = item.title;
      const player = element('video');
      player.src = url.href;
      player.playsInline = true;
      player.controls = true;
      videoStage.replaceChildren(player);
      videoDialog.showModal();
      void player.play().catch(() => {});
    });
    article.append(button);
    document.querySelector('.video-grid').append(article);
  }

  async function refreshContent() {
    const { items } = await request('content');
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].dataset.managed) entries.splice(i, 1);
    }
    document.querySelectorAll('[data-managed]').forEach((node) => node.remove());
    const extras = activate('managed-extras');
    extras.hidden = true;
    for (const item of items) {
      if (item.kind === 'video') {
        addVideo(item);
      } else if (item.kind === 'layanan' || item.kind === 'informasi') {
        addExternal(item, document.querySelector('[data-directory-page="' + item.kind + '"] .directory-grid'));
        addExternal(item, document.querySelector('.nav-group > a[href="#' + item.kind + '"] + details ul'), true);
        if (item.kind === 'layanan') addExternal(item, document.querySelector('.service-grid'));
        else addExternal(item, document.querySelector('#home-view .topics'), true);
      } else {
        addExternal(item, extras.querySelector('ul'), true);
        extras.hidden = false;
      }
    }
    entries.push(...document.querySelectorAll('.directory-grid .managed-link'));
  }

  const widget = activate('visitor-widget-template').content.cloneNode(true);
  activate('home-view').append(widget);
  const numberFormat = new Intl.NumberFormat('id-ID');
  async function refreshStats() {
    const stats = await request('stats');
    document.querySelectorAll('[data-stat]').forEach((stat) => {
      stat.textContent = numberFormat.format(stats[stat.dataset.stat]);
    });
  }

  let visitor = crypto.randomUUID();
  try {
    const stored = localStorage.getItem('ladini-visitor-v1');
    if (/^[0-9a-f-]{36}$/i.test(stored || '')) visitor = stored;
    else localStorage.setItem('ladini-visitor-v1', visitor);
  } catch {
    // A browser with blocked storage receives a temporary visitor identifier.
  }
  let lastPage;
  let sending = false;
  const pending = [];

  async function visit() {
    if (document.hidden) return;
    const path = location.hash.slice(1).split('?', 1)[0];
    const page = path === 'profil' || directoryPages.has(path) ? path : 'beranda';
    if (page !== lastPage) {
      pending.push(crypto.randomUUID());
      lastPage = page;
      if (pending.length > 25) pending.shift();
    }
    if (sending) return;
    sending = true;
    try {
      if (!pending.length) await request('visit', { method: 'POST', body: { visitor } });
      while (pending.length) {
        await request('visit', { method: 'POST', body: { visitor, view: pending[0] } });
        pending.shift();
      }
      await refreshStats();
    } catch {
      // Keep unreported page views queued until the next heartbeat.
    } finally {
      sending = false;
    }
  }

  window.addEventListener('hashchange', visit);
  document.addEventListener('visibilitychange', visit);
  window.setInterval(visit, 60000);
  void refreshContent().catch(() => {});
  void visit();
})();
