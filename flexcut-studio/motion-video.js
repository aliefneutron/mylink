// The bundled illustrations were rendered from the supplied RID and Stikman Python skills.
const motionSkillStyles={
 rid:{name:'RID Animations',color:'#ffe281',background:'#d8e9fa',caption:'clean',transition:'dissolve',
  poster:'rid-poster',locations:['biru','kamar','bukit'],direction:'Use the recurring male and female presenters to explain one concept through a hook, example, and takeaway. Set biru for the pastel studio, kamar for an indoor example, or bukit for outdoors.'},
 stik:{name:'Stikman Cerita',color:'#f9b9ce',background:'#cce9e8',caption:'outline',transition:'dissolve',
  poster:'stik-poster',locations:['kelas','kamar','taman'],direction:'Write a connected mini-story starring Raka and Nadia. Use an immediate hook, a visible goal or problem, and a payoff. Keep the characters consistent. Set kelas (classroom), kamar (bedroom), or taman (park) as locations.'}
};
const motionActions=['talk','show','walk','react'];
const motionCameras=['push','pull','pan'];
const motionPanels=['idea','chart','check','star','book'];
const motionCast=['duo','first','second'];
const motionImages=new Map();

const localMotionIdeas={
 id:{
  education:[
   ['Cara mulai fokus belajar',['Pilih satu tugas kecil untuk dikerjakan lebih dulu.','Simpan ponsel dan tutup tab yang mengganggu.','Selesaikan satu bagian, lalu ambil jeda.']],
   ['Mengapa bayangan berubah panjang?',['Coba sorot sebuah benda dengan senter dari samping.','Arahkan senter lebih tinggi dan amati bayangannya.','Bandingkan keduanya: posisi sumber cahaya mengubah panjang bayangan.']]
  ],
  story:[
   ['Buku catatan yang tertukar',['Raka membuka tas dan menemukan catatan milik Nadia.','Di halaman terakhir ada sketsa taman dengan sebuah tanda X.','Raka menemui Nadia di taman. Ternyata tanda itu adalah denah tempat mereka belajar bersama.']],
   ['Satu payung untuk berdua',['Nadia melihat Raka menunggu hujan reda di depan kelas.','Nadia membawa payung kecil, jadi mereka berjalan pelan agar tetap terlindung.','Ketika sampai di gerbang, mereka sepakat besok membawa payung masing-masing.']]
  ],
  product:[
   ['Demo buku catatan',['Tunjukkan sampul dan buka satu halaman.','Tulis daftar singkat agar penonton melihat cara pakainya.','Ajak penonton memilih halaman yang cocok untuk kebutuhannya.']],
   ['Demo botol minum',['Isi botol saat bersiap berangkat.','Tunjukkan cara membuka dan menutupnya.','Perlihatkan cara menyimpannya di tas dan ajak penonton melihat detailnya.']]
  ]
 },
 en:{
  education:[
   ['How to start a focused study session',['Choose one small task to start with.','Put away your phone and close distracting tabs.','Finish one section, then take a short break.']],
   ['Why do shadows change length?',['Shine a flashlight on an object from the side.','Raise the flashlight and watch the shadow.','Compare the two shadows to see how the angle of the light changes their length.']]
  ],
  story:[
   ['The mixed-up notebooks',['Raka opens his bag and finds Nadia’s notebook.','On the last page, a sketch of the park is marked with an X.','Raka meets Nadia in the park and learns that the X marks their new study spot.']],
   ['An umbrella for two',['Nadia spots Raka waiting for the rain to stop.','They walk slowly under one small umbrella.','At the gate, they agree to bring an umbrella each tomorrow.']]
  ],
  product:[
   ['A notebook demo',['Show the cover and open a blank page.','Write a short checklist to demonstrate how to use it.','Invite viewers to choose a page layout that fits their needs.']],
   ['A water bottle demo',['Fill the bottle while getting ready to leave.','Demonstrate how to open and close it.','Show how it fits in a bag and invite viewers to explore the details.']]
  ]
 }
};

function buildLocalMotionIdea({topic,brief,language,kind}){
 const ideas=localMotionIdeas[language][kind];
 if(!topic&&brief){
  const first=brief.split(/\n|(?<=[.!?])\s/u,1)[0].trim();
  return {topic:first.split(/\s+/).slice(0,9).join(' ').slice(0,100),brief};
 }
 if(!topic){
  const [title,points]=ideas[Math.floor(Math.random()*ideas.length)];
  return {topic:title,brief:brief||points.join('\n')};
 }
 const matching=ideas.find(([title])=>title===topic);
 const en=language==='en';
 const outlines=en?{
  education:['Let’s explore '+topic+'.','Start with a familiar example. What would you notice first?','Try it yourself and compare what you observe.'],
  story:['Today Raka and Nadia have a new challenge: '+topic+'.','Nadia suggests breaking the challenge into smaller steps. Raka offers to try the first one.','Together they find a way forward and decide what to try next time.'],
  product:['Here’s a closer look at '+topic+'.','Watch how it fits into a real task.','Explore the details and decide whether it suits your needs.']
 }:{
  education:['Mari kenali '+topic+'.','Mulai dari contoh yang dekat dengan keseharian. Apa yang pertama kali terlihat?','Coba sendiri dan bandingkan apa yang kamu amati.'],
  story:['Hari ini Raka dan Nadia punya tantangan baru: '+topic+'.','Nadia mengusulkan untuk membaginya menjadi beberapa langkah. Raka mencoba langkah pertama.','Mereka menemukan jalan keluar bersama dan sepakat apa yang akan dicoba berikutnya.'],
  product:['Mari lihat lebih dekat '+topic+'.','Perhatikan cara menggunakannya untuk satu kegiatan sehari-hari.','Lihat detailnya dan pilih sesuai kebutuhanmu.']
 };
 return {topic,brief:brief||(matching?.[1]||outlines[kind]).join('\n')};
}

function motionAssetURL(name){return 'assets/motion/'+name+'.webp'}
function loadMotionImage(name){
 if(!motionImages.has(name)){
  const image=new Image();
  image.src=motionAssetURL(name);
  const ready=image.decode();
  ready.then(()=>{if(!playing)draw()},()=>{});
  motionImages.set(name,{image,ready});
 }
 return motionImages.get(name);
}
function prepareMotionStyle(id){
 const style=motionSkillStyles[id];
 if(!style)return Promise.resolve();
 const names=[id+'-cast',...style.locations.map(location=>id+'-'+location)];
 if(id==='rid')names.push('rid-icons');
 return Promise.all(names.map(name=>loadMotionImage(name).ready));
}

function motionSceneDetails(id,scene,index){
 const {locations}=motionSkillStyles[id];
 const valid=(value,choices,fallback)=>choices.includes(value)?value:fallback;
 const cast=valid(scene?.cast,motionCast,'duo');
 return {
  location:valid(scene?.location,locations,locations[index%locations.length]),
  action:valid(scene?.action,motionActions,motionActions[index%motionActions.length]),
  camera:valid(scene?.camera,motionCameras,motionCameras[index%motionCameras.length]),
  panel:valid(scene?.panel,motionPanels,motionPanels[index%motionPanels.length]),
  cast,
  speaker:cast==='duo'?valid(scene?.speaker,motionCast.slice(1),index%2?'second':'first'):cast
 };
}

function paintSkillMotion(target,clip,local,poster){
 const {style:id,motion,index}=clip.autoScene;
 const scene=motionSceneDetails(id,motion,index);
 const bg=loadMotionImage(id+'-'+scene.location),cast=loadMotionImage(id+'-cast');
 const icons=id==='rid'?loadMotionImage('rid-icons'):null;
 const w=target.canvas.width,h=target.canvas.height,short=Math.min(w,h);
 const p=Math.max(0,Math.min(1,local/clip.duration));
 const ease=t=>t*t*(3-2*t);
 const zoom=scene.camera==='push'?1+.13*ease(p):scene.camera==='pull'?1.13-.13*ease(p):1.075;
 const pan=scene.camera==='pan'?(p-.5)*w*.06*(index%2?-1:1):0;
 const background=bg.image.naturalWidth?bg.image:poster;
 const factor=Math.max(w/background.width,h/background.height)*zoom;
 target.save();
 target.globalAlpha*=clip.opacity/100;
 target.fillStyle=motionSkillStyles[id].background;
 target.fillRect(0,0,w,h);
 target.filter=[filterMap[clip.filter]||'', 'brightness('+clip.brightness+'%) contrast('+clip.contrast+'%) saturate('+clip.saturation+'%)']
  .filter(value=>value&&value!=='none').join(' ');
 paintStudioEffect(target,background,
  (w-background.width*factor)/2+pan,(h-background.height*factor)/2,
  background.width*factor,background.height*factor,clip.studioEffect);
 if(cast.image.naturalWidth){
  const portrait=h>w;
  const spriteHeight=Math.min(h*(portrait ? .38 : .52),short*(portrait ? .78 : .58))*Math.min(zoom,1.08);
  const base=h*(id==='rid' ? .78 : .80);
  const entrance=1-ease(Math.min(1,local/.62));
  const roles=scene.cast==='duo'?[0,1]:[scene.cast==='second'?1:0];
  if(icons?.image.naturalWidth){
   const radius=short*.095;
   const pop=1-ease(Math.min(1,local/.58));
   const cx=w/2+pan,cy=h*.35+radius*.38*pop;
   target.save();
   target.globalAlpha*=1-pop;
   target.fillStyle='#fff5c9';target.strokeStyle='#26324b';target.lineWidth=Math.max(2,short*.004);
   target.beginPath();target.roundRect(cx-radius,cy-radius,radius*2,radius*2,radius*.35);
   target.fill();target.stroke();
   const tile=motionPanels.indexOf(scene.panel)*144;
   target.drawImage(icons.image,tile,0,144,144,cx-radius*.7,cy-radius*.7,radius*1.4,radius*1.4);
   target.restore();
  }
  for(const role of roles){
   const direction=role===0?1:-1;
   const speaking=scene.speaker===(role===0?'first':'second');
   const stride=scene.action==='walk'&&id==='stik';
   const beat=Math.floor(local*5.5)%2;
   const frame=stride?3+beat:scene.action==='show'&&speaking?2:
    (scene.action==='react'&&id==='rid'&&speaking?3:scene.action==='talk'&&speaking&&beat?1:0);
   const shift=stride?(p-.5)*short*.18:0;
   const spacing=roles.length>1?Math.min(w*.20,spriteHeight*.39):0;
   const x=w/2-direction*(spacing+entrance*short*.10)+shift+pan*.58;
   const bounce=(stride?Math.abs(Math.sin(local*8.5))*.020:Math.sin(local*3.4+role)*.007)*short;
   const reaction=scene.action==='react'&&speaking?Math.sin(Math.min(1,local/.6)*Math.PI)*short*.049:0;
   const y=base+entrance*short*.11-bounce-reaction;
   target.save();
   target.globalAlpha*=1-.8*entrance;
   target.translate(x,y);
   target.rotate((clip.rotation||0)*Math.PI/180);
   const scale=clip.scale/100;
   target.scale(direction*scale,scale);
   target.drawImage(cast.image,frame*240,role*300,240,300,-spriteHeight*.4,-spriteHeight,spriteHeight*.8,spriteHeight);
   target.restore();
  }
 }
 target.filter='none';
 const shade=target.createLinearGradient(0,0,0,h);
 shade.addColorStop(0,'#162139e8');shade.addColorStop(.20,'#162139ad');shade.addColorStop(.34,'#16213900');
 shade.addColorStop(.72,'#16213900');shade.addColorStop(1,'#162139e8');
 target.fillStyle=shade;target.fillRect(0,0,w,h);
 target.restore();
}
