const editorNavIcons={media:'video',audio:'music',text:'type',filters:'sliders-horizontal',effects:'sparkles',transitions:'arrow-left-right',subtitles:'captions',convert:'repeat-2',record:'mic',mytemplates:'panels-top-left'};
for(const button of $$('#nav [data-tab]'))button.querySelector('b').innerHTML=editorIcon(editorNavIcons[button.dataset.tab]);
$('#guide b').innerHTML=editorIcon('circle-question-mark');
for(const [id,icon,label] of [['help','keyboard','Pintasan'],['appearanceToggle','settings-2','Tema'],['saveProject','save','Simpan proyek']]){
 const button=$('#'+id);
 button.classList.add('editorIconLabel');
 button.innerHTML=editorIcon(icon,13)+'<span>'+label+'</span>';
}

const editorControls={
 undo:'undo-2',redo:'redo-2',split:'scissors',duplicate:'copy',delete:'trash-2',addText:'text-cursor-input',
 zoomOut:'zoom-out',zoomIn:'zoom-in',fit:'maximize',prev:'skip-back',next:'skip-forward',
 exportMenuToggle:'chevron-down',previewResizeHandle:'expand',timelineResize:'grip-horizontal'
};
for(const [id,icon] of Object.entries(editorControls)){
 const button=$('#'+id);
 if(!button)continue;
 button.innerHTML=editorIcon(icon,id==='exportMenuToggle'?13:16);
 button.setAttribute('aria-label',button.title||button.getAttribute('aria-label')||icon);
}
$('#play').innerHTML=editorIcon('play',16,'data-play-icon')+editorIcon('pause',16,'data-pause-icon');
$('#fullscreen').innerHTML=editorIcon('maximize',16,'data-full-icon')+editorIcon('minimize',16,'data-exit-icon');
function replaceEditorArrowLabels(root){
 if(!root)return;
 for(const button of root.querySelectorAll('button')){
  const lead=button.firstChild;
  if(lead?.nodeType!==Node.TEXT_NODE)continue;
  const arrow=lead.data.trimStart()[0];
  const icon=arrow==='↥'?'upload':arrow==='↧'?'download':null;
  if(!icon)continue;
  lead.data=lead.data.trimStart().slice(1).trimStart();
  button.classList.add('editorIconLabel');
  button.insertAdjacentHTML('afterbegin',editorIcon(icon,14));
 }
 for(const arrow of root.querySelectorAll('.propertySection h3 span')){
  if(arrow.textContent==='▾')arrow.innerHTML=editorIcon('chevron-down',13);
 }
}
const libraryBeforeEditorIcons=renderLibrary;
renderLibrary=function(){libraryBeforeEditorIcons();replaceEditorArrowLabels($('#libraryContent'))};
const inspectorBeforeEditorIcons=renderInspector;
renderInspector=function(){inspectorBeforeEditorIcons();replaceEditorArrowLabels($('#inspectorContent'))};
const modalBeforeEditorIcons=modal;
modal=function(html){modalBeforeEditorIcons(html);replaceEditorArrowLabels($('#modalContent'))};
