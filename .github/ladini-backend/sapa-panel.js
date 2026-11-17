  // Shares the existing authenticated request helper; connection keys never reach public pages.
  const sapaForm=activate('sapa-form');
  const sapaFields=activate('sapa-fields');
  const sapaStatus=activate('sapa-status');
  let sapaConnected=false,sapaBookings=[],sapaSequence=0,sapaLoading=false,sapaEditing='';
  let sapaRequestId=crypto.randomUUID();
  try {sapaRequestId=sessionStorage.getItem('ladini-sapa-request')||sapaRequestId;sessionStorage.setItem('ladini-sapa-request',sapaRequestId);}catch {}
  const sapaToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  sapaForm.elements.start.min=sapaForm.elements.end.min=sapaToday();
  function sapaNotice(node,message,error=false){node.textContent=message;node.dataset.error=String(error);}
  function sapaResetRequest(){sapaRequestId=crypto.randomUUID();try{sessionStorage.setItem('ladini-sapa-request',sapaRequestId);}catch {}}
  const sapaTable=activate('sapa-bookings').closest('table');
  const sapaTableWrap=sapaTable.parentElement;
  function sizeSapaList(){
    const headHeight=sapaTable.tHead.getBoundingClientRect().height;
    if(!headHeight)return;
    const rowHeight=[...activate('sapa-bookings').rows].slice(0,10).reduce((height,row)=>height+row.getBoundingClientRect().height,0);
    sapaTableWrap.style.setProperty('--sapa-list-height',Math.ceil(headHeight+rowHeight)+'px');
  }
  const sapaTableObserver=new ResizeObserver(sizeSapaList);
  sapaTableObserver.observe(sapaTable);
  function renderSapaBookings(){
    const term=activate('sapa-search').value.toLocaleLowerCase('id'),dept=activate('sapa-department-filter').value;
    const cutoff=new Date(Date.parse(sapaToday())-29*86400000).toISOString().slice(0,10),today=sapaToday();
    const upcoming=activate('sapa-period').value==='upcoming';
    const items=sapaBookings.filter(item=>(upcoming?item.end>=today:item.created>=cutoff&&item.created<=today)&&(!dept||item.department===dept)&&(item.person+' '+item.activity).toLocaleLowerCase('id').includes(term)).sort((a,b)=>a.start.localeCompare(b.start));
    activate('sapa-list-count').textContent=sapaConnected?items.length+' pemesanan · Ruang Lingkar Barat · Seharian'+(items.length>10?' · Gulir tabel untuk melihat data lainnya.':''):'';
    const rows=items.map(item=>{
      const tr=element('tr');
      for(const value of [item.start===item.end?item.start:item.start+' – '+item.end,item.startTime||'–',item.endTime||'–',item.person,item.department,item.activity])tr.append(element('td',value));
      return tr;
    });
    if(!rows.length){const tr=element('tr'),td=element('td',sapaConnected?'Belum ada pemesanan yang sesuai filter.':'Daftar tersedia setelah spreadsheet tersambung.');td.colSpan=6;tr.append(td);rows.push(tr);}
    activate('sapa-bookings').replaceChildren(...rows);
    sapaTableWrap.scrollTop=0;
    requestAnimationFrame(sizeSapaList);
  }
  async function loadSapa(){
    if(sapaLoading)return;
    sapaLoading=true;
    try {
      const result=await request('sapa');
      sapaConnected=result.connected;sapaBookings=result.bookings||[];
      sapaFields.disabled=!sapaConnected;
      sapaNotice(sapaStatus,sapaConnected?'Terhubung. Pesanan disimpan langsung ke spreadsheet kegiatan.':'Pemesanan belum dibuka. Admin perlu menyambungkan spreadsheet melalui Admin → SAPA.');
      const select=activate('sapa-department-filter'),selected=select.value;
      select.replaceChildren(element('option','Semua bidang'));select.options[0].value='';
      for(const name of result.departments||[]){const option=element('option',name);option.value=name;select.append(option);}select.value=selected;
      renderSapaBookings();
    }catch(error){sapaConnected=false;sapaFields.disabled=true;sapaNotice(sapaStatus,error.message,true);}
    finally{sapaLoading=false;}
  }
  async function checkSapaAvailability(){
    const start=sapaForm.elements.start.value,end=sapaForm.elements.end.value;
    const sequence=++sapaSequence;
    activate('sapa-submit').disabled=true;
    const node=activate('sapa-availability');
    if(!sapaConnected||!start||!end||end<start){sapaNotice(node,'Pilih tanggal mulai dan selesai yang valid.');return;}
    sapaNotice(node,'Memeriksa ketersediaan…');
    try {
      const result=await request('sapa/availability?start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end));
      if(sequence!==sapaSequence)return;
      activate('sapa-submit').disabled=!result.available;
      sapaNotice(node,result.available?'Tanggal tersedia untuk pemesanan seharian.':'Tanggal bentrok. Ruang Lingkar Barat sudah dipesan atau ada data lama yang perlu diperiksa admin.',!result.available);
    }catch(error){if(sequence===sapaSequence)sapaNotice(node,error.message,true);}
  }
  sapaForm.elements.start.addEventListener('change',()=>{
    if(!sapaForm.elements.end.value||sapaForm.elements.end.value<sapaForm.elements.start.value)sapaForm.elements.end.value=sapaForm.elements.start.value;
    sapaForm.elements.end.min=sapaForm.elements.start.value||sapaToday();void checkSapaAvailability();
  });
  sapaForm.elements.end.addEventListener('change',()=>{void checkSapaAvailability();});
  activate('sapa-new').addEventListener('click',()=>{
    if(!confirm('Kosongkan isian untuk pesanan baru? Jika pengiriman sebelumnya terputus, periksa daftar pesanan dahulu.'))return;
    sapaForm.reset();sapaResetRequest();++sapaSequence;
    activate('sapa-submit').disabled=true;
    sapaNotice(activate('sapa-availability'),'Pilih tanggal untuk mengecek ketersediaan.');
  });
  sapaForm.addEventListener('submit',event=>{
    event.preventDefault();if(!sapaConnected||sapaFields.disabled)return;
    const values={...Object.fromEntries(new FormData(sapaForm)),room:'lingkar-barat',requestId:sapaRequestId};
    sapaFields.disabled=true;
    sapaNotice(sapaStatus,'Memeriksa bentrok dan menyimpan pesanan…');
    void (async()=>{
      try {
        const result=await request('sapa/bookings',{method:'POST',body:values});
        sapaForm.reset();sapaResetRequest();++sapaSequence;
        await loadSapa();
        sapaNotice(sapaStatus,'Pesanan berhasil tersimpan di spreadsheet. Nomor: '+result.booking.id+'. Ruangan dipesan seharian.');
        sapaNotice(activate('sapa-availability'),'Pilih tanggal untuk pemesanan berikutnya.');
        activate('sapa-submit').disabled=true;
      }catch(error){sapaNotice(sapaStatus,error.message,true);sapaFields.disabled=!sapaConnected;}
    })();
  });
  for(const id of ['sapa-period','sapa-department-filter','sapa-search'])activate(id).addEventListener(id==='sapa-search'?'input':'change',renderSapaBookings);
  activate('sapa-refresh').addEventListener('click',()=>{void loadSapa().then(checkSapaAvailability);});
  function onSapaRoute(){if(location.hash.split('?')[0]==='#layanan/penjadwalan-kegiatan')void loadSapa();}
  window.addEventListener('hashchange',onSapaRoute);onSapaRoute();
  const sapaConnection=activate('admin-sapa-connection');
  async function loadSapaAdmin(){
    activate('admin-sapa-owner').hidden=currentAccount?.role!=='owner';
    try {
      const data=await request('admin/sapa',{auth:true});
      activate('admin-sapa-items').replaceChildren(...(data.bookings||[]).map(item=>{
        const detail=item.start+' – '+item.end+' · '+item.person+' · '+item.status;
        if(!item.id)return row(item.activity,detail+' · Data lama: kelola melalui spreadsheet.');
        if(item.status==='dibatalkan')return row(item.activity,detail);
        return row(item.activity,detail,action('Edit',async()=>{
          sapaEditing=item.id;
          const form=activate('admin-sapa-edit');
          for(const field of ['person','department','start','end','startTime','endTime','activity','purpose','invitees','output','attachment','notes'])form.elements[field].value=item[field]||'';
          form.hidden=false;form.elements.person.focus();
        }),action('Batalkan',async()=>{
          if(!confirm('Batalkan kegiatan “'+item.activity+'”? Tanggalnya akan tersedia kembali.'))return;
          await request('admin/sapa/bookings/'+item.id,{method:'DELETE',auth:true});
          await Promise.all([loadSapaAdmin(),loadSapa()]);notice('Pesanan dibatalkan.');
        }));
      }));
      notice('SAPA terhubung ke spreadsheet.');
    }catch(error){activate('admin-sapa-items').replaceChildren(row('SAPA belum siap',error.message));}
  }
  document.querySelector('[data-admin-tab="sapa"]').addEventListener('click',()=>{void loadSapaAdmin();});
  sapaConnection.addEventListener('submit',event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(sapaConnection));
    void run(event.submitter,async()=>{await request('admin/sapa/connection',{method:'POST',auth:true,body:values});sapaConnection.reset();await Promise.all([loadSapaAdmin(),loadSapa()]);notice('Spreadsheet berhasil tersambung. Pemesanan SAPA dibuka.');});
  });
  const sapaEdit=activate('admin-sapa-edit');
  const editFields=sapaFields.cloneNode(true);
  editFields.removeAttribute('id');editFields.disabled=false;
  editFields.querySelector('#sapa-availability').remove();
  editFields.querySelector('.sapa-trap').remove();
  editFields.querySelector('#sapa-new').remove();
  editFields.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  editFields.querySelector('[type="submit"]').textContent='Simpan kegiatan';
  activate('admin-sapa-edit-fields').append(editFields);
  sapaEdit.addEventListener('submit',event=>{
    event.preventDefault();
    const value={...Object.fromEntries(new FormData(sapaEdit)),room:'lingkar-barat',requestId:crypto.randomUUID()};
    void run(event.submitter,async()=>{await request('admin/sapa/bookings/'+sapaEditing,{method:'PATCH',auth:true,body:value});sapaEdit.hidden=true;sapaEditing='';await Promise.all([loadSapaAdmin(),loadSapa()]);notice('Kegiatan diperbarui.');});
  });
  activate('admin-sapa-cancel-edit').addEventListener('click',()=>{sapaEdit.hidden=true;sapaEditing='';});
