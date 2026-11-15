const mobileInspectorBreakpoint=matchMedia('(max-width: 900px)');
const clipInspector=$('.inspector');
const desktopInspectorSlot=document.createComment('clip inspector');
clipInspector.before(desktopInspectorSlot);
const inspectorToggle=$('#mobileInspectorToggle');
inspectorToggle.innerHTML=editorIcon('sliders-horizontal',15)+'<span>Klip</span>';

const mobileInspector=document.createElement('dialog');
mobileInspector.id='mobileInspector';
mobileInspector.setAttribute('aria-labelledby','mobileInspectorTitle');
mobileInspector.innerHTML=`<div class="mobileInspectorHeader">
 <h2 id="mobileInspectorTitle">Pengaturan klip</h2>
 <button id="closeMobileInspector" type="button" autofocus>Tutup</button>
</div>`;
document.body.append(mobileInspector);
const closeButton=$('#closeMobileInspector');

function restoreDesktopInspector(){
 // Ignore a close event still queued from a previous opening.
 if(mobileInspector.open)return;
 if(desktopInspectorSlot.nextSibling!==clipInspector)desktopInspectorSlot.after(clipInspector);
 inspectorToggle.setAttribute('aria-expanded','false');
}
function closeMobileClipInspector(){
 if(mobileInspector.open)mobileInspector.close();
 restoreDesktopInspector();
}
inspectorToggle.onclick=()=>{
 if(!mobileInspectorBreakpoint.matches||mobileInspector.open)return;
 // Keep the panel inside the preview when it is fullscreen.
 (document.fullscreenElement||document.body).append(mobileInspector);
 mobileInspector.append(clipInspector);
 mobileInspector.showModal();
 inspectorToggle.setAttribute('aria-expanded','true');
};
closeButton.onclick=closeMobileClipInspector;
mobileInspector.addEventListener('close',restoreDesktopInspector);
mobileInspector.addEventListener('click',event=>{
 if(event.target!==mobileInspector)return;
 const rect=mobileInspector.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeMobileClipInspector();
});
mobileInspectorBreakpoint.addEventListener('change',event=>{
 if(!event.matches)closeMobileClipInspector();
});
document.addEventListener('fullscreenchange',()=>{
 if(!document.fullscreenElement&&mobileInspector.parentNode!==document.body){
  closeMobileClipInspector();
  document.body.append(mobileInspector);
 }
});
