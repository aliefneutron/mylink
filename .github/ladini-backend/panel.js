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
    pengumuman: 'Pengumuman', tautan: 'Tautan lainnya', teks: 'Teks halaman'
  };
  let session = '';
  let editing = '';
  let currentAccount;
  let currentItems = [];
  let activeTab = 'content';
  let siteSettings = {value:{},version:0};
  let editingTab = '';
  const appearance = activate('admin-appearance');
  const tabForm = activate('admin-tab-form');
  const originalLogo = [...document.querySelectorAll('.brand-mark img,.logo-glass img')].map(node=>({node,src:node.src}));
  const originalBrandTitle = document.querySelector('.brand strong').textContent;
  const originalBrandSubtitle = document.querySelector('.brand small').textContent;
  const defaultSettings = {title:originalBrandTitle,subtitle:originalBrandSubtitle,theme:'dark',accent:'#79edc5',background:'#0d1228',logoId:'',backgroundId:'',tabs:[]};
  const deviceTheme = matchMedia('(prefers-color-scheme: light)');
  const customPages = [];
  const customNav = element('nav','','custom-tabs shell');
  customNav.setAttribute('aria-label','Tab tambahan');
  document.querySelector('.header').append(customNav);
  const headerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height',document.querySelector('.header').getBoundingClientRect().height+'px');
  });
  headerObserver.observe(document.querySelector('.header'));
  let previewImageURL;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const builtInItems = JSON.parse(activate('ladini-content-index')?.textContent || '[]');
  const baseline = [...document.querySelectorAll('[data-link-key]')].map((node) => ({
    node, id:node.dataset.linkKey, html:node.innerHTML, href:node.getAttribute('href'), video:node.dataset.video,
    title:node.dataset.title, label:node.getAttribute('aria-label')
  }));
  const baseText = [...document.querySelectorAll('[data-text-key]')].map(node=>({
    node,id:node.dataset.textKey,html:node.innerHTML
  }));
  function applyOverrides(overrides = []) {
    const changes = new Map(overrides.map((item)=>[item.id,item]));
    for (const original of baseText) {
      const change = changes.get(original.id);
      original.node.hidden = Boolean(change?.hidden);
      original.node.innerHTML = original.html;
      if(change?.body && !change.hidden) original.node.textContent = change.body;
    }
    for(const original of baseline) {
      const {node} = original;
      const change = changes.get(original.id);
      const card = node.closest('.source-card');
      const holder = node.closest('.document-card') ||
        (node.parentElement?.matches('.nav-group') ? node.parentElement : null) ||
        node.closest('li') || node.closest('article.video') ||
        (card?.querySelectorAll('a').length === 1 ? card : node);
      holder.hidden = Boolean(change?.hidden);
      node.innerHTML = original.html;
      if(original.href) node.setAttribute('href', original.href);
      if(original.video) {
        node.dataset.video = original.video;
        node.dataset.title = original.title;
        node.setAttribute('aria-label',original.label);
      }
      if(!change || change.hidden || !change.title || !change.url) continue;
      if(original.video) {
        const url = new URL(change.url);
        const id = url.hostname === 'youtu.be' ? url.pathname.split('/')[1] :
          url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.split('/')[2];
        node.dataset.video = /^[\w-]{11}$/.test(id||'') ? id : '';
        node.dataset.title = change.title;
        node.setAttribute('aria-label','Putar '+change.title);
        const label = node.querySelector('.video-label');
        if(label) label.textContent = change.title;
        const photo = node.querySelector('img');
        if(photo && node.dataset.video) photo.src='https://i.ytimg.com/vi/'+node.dataset.video+'/hqdefault.jpg';
        node.dataset.videoUrl = change.url;
      } else {
        if (!/^#[A-Za-z0-9][A-Za-z0-9/?=%_.&-]*$/.test(change.url) && !change.url.startsWith('https://')) continue;
        node.setAttribute('href',change.url);
        const title = node.querySelector('strong');
        if(title) title.textContent = change.title;
        else node.textContent = change.title;
      }
    }
  }

  function showTab(tab) {
    if (['accounts','appearance'].includes(tab) && currentAccount?.role !== 'owner') tab = 'content';
    activeTab = tab;
    document.querySelectorAll('[data-admin-section]').forEach((section) => {
      section.hidden = section.dataset.adminSection !== tab;
    });
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      if (button.dataset.adminTab === tab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => { notice(''); showTab(button.dataset.adminTab); });
  });

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
    itemForm.elements.kind.disabled = false;
    itemForm.elements.description.disabled = false;
    itemForm.elements.body.value = '';
    activate('admin-body-label').hidden = true;
    activate('admin-url-label').hidden = false;
    itemForm.elements.url.required = true;
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
    activate('admin-change-code').reset();
    currentAccount = null;
    showTab('content');
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
    const { account, items, accounts, images, overrides = [], settings } = await request('admin', { auth: true });
    currentAccount = account;
    const changes = new Map(overrides.map((item)=>[item.id,item]));
    currentItems = [
      ...builtInItems.map((item)=>{const change=changes.get(item.id);return {...item,...(change?.title&&{title:change.title,url:change.url,body:change.body||item.body}),hidden:Boolean(change?.hidden),id:'base-'+item.id};}),
      ...items
    ];
    login.hidden = true;
    dashboard.hidden = false;
    dialog.classList.remove('admin-login-mode');
    dialog.setAttribute('aria-labelledby', 'admin-title');
    activate('admin-account').textContent = account.name + ' · ' + (account.role === 'owner' ? 'Pemilik' : 'Editor');
    activate('admin-accounts-tab').hidden = account.role !== 'owner';
    activate('admin-appearance-tab').hidden = account.role !== 'owner';
    siteSettings = {value:{...defaultSettings,...(settings?.value||{})},version:settings?.version||0};
    fillAppearance(images);
    activate('admin-count-links').textContent = currentItems.filter(item=>!item.hidden).length;
    activate('admin-count-images').textContent = images.length;
    showTab(activeTab);
    renderItems();
    renderImages(images);
    void request('stats?tz=' + encodeURIComponent(timezone)).then((stats) => {
      activate('admin-count-visitors').textContent = new Intl.NumberFormat('id-ID').format(stats.visitors_today);
    }).catch(() => {});

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

  function renderItems() {
    const term = activate('admin-filter').value.trim().toLocaleLowerCase('id');
    const kind = activate('admin-kind-filter').value;
    const items = currentItems.filter((item) => (!kind || (kind === 'deleted' ? item.hidden : item.kind === kind)) &&
      (item.title + ' ' + labels[item.kind] + ' ' + item.url + ' ' + item.description + ' ' + (item.body||'')).toLocaleLowerCase('id').includes(term));
    activate('admin-items').replaceChildren(...(items.length ? items.map((item) => {
      if(item.hidden) return row(item.title,labels[item.kind]+' · Dihapus',action('Pulihkan',async()=>{
        await request('admin/overrides/'+item.id.slice(5),{method:'POST',auth:true});
        await Promise.all([refreshDashboard(),refreshContent()]);
        notice('Tautan dipulihkan.');
      }));
      return row(item.title, labels[item.kind] + ' · ' + (item.description || item.url),
      action('Edit', async () => {
        editing = item.id;
        for (const field of ['kind', 'title', 'url', 'description', 'body']) itemForm.elements[field].value = item[field] || '';
        const isText = item.kind === 'teks';
        activate('admin-body-label').hidden = !isText;
        activate('admin-url-label').hidden = isText;
        itemForm.elements.url.required = !isText;
        activate('admin-save').textContent = 'Simpan perubahan';
        activate('admin-cancel').hidden = false;
        itemForm.elements.kind.disabled = item.id.startsWith('base-');
        itemForm.elements.description.disabled = item.id.startsWith('base-');
        itemForm.elements.title.focus();
      }),
      action('Hapus', async () => {
        if (!window.confirm('Hapus tautan “' + item.title + '”?')) return;
        const path = item.id.startsWith('base-') ? 'admin/overrides/'+item.id.slice(5) : 'admin/content/'+item.id;
        await request(path, { method: 'DELETE', auth: true });
        if (editing === item.id) clearEdit();
        await Promise.all([refreshDashboard(), refreshContent()]);
        notice('Tautan dihapus.');
      })
    );}) : [row(term ? 'Konten tidak ditemukan.' : 'Belum ada konten.', '')]));
  }
  activate('admin-filter').addEventListener('input', renderItems);
  activate('admin-kind-filter').addEventListener('change', renderItems);

  function renderImages(images) {
    activate('admin-images').replaceChildren(...images.map((image) => {
      const li = element('li');
      const photo = element('img');
      photo.src = root + '/api/images/' + image.id;
      photo.alt = image.caption;
      photo.loading = 'lazy';
      li.append(photo, element('strong', image.caption), action('Hapus gambar', async () => {
        if (!window.confirm('Hapus gambar “' + image.caption + '”?')) return;
        await request('admin/images/' + image.id, { method: 'DELETE', auth: true });
        await Promise.all([refreshDashboard(), refreshGallery()]);
        notice('Gambar dihapus.');
      }));
      return li;
    }));
  }
  const upload = activate('admin-upload');
  const imageFile = activate('admin-image-file');
  function clearPreview() {
    if (previewImageURL) URL.revokeObjectURL(previewImageURL);
    previewImageURL = null;
    activate('admin-image-preview').removeAttribute('src');
    activate('admin-image-preview').hidden = true;
  }
  imageFile.addEventListener('change', () => {
    clearPreview();
    const file = imageFile.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 1048576) {
      imageFile.value = '';
      notice('Pilih JPG, PNG, atau WebP maksimal 1 MB.', true);
      return;
    }
    previewImageURL = URL.createObjectURL(file);
    activate('admin-image-preview').src = previewImageURL;
    activate('admin-image-preview').hidden = false;
    notice('');
  });
  upload.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = imageFile.files[0];
    if (!file) return;
    void run(event.submitter, async () => {
      const data = await new Promise((done, fail) => {
        const reader = new FileReader();
        reader.onload = () => done(reader.result);
        reader.onerror = () => fail(new Error('Gambar gagal dibaca.'));
        reader.readAsDataURL(file);
      });
      await request('admin/images', { method: 'POST', auth: true, body: { data, caption: upload.elements.caption.value } });
      upload.reset();
      clearPreview();
      await Promise.all([refreshDashboard(), refreshGallery()]);
      notice('Gambar sudah tampil di galeri LADINI.');
    });
  });
  activate('admin-change-code').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (body.newCode !== body.confirmCode) { notice('Konfirmasi kode belum sama.', true); return; }
    void run(event.submitter, async () => {
      await request('admin/code', { method: 'POST', auth: true, body });
      form.reset();
      notice('Kode akses berhasil diganti. Gunakan kode baru saat masuk berikutnya.');
    });
  });

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
    activate('admin-change-code').reset();
    accountForm.reset();
    clearPreview();
    upload.reset();
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
    body.kind = itemForm.elements.kind.value;
    void run(event.submitter, async () => {
      const target = editing.startsWith('base-') ? 'admin/overrides/'+editing.slice(5) : editing ? 'admin/content/'+editing : 'admin/content';
      await request(target, {
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
    const url = new URL(item.url, location.href);
    const internal = item.url.startsWith('#');
    if (!internal && url.protocol !== 'https:') return anchor;
    anchor.href = internal ? item.url : url.href;
    if (!internal) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
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

  function applyAppearance() {
    const config = {...defaultSettings,...siteSettings.value};
    const light = config.theme==='auto' ? deviceTheme.matches : config.theme==='light';
    document.documentElement.dataset.theme=light?'light':'dark';
    document.documentElement.style.setProperty('--green',light&&config.accent===defaultSettings.accent?'#086246':config.accent);
    document.documentElement.style.setProperty('--site-background',light&&config.background===defaultSettings.background?'#f2f7f4':config.background);
    document.body.style.backgroundImage=config.backgroundId ? 'linear-gradient('+(light?'#f6fff3dc,#f6fff3dc':'#0d1228d9,#0d1228d9')+'),url("'+root+'/api/images/'+config.backgroundId+'")' : '';
    document.querySelector('.brand strong').textContent=config.title;
    document.querySelector('.brand small').textContent=config.subtitle;
    document.querySelector('.footer strong').textContent=config.title;
    for(const logo of originalLogo) {
      logo.node.src=config.logoId?root+'/api/images/'+config.logoId:logo.src;
      if(logo.node.closest('.brand-mark')) {
        logo.node.style.width=config.logoId?'100%':'';
        logo.node.style.marginLeft=config.logoId?'0':'';
        logo.node.style.objectFit=config.logoId?'contain':'';
      }
    }
    let favicon=document.querySelector('link[rel="icon"]');
    if(!favicon){favicon=element('link');favicon.rel='icon';document.head.append(favicon);}
    favicon.href=config.logoId?root+'/api/images/'+config.logoId:originalLogo[0].src;
    for(const page of customPages.splice(0)) {
      directoryPages.delete(page.dataset.directoryPage);
      const index=visiblePages.indexOf(page);
      if(index>=0)visiblePages.splice(index,1);
      page.remove();
    }
    customNav.replaceChildren();
    for(const tab of config.tabs){
      const anchor=element('a',tab.label);
      anchor.href=tab.url;
      if(!tab.url.startsWith('#')){anchor.target='_blank';anchor.rel='noopener noreferrer';}
      customNav.append(anchor);
      if(tab.type!=='page')continue;
      const route='halaman/'+tab.id;
      const page=element('div');
      page.dataset.directoryPage=route;
      page.dataset.pageTitle=tab.label;
      page.hidden=true;
      const hero=element('section','','profile-hero glass');
      const heading=element('h1',tab.label);
      heading.tabIndex=-1;
      hero.append(heading);
      const content=element('div',tab.body||'','glass content-card block custom-page-text');
      page.append(hero,content);
      document.querySelector('main').append(page);
      directoryPages.set(route,page);
      visiblePages.push(page);
      customPages.push(page);
    }
    customNav.hidden=!config.tabs.length;
    renderPage();
    applyApplicationTitle();
  }
  function applyApplicationTitle() {
    const config={...defaultSettings,...siteSettings.value};
    const route=location.hash.slice(1).split('?',1)[0];
    const pageTitle=route==='profil'?'Profil':directoryPages.get(route)?.dataset.pageTitle;
    document.title=pageTitle?pageTitle+' | '+config.title:config.title+' | '+config.subtitle;
    customNav.querySelectorAll('a').forEach(anchor=>{
      if(anchor.hash&&anchor.hash===location.hash)anchor.setAttribute('aria-current','page');
      else anchor.removeAttribute('aria-current');
    });
  }
  deviceTheme.addEventListener('change',()=>{if(siteSettings.value.theme==='auto')applyAppearance();});
  window.addEventListener('hashchange',applyApplicationTitle);

  function fillAppearance(images) {
    const config={...defaultSettings,...siteSettings.value};
    for(const field of ['logoId','backgroundId']){
      const select=appearance.elements[field];
      function option(label,value) { const node=element('option',label);node.value=value;return node; }
      select.replaceChildren(option(field==='logoId'?'Logo bawaan LADINI':'Tanpa gambar background',''));
      for(const image of images)select.add(option(image.caption,image.id));
      if(config[field]&&!images.some(image=>image.id===config[field]))select.add(option('Gambar yang sebelumnya dipilih',config[field]));
    }
    for(const field of ['title','subtitle','theme','accent','background','logoId','backgroundId'])appearance.elements[field].value=config[field];
    activate('admin-tab-list').replaceChildren(...config.tabs.map((tab,index)=>{
      const rowNode=row(tab.label,tab.type==='page'?'Halaman baru':tab.url,
        action('Edit',async()=>{
          editingTab=tab.id;
          for(const field of ['label','type','url','body'])tabForm.elements[field].value=tab[field]||'';
          updateTabFields();
          activate('admin-tab-save').textContent='Simpan tab';
          activate('admin-tab-cancel').hidden=false;
          tabForm.elements.label.focus();
        }),
        action('Hapus',async()=>{
          if(!window.confirm('Hapus tab “'+tab.label+'”?'))return;
          await saveAppearance({...config,tabs:config.tabs.filter(item=>item.id!==tab.id)});
          resetTabForm();
          notice('Tab dihapus.');
        })
      );
      if(index>0)rowNode.append(action('Naik',async()=>{
        const tabs=[...config.tabs];
        [tabs[index-1],tabs[index]]=[tabs[index],tabs[index-1]];
        await saveAppearance({...config,tabs});
      }));
      return rowNode;
    }));
  }
  async function saveAppearance(value) {
    siteSettings=await request('admin/settings',{method:'PATCH',auth:true,body:{value,version:siteSettings.version}});
    await Promise.all([refreshContent(),refreshDashboard()]);
  }
  appearance.addEventListener('submit',event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(appearance));
    void run(event.submitter,async()=>{
      await saveAppearance({...defaultSettings,...siteSettings.value,...values});
      notice('Tampilan aplikasi sudah diperbarui.');
    });
  });
  function updateTabFields() {
    const isPage=tabForm.elements.type.value==='page';
    activate('admin-tab-url').hidden=isPage;
    activate('admin-tab-body').hidden=!isPage;
    tabForm.elements.url.required=!isPage;
  }
  function resetTabForm() {
    editingTab='';
    tabForm.reset();
    updateTabFields();
    activate('admin-tab-save').textContent='Tambah tab';
    activate('admin-tab-cancel').hidden=true;
  }
  tabForm.elements.type.addEventListener('change',updateTabFields);
  activate('admin-tab-cancel').addEventListener('click',resetTabForm);
  tabForm.addEventListener('submit',event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(tabForm));
    void run(event.submitter,async()=>{
      const config={...defaultSettings,...siteSettings.value};
      const tab={...values,id:editingTab||crypto.randomUUID()};
      const tabs=config.tabs.filter(item=>item.id!==tab.id);
      const at=config.tabs.findIndex(item=>item.id===tab.id);
      if(at<0)tabs.push(tab);else tabs.splice(at,0,tab);
      await saveAppearance({...config,tabs});
      resetTabForm();
      notice('Tab navigasi tersimpan.');
    });
  });

  async function refreshContent() {
    const { items, overrides, settings } = await request('content');
    siteSettings={value:{...defaultSettings,...(settings?.value||{})},version:settings?.version||0};
    applyOverrides(overrides);
    applyAppearance();
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
    const stats = await request('stats?tz=' + encodeURIComponent(timezone));
    document.querySelectorAll('[data-stat]').forEach((stat) => {
      stat.textContent = numberFormat.format(stats[stat.dataset.stat]);
    });
  }
  const timePanel = element('div', '', 'ladini-local-clock');
  const clock = element('time');
  const clockZone = element('small', 'Waktu lokal · ' + timezone.replaceAll('_', ' '));
  timePanel.append(clock, clockZone);
  document.querySelector('.header').after(timePanel);
  function updateClock() {
    const now = new Date();
    clock.dateTime = now.toISOString();
    clock.textContent = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(now);
  }
  updateClock();
  window.setInterval(updateClock, 1000);
  const statsZone = document.querySelector('#statistik .section-head small');
  statsZone.textContent = 'Waktu lokal · ' + timezone.replaceAll('_', ' ');

  const gallery = document.querySelector('.gallery');
  let gallerySlide = 0;
  function showGallerySlide(step = 0) {
    const slides = [...gallery.querySelectorAll('figure')];
    gallerySlide = slides.length ? (gallerySlide + step + slides.length) % slides.length : 0;
    slides.forEach((slide, index) => { slide.hidden = index !== gallerySlide; });
    activate('gallery-status').textContent = slides.length ? (gallerySlide + 1) + ' / ' + slides.length : '0 / 0';
    activate('prev').disabled = activate('next').disabled = slides.length < 2;
  }
  activate('prev').addEventListener('click', () => showGallerySlide(-1));
  activate('next').addEventListener('click', () => showGallerySlide(1));
  async function refreshGallery() {
    const { images } = await request('images');
    const selectedId = gallery.querySelector('figure:not([hidden])')?.dataset.imageId;
    activate('managed-gallery')?.remove();
    gallery.replaceChildren(...images.map((image) => {
      const figure = element('figure');
      figure.dataset.imageId = image.id;
      const photo = element('img');
      photo.src = root + '/api/images/' + image.id;
      photo.alt = image.caption;
      photo.loading = 'lazy';
      figure.append(photo, element('figcaption', image.caption));
      return figure;
    }));
    gallerySlide = Math.max(0, images.findIndex(image => image.id === selectedId));
    if (!images.length) gallery.append(element('p', 'Belum ada gambar. Unggah melalui Admin → Galeri.', 'gallery-empty'));
    showGallerySlide();
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
  void refreshGallery().catch(() => {
    gallery.replaceChildren(element('p', 'Galeri belum dapat dimuat. Silakan muat ulang halaman.', 'gallery-empty'));
    showGallerySlide();
  });
  void visit();
})();
