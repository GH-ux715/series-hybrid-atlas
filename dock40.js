const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Scroll progress is based on a stationary placeholder, never on the fixed canvas itself.
export function dockLayout({top,left,width,height,screenWidth,screenHeight,large=false,position=null,reduced=false}){
 const progress=clamp((16-top)/220,0,1),t=reduced?(progress>0?1:0):progress*progress*(3-2*progress);
 const w=Math.min(screenWidth-32,Math.max(480,Math.min(large?720:640,screenWidth*(large?.55:.42))));
 const h=Math.min(screenHeight-32,w*.70),x=clamp(position?.x??screenWidth-w-16,16,screenWidth-w-16),y=clamp(position?.y??16,16,screenHeight-h-16);
 return {progress,t,left:left+(x-left)*t,top:top+(y-top)*t,width:width+(w-width)*t,height:height+(h-height)*t};
}
export function createDock(){
 const stage=document.querySelector('.stage'),anchor=document.createElement('div');anchor.className='stage-anchor';stage.before(anchor);anchor.append(stage);
 const bar=document.createElement('div');bar.className='dock-bar';bar.hidden=true;
 bar.innerHTML='<button class="dock-grip" aria-label="拖动模型预览窗；方向键移动" title="拖动可移动；方向键微调">⠿ <span>V4.0 · 模型实时预览</span></button><button id="dock-size" aria-pressed="false" title="放大固定预览窗">放大</button><button id="dock-return">返回大图</button><button id="dock-close" aria-label="关闭滚动固定模型" title="关闭固定">×</button>';
 stage.prepend(bar);
 const settings=document.createElement('div');settings.className='preview-settings';settings.innerHTML='<label><input id="pin-model" type="checkbox" checked>滚动固定模型</label><span id="pin-note">电脑端：向下滚动时缩为实时预览窗，可拖动避开操作区。</span>';
 anchor.after(settings);
 const pin=document.querySelector('#pin-model'),size=document.querySelector('#dock-size'),grip=bar.querySelector('.dock-grip');
 const desktop=matchMedia('(min-width: 1024px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let normalHeight=stage.getBoundingClientRect().height,large=false,position=null,frame=0,drag=null,lastLayout=null;
 function restore(){stage.classList.remove('docked','dock-settled');bar.hidden=true;stage.style.cssText='';anchor.style.height='';position=null;lastLayout=null;}
 function update(){frame=0;const model=!document.querySelector('#model-pane').hidden;
  pin.disabled=!desktop.matches;document.querySelector('#pin-note').textContent=desktop.matches?'向下滚动时缩为实时预览窗，可拖动避开操作区。':'手机端保留完整展示，不启用固定小窗。';
  if(!pin.checked||!desktop.matches||!model){restore();return;}
  if(!stage.classList.contains('docked'))normalHeight=stage.getBoundingClientRect().height;
  const r=anchor.getBoundingClientRect(),layout=dockLayout({top:r.top,left:r.left,width:r.width,height:normalHeight,screenWidth:innerWidth,screenHeight:innerHeight,large,position,reduced:reduced.matches});
  if(!layout.progress){restore();return;}
  anchor.style.height=normalHeight+'px';stage.classList.add('docked');stage.classList.toggle('dock-settled',layout.progress>=1);bar.hidden=layout.progress<.7;
  stage.style.cssText=`position:fixed;left:${layout.left}px;top:${layout.top}px;width:${layout.width}px;height:${layout.height}px;z-index:40;`;
  lastLayout=layout;
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);desktop.addEventListener('change',schedule);reduced.addEventListener('change',schedule);
 new ResizeObserver(()=>{if(!stage.classList.contains('docked'))schedule();}).observe(stage);
 new MutationObserver(schedule).observe(document.querySelector('#model-pane'),{attributes:true,attributeFilter:['hidden']});
 pin.onchange=schedule;
 size.onclick=()=>{large=!large;size.textContent=large?'标准大小':'放大';size.setAttribute('aria-pressed',String(large));position=null;schedule();};
 document.querySelector('#dock-return').onclick=()=>scrollTo({top:Math.max(0,scrollY+anchor.getBoundingClientRect().top-24),behavior:reduced.matches?'instant':'smooth'});
 document.querySelector('#dock-close').onclick=()=>{pin.checked=false;schedule();};
 grip.onpointerdown=e=>{if(!lastLayout||lastLayout.progress<1||e.button!==0)return;drag={x:e.clientX,y:e.clientY,left:lastLayout.left,top:lastLayout.top};grip.setPointerCapture(e.pointerId);grip.classList.add('dragging');e.preventDefault();};
 grip.onpointermove=e=>{if(!drag)return;position={x:drag.left+e.clientX-drag.x,y:drag.top+e.clientY-drag.y};schedule();};
 const release=()=>{drag=null;grip.classList.remove('dragging');};grip.onpointerup=release;grip.onpointercancel=release;
 grip.onkeydown=e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!d||!lastLayout||lastLayout.progress<1)return;e.preventDefault();position={x:lastLayout.left+d[0],y:lastLayout.top+d[1]};schedule();};
 update();return {update:schedule};
}
