// Preview size is independent from the video's composition scale and export size.
let previewPercent=100;
const previewStage=$('.stage'),previewBox=$('.canvasWrap'),previewViewer=$('.viewer');
function previewDimensions(availableWidth,availableHeight,ratio,percent){const width=Math.max(1,Math.min(availableWidth,availableHeight*ratio))*percent/100;return {width,height:width/ratio}}
previewViewer.querySelector('.viewerTop').insertAdjacentHTML('afterend',`<div class="previewTools"><span>Ukuran pratinjau</span><button id="previewSmaller" aria-label="Perkecil pratinjau">−</button><input id="previewSize" type="range" min="25" max="100" value="100" aria-label="Ukuran pratinjau"><output id="previewSizeValue">100%</output><button id="previewLarger" aria-label="Perbesar pratinjau">+</button><button id="previewFit" title="Penuhi area pratinjau sesuai rasio tanpa memotong gambar">Pas area</button></div>`);
previewBox.insertAdjacentHTML('beforeend','<button id="previewResizeHandle" aria-label="Tarik untuk mengubah ukuran pratinjau" title="Tarik untuk memperbesar atau memperkecil pratinjau"><span>◢</span></button>');
function layoutPreview(){
  const css=getComputedStyle(previewStage),width=Math.max(1,previewStage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)),height=Math.max(1,previewStage.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom));
  const size=previewDimensions(width,height,canvas.width/canvas.height,previewPercent);
  previewBox.style.width=size.width+'px';previewBox.style.height=size.height+'px';
  $('#previewSize').value=previewPercent;$('#previewSizeValue').textContent=Math.round(previewPercent)+'%';$('#previewSmaller').disabled=previewPercent<=25;$('#previewLarger').disabled=previewPercent>=100;
}
function setPreviewPercent(value){previewPercent=Math.max(25,Math.min(100,Number(value)||100));layoutPreview()}
$('#previewSize').oninput=e=>setPreviewPercent(e.target.value);
$('#previewSmaller').onclick=()=>setPreviewPercent(previewPercent-10);
$('#previewLarger').onclick=()=>setPreviewPercent(previewPercent+10);
$('#previewFit').onclick=()=>setPreviewPercent(100);
$('#previewResizeHandle').onpointerdown=e=>{
  e.preventDefault();e.stopPropagation();const startX=e.clientX,startY=e.clientY,startPercent=previewPercent,baseWidth=previewBox.getBoundingClientRect().width/startPercent*100,ratio=canvas.width/canvas.height;
  const move=ev=>{const delta=((ev.clientX-startX)+(ev.clientY-startY)*ratio)/2;setPreviewPercent(startPercent+delta/baseWidth*100)};
  const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);previewBox.classList.remove('resizing')};
  previewBox.classList.add('resizing');window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
};
$('#previewResizeHandle').onkeydown=e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();setPreviewPercent(previewPercent+(['ArrowLeft','ArrowDown'].includes(e.key)?-5:5))}};
new ResizeObserver(layoutPreview).observe(previewStage);
const priorSetRatio=setRatio;setRatio=function(){priorSetRatio();layoutPreview()};
let beforeFullscreenPercent=100;
$('#fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement){await document.exitFullscreen();return}beforeFullscreenPercent=previewPercent;setPreviewPercent(100);if(!previewViewer.requestFullscreen)throw new Error('Fullscreen unsupported');await previewViewer.requestFullscreen()}catch(error){toast('Layar penuh tidak tersedia pada browser ini. Ukuran tetap bisa diatur dengan Pas area.')}
};
document.addEventListener('fullscreenchange',()=>{const full=document.fullscreenElement===previewViewer;$('#fullscreen').textContent=full?'⊡':'⛶';$('#fullscreen').title=full?'Keluar layar penuh (Esc)':'Layar penuh';if(!full)setPreviewPercent(beforeFullscreenPercent);requestAnimationFrame(layoutPreview)});
const previewInspector=renderInspector;
renderInspector=function(){previewInspector();const c=clips.find(c=>c.id===selected);if(!c)return;$('#inspectorContent').insertAdjacentHTML('afterbegin',`<div class="propertySection"><h3>Penempatan media</h3><label class="featureLabel">Tampilan dalam kanvas<select id="mediaFraming"><option value="contain" ${c.fit!=='cover'?'selected':''}>Seluruh gambar</option><option value="cover" ${c.fit==='cover'?'selected':''}>Isi kanvas (potong tepi)</option></select></label><button class="secondary full" id="showWholeMedia">Tampilkan video / foto utuh</button><p class="featureNote">Seluruh gambar menjaga semua sisi media terlihat. Ukuran pratinjau tidak mengubah ukuran video ekspor.</p></div>`);$('#mediaFraming').onchange=e=>{commit();c.fit=e.target.value;render()};$('#showWholeMedia').onclick=()=>{commit();Object.assign(c,{fit:'contain',scale:100,rotation:0});setPreviewPercent(100);render()}};
layoutPreview();renderInspector();draw();
