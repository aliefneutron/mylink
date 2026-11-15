/* Canvas port of OpenReel transition geometry and easing. See vendor/openreel/LICENSE. */
const visualEase={
 linear:t=>t,
 ease:t=>t*t*(3-2*t),
 'ease-in':t=>t*t,
 'ease-out':t=>t*(2-t),
 'ease-in-out':t=>t<.5?2*t*t:-1+(4-2*t)*t
};

const transitionScratch=document.createElement('canvas');
const clipTransitionFrames=[document.createElement('canvas'),document.createElement('canvas')];

function transitionDirection(id,fallback='left'){
 const direction=id.match(/(?:^|-)(left|right|up|down)$/)?.[1]||fallback;
 return {x:direction==='left'?-1:direction==='right'?1:0,y:direction==='up'?-1:direction==='down'?1:0};
}

function drawStudioTransition(g,a,b,w,h,id,progress){
 const p=Math.max(0,Math.min(1,progress));
 const tau=Math.PI*2, peak=Math.sin(Math.PI*p);
 const unit=Math.max(.25,Math.min(w,h)/720);
 const draw=(source,{alpha=1,x=0,y=0,sx=1,sy=sx,rotation=0,filter='none',cx=.5,cy=.5}={})=>{
  g.save();
  g.globalAlpha=alpha;
  g.filter=filter;
  g.translate(w*cx+x,h*cy+y);
  g.rotate(rotation);
  g.scale(sx,sy);
  g.drawImage(source,-w*cx,-h*cy,w,h);
  g.restore();
 };
 const reveal=path=>{
  draw(a);
  g.save();
  g.beginPath();
  path();
  g.clip();
  draw(b);
  g.restore();
 };
 const flash=(color,alpha)=>{
  g.save();
  g.fillStyle=color;
  g.globalAlpha=Math.max(0,Math.min(1,alpha));
  g.fillRect(0,0,w,h);
  g.restore();
 };
 const blend=(amount,filter='none')=>{
  draw(a,{filter});
  draw(b,{alpha:amount,filter});
 };
 const rectangle=(x,y,width,height)=>g.rect(x,y,width,height);
 if(p===0){draw(a);return}
 if(p===1||id==='none'){draw(b);return}
 if(id==='black'||id==='white'){
  draw(p<.5?a:b);
  flash(id==='white'?'#fff':'#000',1-Math.abs(2*p-1));
  return;
 }
 if(id==='dissolve'||id.startsWith('crossfade-')){
  const curve=id==='dissolve'?'ease':id.slice('crossfade-'.length);
  blend((visualEase[curve]||visualEase.linear)(p));
  return;
 }
 if(id.startsWith('wipe')){
  if(id==='wipe-diagonal'){
   const edge=p*(w+h);
   reveal(()=>{g.moveTo(0,0);g.lineTo(edge,0);g.lineTo(0,edge);g.closePath()});
   return;
  }
  const direction=transitionDirection(id);
  const box=amount=>direction.y<0?[0,0,w,h*amount]:direction.y>0?[0,h*(1-amount),w,h*amount]:
   direction.x<0?[0,0,w*amount,h]:[w*(1-amount),0,w*amount,h];
  if(id.includes('soft')){
   draw(a);
   for(let band=6;band>=0;band--){
    const amount=Math.min(1,p+band*.009);
    g.save();g.beginPath();rectangle(...box(amount));g.clip();
    draw(b,{alpha:band===0?1:.19});
    g.restore();
   }
  }else reveal(()=>rectangle(...box(p)));
  return;
 }
 if(/^(slide|push|whip)/.test(id)){
  const direction=transitionDirection(id);
  const q=id.startsWith('whip')?visualEase['ease-in-out'](p):p;
  const filter=id.startsWith('whip')?`blur(${peak*18*unit}px)`:'none';
  const x=direction.x*w,y=direction.y*h;
  draw(a,{x:id.startsWith('slide')?0:x*q,y:id.startsWith('slide')?0:y*q,filter});
  draw(b,{x:-x*(1-q),y:-y*(1-q),filter});
  return;
 }
 if(id.startsWith('zoom')){
  const cx=id==='zoom-top-left'?.18:id==='zoom-bottom-right'?.82:.5;
  const strength=id==='zoom-punch'?2:1;
  draw(a,{sx:1+p*strength,cx,cy:cx});
  draw(b,{alpha:p,sx:1+.3*(1-p),cx,cy:cx});
  return;
 }
 if(id==='circleReveal'||id==='radialWipe'||id==='diamondReveal'){
  // Adapted from TransitionEngine.renderRadialWipe. A full frame is available at p=1.
  reveal(()=>{
   const cx=w/2,cy=h/2;
   if(id==='circleReveal')g.arc(cx,cy,Math.hypot(w,h)*p/2,0,tau);
   else if(id==='radialWipe'){
    g.moveTo(cx,cy);g.arc(cx,cy,Math.hypot(w,h),-Math.PI/2,-Math.PI/2+tau*p);g.closePath();
   }else{
    g.moveTo(cx,cy-h*p);g.lineTo(cx+w*p,cy);g.lineTo(cx,cy+h*p);g.lineTo(cx-w*p,cy);g.closePath();
   }
  });
  return;
 }
 if(id==='blinds'||id.startsWith('split')||id==='mosaic'){
  reveal(()=>{
   if(id==='blinds'){for(let column=0;column<8;column++)rectangle(column*w/8,0,w*p/8,h)}
   else if(id==='split-vertical')rectangle(0,h*(1-p)/2,w,h*p);
   else if(id==='split-horizontal')rectangle(w*(1-p)/2,0,w*p,h);
   else for(let i=0;i<64;i++)if((i*37%64)/64<p)rectangle((i%8)*w/8,Math.floor(i/8)*h/8,w/8+.5,h/8+.5);
  });
  return;
 }
 if(id.startsWith('spin')){
  const sign=id==='spin-counter'?-1:1;
  draw(a,{sx:1+p*.4,rotation:sign*p*tau*.3});
  draw(b,{alpha:p,sx:1+(1-p)*.45,rotation:-sign*(1-p)*tau*.7});
  return;
 }
 if(id.startsWith('flip')||id.startsWith('page-turn')){
  draw(b);
  const horizontal=id!=='flip-vertical';
  if(id.startsWith('page-turn')){
   const remaining=1-p;
   const left=id.endsWith('left');
   draw(a,{sx:remaining,cx:left?0:1});
   g.save();
   const edge=left?w*remaining:w*p;
   const shade=g.createLinearGradient(edge-12*unit,0,edge+12*unit,0);
   shade.addColorStop(0,'#0000');shade.addColorStop(.5,'#0009');shade.addColorStop(1,'#0000');
   g.fillStyle=shade;g.fillRect(edge-12*unit,0,24*unit,h);g.restore();
  }else{
   flash('#101315',1);
   const width=Math.max(.004,Math.abs(Math.cos(Math.PI*p)));
   draw(p<.5?a:b,horizontal?{sx:width,sy:1}:{sx:1,sy:width});
  }
  return;
 }
 if(id==='blur'){blend(p,`blur(${peak*20*unit}px)`);return}
 if(id==='flash-cut'||id.includes('burn')||id==='light-leak-cool'){
  draw(p<.5?a:b);
  const color=id==='flash-cut'?'#fff':id==='film-burn-red'?'#fb4131':id==='light-leak-cool'?'#81ddff':'#fda647';
  flash(color,peak*(id==='flash-cut'?1:.75));
  return;
 }
 if(id==='pixelate'){
  const block=1+peak*36*unit;
  transitionScratch.width=Math.max(1,Math.round(w/block));
  transitionScratch.height=Math.max(1,Math.round(h/block));
  const sample=transitionScratch.getContext('2d');
  sample.drawImage(p<.5?a:b,0,0,transitionScratch.width,transitionScratch.height);
  g.save();g.imageSmoothingEnabled=false;draw(transitionScratch);g.restore();
  return;
 }
 if(id==='glitch'||id==='ripple'||id==='colorSplit'){
  blend(p);
  const frame=p<.5?a:b;
  for(let band=0;band<16;band++){
   const y=band*h/16;
   const x=Math.sin(band*(id==='ripple'?1.2:3.4)+p*25)*w*peak*.06;
   g.save();g.beginPath();rectangle(0,y,w,h/16+1);g.clip();
   draw(frame,{x,alpha:.75,filter:id==='colorSplit'?`hue-rotate(${x*4}deg)`:'none'});
   g.restore();
  }
  return;
 }
 blend(p);
}

function paintStudioClipTransition(previous,current,local,progress){
 const w=canvas.width,h=canvas.height;
 const frames=clipTransitionFrames;
 const inputs=[[previous,Math.max(0,previous.duration-.04),true],[current,local,false]];
 for(let i=0;i<frames.length;i++){
  const frame=frames[i];
  if(frame.width!==w)frame.width=w;
  if(frame.height!==h)frame.height=h;
  const g=frame.getContext('2d');
  g.fillStyle='#101315';g.fillRect(0,0,w,h);
  const [clip,position,muted]=inputs[i];
  paintClip(clip,position,{muted,target:g});
 }
 drawStudioTransition(ctx,frames[0],frames[1],w,h,current.transition,progress);
}
const visualEffectRows=[
 ['brightness','Brightness','Dasar','Terangkan midtone dan highlight.','brightness(1.28)'],
 ['contrast','Contrast','Dasar','Pertegas bayangan dan cahaya.','contrast(1.35)'],
 ['saturation','Saturation','Dasar','Perkuat intensitas warna.','saturate(1.65)'],
 ['tonal','Tonal Balance','Dasar','Angkat midtone dan pertajam kontras.','brightness(1.12) contrast(1.2)'],
 ['cinematic','Cinematic Punch','Dasar','Pertegas kontras sinematik.','contrast(1.34) saturate(.85)'],
 ['grayscale','Grayscale','Warna','Ubah warna menjadi monokrom.','grayscale(1)'],
 ['sepia','Sepia','Warna','Beri nuansa foto lama.','sepia(.9)'],
 ['temperature','Golden Hour','Warna','Tambahkan rona hangat.','sepia(.45) saturate(1.2) brightness(1.06)'],
 ['tint','Tint','Warna','Geser rona ke magenta.','hue-rotate(-28deg) saturate(1.25)'],
 ['hue','Hue','Warna','Putar roda warna.','hue-rotate(95deg)'],
 ['cool','Cool Tone','Warna','Tambahkan rona kebiruan.','sepia(.2) hue-rotate(175deg) saturate(1.28)'],
 ['blur','Blur','Buram','Haluskan seluruh bingkai.','', 'blur'],
 ['motion-blur','Motion Blur','Buram','Tambahkan jejak mendatar.','', 'motion-blur'],
 ['radial-blur','Radial Blur','Buram','Tambahkan jejak ke arah tepi.','', 'radial-blur'],
 ['soft-focus','Soft Focus','Buram','Haluskan detail dengan lapisan lembut.','', 'soft-focus'],
 ['invert','Invert','Kreatif','Balik warna pada gambar.','invert(1)'],
 ['vignette','Vignette','Kreatif','Gelapkan sudut gambar.','', 'vignette'],
 ['grain','Film Grain','Kreatif','Tambahkan tekstur film.','contrast(1.13)', 'grain'],
 ['retro','Retro Grain','Kreatif','Gabungkan sepia dan tekstur film.','sepia(.55) saturate(.75)', 'grain'],
 ['glow','Dream Bloom','Gaya','Tambahkan kilau lembut.','saturate(1.16)', 'glow'],
 ['rgb','RGB Split','Gaya','Pisahkan aksen warna di tepi.','', 'rgb'],
 ['vhs','VHS','Gaya','Beri garis dan warna kaset video.','saturate(.78) contrast(1.15)', 'scanlines'],
 ['scanlines','Scanlines','Gaya','Garis mendatar seperti layar tabung.','', 'scanlines'],
 ['close-up','Close-up','Transformasi','Perbesar gambar ke 125%.','', 'close-up'],
 ['rotate','Putar 90°','Transformasi','Putar klip searah jarum jam.','', 'rotate'],
 ['opacity','Transparan','Transformasi','Turunkan opasitas klip ke 70%.','', 'opacity']
];
const visualEffects=Object.fromEntries(visualEffectRows.map(([id,name,group,description,filter,style])=>
 [id,{id,name,group,description,filter,style}]));

function paintStudioEffect(g,source,x,y,w,h,id){
 const effect=Object.hasOwn(visualEffects,id)?visualEffects[id]:null;
 if(!effect){g.drawImage(source,x,y,w,h);return}
 g.save();
 const base=g.filter==='none'?'':g.filter+' ';
 const unit=Math.max(.3,Math.min(w,h)/450);
 if(effect.filter)g.filter=base+effect.filter;
 if(effect.style==='blur')g.filter=base+`blur(${6*unit}px)`;
 g.drawImage(source,x,y,w,h);
 const alpha=g.globalAlpha;
 g.beginPath();g.rect(x,y,w,h);g.clip();
 switch(effect.style){
  case 'vignette':{
   const radius=Math.min(w,h)*.48;
   const shade=g.createRadialGradient(x+w/2,y+h/2,radius*.35,x+w/2,y+h/2,Math.hypot(w,h)*.47);
   shade.addColorStop(0,'#0000');shade.addColorStop(1,'#000d');
   g.filter='none';g.fillStyle=shade;g.fillRect(x,y,w,h);
   break;
  }
  case 'motion-blur':
  case 'radial-blur':
   for(let i=1;i<=3;i++){
    g.globalAlpha=alpha*.14;
    const dx=unit*i*3;
    if(effect.style==='motion-blur')g.drawImage(source,x+dx,y,w,h);
    else g.drawImage(source,x-dx,y-dx,w+dx*2,h+dx*2);
   }
   break;
  case 'soft-focus':
  case 'glow':
   g.globalAlpha=alpha*.38;
   g.filter=base+`blur(${6*unit}px) brightness(${effect.style==='glow'?1.4:1.05})`;
   g.drawImage(source,x,y,w,h);
   break;
  case 'rgb':
   g.globalAlpha=alpha*.26;g.filter=base+'hue-rotate(80deg) saturate(2)';
   g.drawImage(source,x+6*unit,y,w,h);
   g.filter=base+'hue-rotate(-80deg) saturate(2)';
   g.drawImage(source,x-6*unit,y,w,h);
   break;
  case 'scanlines':
   g.filter='none';g.globalAlpha=alpha*.22;g.fillStyle='#061224';
   for(let line=0;line<h;line+=5*unit)g.fillRect(x,y+line,w,unit);
   break;
  case 'grain':
   g.filter='none';g.globalAlpha=alpha*.19;
   for(let i=0;i<420;i++){
    g.fillStyle=i%2?'#fff':'#000';
    g.fillRect(x+(i*1879%997)/997*w,y+(i*719%991)/991*h,unit*2,unit*2);
   }
   break;
 }
 g.restore();
}
