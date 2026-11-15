const timelineTrackNames={text:'Teks',video:'Video',audio:'Audio'};
const trackControlIcons={
 eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
 eyeOff:'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9 6.4c1-.3 2-.4 3-.4 6.5 0 10 6 10 6a16 16 0 0 1-2.4 2.9M6 7.8A17 17 0 0 0 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8"/>',
 speaker:'<path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>',
 speakerOff:'<path d="M4 9h4l5-4v14l-5-4H4zm12 1 4 4m0-4-4 4"/>'
};
for(const label of $$('[data-timeline-track]')){
 const name=label.dataset.timelineTrack;
 const controls=document.createElement('div');
 controls.className='trackControlButtons';
 for(const [property,icon] of name==='text'?[['hidden','eye']]:[['muted','speaker'],['hidden','eye']]){
  const button=document.createElement('button');
  button.type='button';
  button.className='trackControl';
  button.dataset.trackControl=property;
  button.innerHTML=`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g>${trackControlIcons[icon]}</g><g>${trackControlIcons[icon+'Off']}</g></svg>`;
  button.onclick=()=>{
   if(exporting||job)return;
   commit();
   const state=trackStates[name]||{};
   trackStates[name]={...state,[property]:!state[property]};
   syncAudio();
   render();
  };
  controls.append(button);
 }
 label.append(controls);
}

function syncTrackControls(){
 for(const label of $$('[data-timeline-track]')){
  const name=label.dataset.timelineTrack,title=timelineTrackNames[name];
  const hidden=!trackVisible(name),muted=Boolean(trackStates[name]?.muted);
  const row=$('#'+name+'Track');
  row.classList.toggle('trackInactive',hidden);
  row.classList.toggle('trackMuted',muted);
  for(const button of label.querySelectorAll('.trackControl')){
   const visibility=button.dataset.trackControl==='hidden';
   const active=visibility?!hidden:!muted;
   button.setAttribute('aria-pressed',String(active));
   button.setAttribute('aria-label',(visibility?'Aktifkan track ':'Suara track ')+title);
   button.title=(visibility?(hidden?'Aktifkan':'Nonaktifkan'):(muted?'Aktifkan suara':'Bisukan'))+' track '+title;
  }
 }
}
const timelineBeforeTrackControls=renderTimeline;
renderTimeline=function(){timelineBeforeTrackControls();syncTrackControls()};
syncTrackControls();
