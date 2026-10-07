import * as THREE from 'three';
import {OrbitControls} from './OrbitControls.js';
import {power,PRESETS} from './power.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const parts=[
['周向进气 / 压气机','CIRCUMFERENTIAL INLET','空气从机体周向进入集气腔，再进入压气机。周向进气指进口布置，并不等于气流始终沿周向运动。本页离心叶轮为教学近似，非实机测绘。','周向入口 → 集气腔 → 压气机','周向进气和离心压气机是同一个概念吗？',0x638fa1],
['燃烧室','COMBUSTOR','燃料在压缩空气中燃烧，提高总温。实际燃烧室存在总压损失；本模型以发光环表示热释放。','燃料化学能 → 燃气焓','燃烧升温时，总压也一定上升吗？',0xdb8637],
['动力核心涡轮','CORE TURBINE','高温燃气膨胀提取轴功，供给压气机及发电负载。本模型不宣称实机具体级数或独立自由涡轮构型。','P涡轮 ≈ P压气机 + P输出 + 损耗','涡轮做功是否全部用于发电？',0xb96941],
['后置排气段','REAR EXHAUST','燃气离开动力核心后从后部排出。该机组主要提供电功率，不以尾喷推力作为图示推进器的动力来源。','燃气流路 ≠ 电功率路径','排气为何不流向电动推进器？',0xcaa24e],
['前置发电机','FRONT GENERATOR','按用户指定构型，将发电机置于燃机前端。这里前置电机工作在发电模式；远端推进电动机仍由电路供电。机械传动细节为简化示意。','P电 = ηgen × P轴','发电机和推进电动机的工作方向有何不同？',0x568d7d],
['整流器','RECTIFIER','把发电机的交流电转换为直流，接入直流母线。电能转换有损耗，也有电压和热限制。','Pgen,DC = ηrect × Pgen,AC','为什么母线前需要整流？',0x4d9d8a],
['直流母线','DC BUS','汇集发电与电池支路功率，再送往两路电推进负载及航电。母线本身不是无限储能装置，稳态必须满足功率平衡。','Pgen,DC + Pbat,DC = Pload,DC','需求突然增大，差额谁来补？',0x217a69],
['电池组','BATTERY','可在起飞时放电补充峰值功率，在发电有富余时充电。实际使用还受 SOC、温度、寿命和充放电限制。','能量 kWh ≠ 功率 kW','为什么容量大不等于放电功率大？',0x976caf],
['双向 DC/DC','BIDIRECTIONAL CONVERTER','连接电池与直流母线，调节电压和充放电电流。充电时能量流方向反转，并不是螺旋桨自动回收能量。','电池 ⇄ DC/DC ⇄ 母线','充电时电能来自哪里？',0x9a7cae],
['逆变器 × 2','INVERTERS','将母线直流转换为电动机需要的受控多相交流。可类比公众号中的电调功能，但航空大功率设备的实现不同。','Pmotor,AC = ηinv × Pinv,DC','电调为什么不是一个可变电阻？',0x58a694],
['电动机 × 2','ELECTRIC MOTORS','用电磁转矩驱动螺旋桨。电机与燃机之间仅通过电路耦合，因此推进转速不必等于燃机转速。','P轴 = τ × ω = ηmotor × P电','两者转速独立，功率也独立吗？',0x478b84],
['螺旋桨 × 2','PROPELLERS','电机轴驱动螺旋桨，使空气获得动量并形成推力。图中桨叶转速为慢动作，未计算真实推力。','T = Cₜ ρ n² D⁴（相应工况）','为什么同样轴功率不一定有同样推力？',0x6b8290]
];
let selected=0,isolated=false,tab='model',mode='cutaway',playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,speed=1,time=0,flow=true,showLabels=true,tour=false,tourTime=0,demand=450,generation=503,state=power(demand,generation);
let renderer,scene,camera,controls,groups=[],rotors=[],shells=[],lines=[],labelEls=[],framePrevious=0,recording=false;
const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.textContent=text;return n};
parts.forEach((p,i)=>{const b=el('button',{'class':'part','data-part':i,'aria-pressed':i===0},'');b.innerHTML='<em>'+String(i+1).padStart(2,'0')+'</em><span>'+p[0]+'<small>'+p[1]+'</small></span><span>↗</span>';b.onclick=()=>select(i);$('#parts').append(b)});
function select(i){selected=i;$$('.part').forEach((b,k)=>{b.classList.toggle('active',k===i);b.setAttribute('aria-pressed',k===i)});$('#detail-en').textContent=String(i+1).padStart(2,'0')+' / '+parts[i][1];$('#detail-title').textContent=parts[i][0];$('#detail-copy').textContent=parts[i][2];$('#detail-formula').textContent=parts[i][3];$('#detail-question').textContent='想一想：'+parts[i][4];updateVisibility();$$('.flow-node rect').forEach(r=>{r.setAttribute('stroke-width',Number(r.parentNode.dataset.id)===i?3:1)});}
function updateVisibility(){groups.forEach((g,i)=>{g.visible=!isolated||i===selected;g.traverse(o=>{if(o.isMesh&&o.material?.emissive){o.material.emissive.set(i===selected?0x153d2c:0);o.material.emissiveIntensity=i===selected?.15:0}})});shells.forEach(s=>s.visible=mode==='assembled');lines.forEach(l=>l.root.visible=!isolated);}
$('#isolate').onclick=()=>{isolated=true;$('#isolate').classList.add('active');updateVisibility()};
$('#show-all').onclick=()=>{isolated=false;$('#isolate').classList.remove('active');updateVisibility()};
$$('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;$$('[data-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});$('#model-pane').hidden=tab!=='model';$('#flow-pane').hidden=tab!=='flow';$('#image-pane').hidden=tab!=='image';resize()});
$$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});updateVisibility()});
function setPlay(v){playing=v;$('#play').textContent=v?'暂停':'继续';document.body.classList.toggle('paused',!v);updateFlow()}
$('#play').onclick=()=>setPlay(!playing);$('#step').onclick=()=>{setPlay(false);time+=.1;tourTime+=.1;render(0)};
$('#speed').oninput=e=>{speed=+e.target.value;$('#speed-value').value=speed.toFixed(1)+'×';$$('.flow-wire').forEach(n=>n.style.animationDuration=(1/speed)+'s')};
$('#flow-toggle').onchange=e=>{flow=e.target.checked;document.body.classList.toggle('no-flow',!flow)};
$('#labels-toggle').onchange=e=>{showLabels=e.target.checked;$('#labels').hidden=!showLabels};
$('#tour').onclick=()=>{tour=!tour;tourTime=0;$('#tour').textContent=tour?'退出导览':'能量导览';if(tour){isolated=false;updateVisibility();setPlay(true)}};
$('#sources-open').onclick=()=>$('#sources').showModal();$('#sources-close').onclick=()=>$('#sources').close();
function updatePower(preset){state=power(demand,generation);$('#demand').value=demand;$('#generation').value=generation;$('#demand-value').value=demand+' kW';$('#generation-value').value=generation+' kW';const fmt=v=>v.toFixed(1)+'<small>kW</small>';$('#load-value').innerHTML=fmt(state.load);$('#battery-value').innerHTML=fmt(Math.abs(state.battery));$('#shaft-value').innerHTML=fmt(state.shaft);$('#turbine-value').innerHTML=fmt(state.turbine);$('#battery-label').textContent=state.battery>=0?'电池放电 → 母线':'母线 → 电池充电';let msg='功率平衡：'+generation.toFixed(1)+' '+(state.battery>=0?'+':'−')+' '+Math.abs(state.battery).toFixed(1)+' = '+state.load.toFixed(1)+' kW。电池支路数值取母线侧。';if(state.deficit>.01)msg='需求未满足：电池达到 400 kW 放电限制，尚缺 '+state.deficit.toFixed(1)+' kW。实际可用轴功率低于需求；需降低负载或增加发电。';if(state.surplus>.01)msg='无法吸收的剩余功率 '+state.surplus.toFixed(1)+' kW：已达 250 kW 充电限制。需降低发电或增加可用负载；当前指令不能形成稳态。';$('#balance-message').textContent=msg;$('#balance-message').classList.toggle('warn',state.deficit>.01||state.surplus>.01);$$('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===preset));$('#mode-explanation').textContent=preset?PRESETS[preset].text:'自定义功率分配：观察电池流向和母线平衡。';updateFlow();}
$$('[data-preset]').forEach(b=>b.onclick=()=>{const p=PRESETS[b.dataset.preset];demand=p.demand;generation=p.generation;updatePower(b.dataset.preset)});
$('#demand').oninput=e=>{demand=+e.target.value;updatePower()};$('#generation').oninput=e=>{generation=+e.target.value;updatePower()};
function updateFlow(){const w=$('#battery-wire');if(w)w.style.animationDirection=state.battery<0?'reverse':'normal';const text=$('#map-battery-label');if(text)text.textContent=(state.battery>=0?'放电 +':'充电 −')+Math.abs(state.battery).toFixed(1)+' kW';const gen=$('#map-gen-label');if(gen)gen.textContent=generation+' kW';$$('.flow-wire').forEach(n=>{const active=n.id==='battery-wire'?Math.abs(state.battery)>.05:n.id==='prop-wire'?state.shaft>0:generation>0;n.style.animationPlayState=playing&&active?'running':'paused';n.style.opacity=active?'1':'.2'})}
function buildFlow(){
const svg=$('#energy-map');const ns='http://www.w3.org/2000/svg';const add=(name,attrs,text,parent=svg)=>{const n=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;parent.append(n);return n};
const nodes=[{i:0,x:35,y:155,w:120},{i:1,x:180,y:155,w:115},{i:2,x:320,y:155,w:130},{i:3,x:475,y:155,w:135},{i:4,x:645,y:155,w:115},{i:5,x:800,y:155,w:110},{i:6,x:800,y:285,w:110},{i:7,x:200,y:385,w:130},{i:8,x:470,y:385,w:135},{i:9,x:960,y:285,w:115},{i:10,x:960,y:385,w:115},{i:11,x:960,y:460,w:115}];
const wire=(d,color,id)=>add('path',{d,fill:'none',stroke:color,'stroke-width':3,class:'flow-wire',...(id?{id}:{})});
wire('M155 182 H180 M295 182 H320 M450 182 H475','#d58a48');wire('M385 207 V235 H705 V207','#81919e'); // schematic turbine output to forward generator
wire('M760 182 H800 M855 210 V285','#007e79');wire('M910 310 H960 M1018 338 V385 M1018 438 V460','#007e79','prop-wire');wire('M330 410 H470 M605 410 H700 V310 H800','#9862bc','battery-wire');
add('path',{d:'M705 155 V110 H385 V155 M385 110 H95 V155',fill:'none',stroke:'#81919e','stroke-width':3});
add('text',{x:175,y:110,fill:'#7a8790','font-size':12},'功率核心轴：供压气机及前端发电机');
add('text',{x:720,y:250,fill:'#007e79','font-size':13,id:'map-gen-label'},'503 kW');
add('text',{x:360,y:375,fill:'#9862bc','font-size':13,id:'map-battery-label'},'');
add('text',{x:38,y:75,fill:'#32564a','font-size':23,'font-weight':600},'热能 → 轴功 → 电能 → 轴功 → 推力');
add('text',{x:40,y:265,fill:'#a66c38','font-size':13},'燃气在涡轮后排出；不流经电路或电动推进器。');
add('text',{x:38,y:490,fill:'#677d6b','font-size':12},'实线轴段为机械连接；彩色虚线为能量流示意。按部件查看解释。');
nodes.forEach(n=>{const g=add('g',{class:'flow-node','data-id':n.i,tabindex:0,role:'button','aria-label':parts[n.i][0]});add('rect',{x:n.x,y:n.y,width:n.w,height:52,rx:6,fill:'#fff',stroke:'#9bb2a5'},null,g);add('text',{x:n.x+n.w/2,y:n.y+30,'text-anchor':'middle',fill:'#35584b','font-size':13},parts[n.i][0],g);g.onclick=()=>select(n.i);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.i)}}});
}
buildFlow();
function material(color,metalness=.6,roughness=.37){return new THREE.MeshStandardMaterial({color,metalness,roughness})}
function mesh(g,geo,color,pos=[0,0,0],metal=.6){const m=new THREE.Mesh(geo,material(color,metal));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
function cylinder(g,r,len,color,x=0,y=0,z=0,r2=r){const m=mesh(g,new THREE.CylinderGeometry(r2,r,len,48),color,[x,y,z]);m.rotation.z=Math.PI/2;return m}
function box(g,w,h,d,color,pos=[0,0,0]){return mesh(g,new THREE.BoxGeometry(w,h,d),color,pos)}
function ring(g,r,t,color,x){const m=mesh(g,new THREE.TorusGeometry(r,t,10,64),color,[x,0,0]);m.rotation.y=Math.PI/2;return m}
function blades(g,x,r,color,count=22,kind='core'){const rot=new THREE.Group();rot.position.x=x;g.add(rot);cylinder(rot,.23,.11,0x7f898b);for(let j=0;j<count;j++){const a=j/count*Math.PI*2;const b=box(rot,.09,r-.2,.09,color,[0,Math.cos(a)*(r+.2)/2,Math.sin(a)*(r+.2)/2]);b.rotation.x=a;b.rotation.y=.28;}rotors.push({obj:rot,kind});return rot}
function outer(g,len,r,color){const sh=cylinder(g,r,len,color);sh.material.transparent=true;sh.material.opacity=.82;shells.push(sh);return sh}
const basePositions=[[-3,0,-1.6],[-1.65,0,-1.6],[-.65,0,-1.6],[.35,0,-1.6],[-4.65,0,-1.6],[2.65,0,-1.6],[3.3,0,.3],[-1.6,-.1,2.4],[.75,0,2.4],[5,0,0],[6.25,0,0],[7.0,0,0]];
function createModel(){
scene=new THREE.Scene();scene.background=new THREE.Color(0xeff2e9);scene.fog=new THREE.Fog(0xeff2e9,25,65);camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(12,11,16);
renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;$('#viewport').append(renderer.domElement);
controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.4,0,.2);controls.enableDamping=true;controls.minDistance=6;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.88;
scene.add(new THREE.HemisphereLight(0xffffff,0xadb6a1,2.2));const key=new THREE.DirectionalLight(0xfff4df,3);key.position.set(-5,12,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-15;key.shadow.camera.right=15;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;scene.add(key);const fill=new THREE.DirectionalLight(0xc7e7ff,2);fill.position.set(8,5,-8);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0xe9eee3,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.55;ground.receiveShadow=true;scene.add(ground);const grid=new THREE.GridHelper(38,76,0xd6ddd0,0xe2e8db);grid.position.y=-1.54;scene.add(grid);
parts.forEach((p,i)=>{const g=new THREE.Group();g.userData.part=i;g.position.set(...basePositions[i]);groups.push(g);scene.add(g);const tag=el('span',{class:'tag'},String(i+1).padStart(2,'0')+' '+p[0]);$('#labels').append(tag);labelEls.push(tag)});
// compressor, original geometric teaching blade rows
const c=groups[0];cylinder(c,.25,.95,0x99a3a6);blades(c,.18,.9,0x7193a2,20);ring(c,1.03,.12,0x647c82,-.42);ring(c,1.03,.12,0x647c82,.42);outer(c,.92,1.06,0x657a7c);
for(let j=0;j<16;j++){const a=j*Math.PI/8;box(c,.83,.05,.05,0x57717a,[0,Math.cos(a)*1.04,Math.sin(a)*1.04]);const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-Math.cos(a),-Math.sin(a)),new THREE.Vector3(0,Math.cos(a)*1.5,Math.sin(a)*1.5),.43,0x4c9abd,.13,.08);c.add(arrow)}
// annular combustor with visible fuel nozzles
const b=groups[1];cylinder(b,.36,1.0,0x748782);outer(b,1.02,.79,0xa79276);for(let j=0;j<10;j++){const a=j*Math.PI/5;cylinder(b,.14,.8,0xc68d54,0,.56*Math.cos(a),.56*Math.sin(a));const f=cylinder(b,.09,.58,0xffa33e,.05,.56*Math.cos(a),.56*Math.sin(a));f.material.emissive.set(0xd6570a);f.material.emissiveIntensity=.6;f.userData.flame=true}ring(b,.81,.04,0xbcb5a3,-.5);ring(b,.81,.04,0xbcb5a3,.5);
[2].forEach((i)=>{const g=groups[i];for(let j=0;j<2;j++)blades(g,-.15+j*.32,.68,parts[i][5],26,'core');outer(g,.75,.81,0x8c9387);ring(g,.82,.05,0x9aa093,-.4);ring(g,.82,.05,0x9aa093,.4)});cylinder(groups[3],.82,1.1,0xa6aba4,0,0,0,.62);ring(groups[3],.83,.04,0xc5ccc2,.55);
// Schematic core shaft; proprietary transmission detail is not claimed.
cylinder(groups[0],.075,4.25,0x637a91,.4);
const gen=groups[4];cylinder(gen,.54,1.15,0x4b8377);for(let j=0;j<11;j++)ring(gen,.57,.025,0x839e92,-.5+j*.1);blades(gen,0,.45,0xb59a59,12,'power');outer(gen,1.2,.59,0x688b7e);
[5,6,8].forEach(i=>{const g=groups[i];box(g,1.0,.6,1.0,i===8?0x9b89ad:parts[i][5]);for(let k=0;k<7;k++)box(g,.045,.12,.9,0xaab7ad,[-.36+k*.12,.36,0]);for(let z of [-.28,.28])box(g,.15,.1,.13,0xd6bc72,[.55,0,z])});
const bat=groups[7];box(bat,2.3,.22,1.45,0x68776c,[0,-.35,0]);for(let x=0;x<8;x++)for(let z=0;z<4;z++){const cell=mesh(bat,new THREE.CylinderGeometry(.11,.11,.6,12),0x8c78a4,[-.95+x*.27,.04,-.49+z*.32]);box(bat,.14,.035,.12,0xd2bea1,[-.95+x*.27,.36,-.49+z*.32])}box(bat,2.3,.05,1.45,0x879c88,[0,-.48,0]);
for(const z of [-2.25,2.25]){const inv=groups[9];box(inv,.8,.55,.8,0x609685,[0,0,z]);for(let k=0;k<7;k++)box(inv,.045,.12,.7,0xa8b9aa,[-.3+k*.1,.32,z]);const mot=groups[10];cylinder(mot,.43,.75,0x4b8582,0,0,z);for(let k=0;k<8;k++)ringLocal(mot,.46,.02,0xa1b1a4,-.34+k*.095,z);cylinder(mot,.1,.65,0xbbc4b6,.6,0,z);const prop=new THREE.Group();prop.position.set(0,0,z);groups[11].add(prop);cylinder(prop,.2,.42,0xb3bdba);for(let j=0;j<4;j++){const a=j*Math.PI/2;const blade=mesh(prop,new THREE.SphereGeometry(1,16,8),0x52696f,[0,Math.cos(a)*.72,Math.sin(a)*.72]);blade.scale.set(.08,.69,.12);blade.rotation.x=a;const tip=box(prop,.08,.16,.13,0xdba33c,[0,Math.cos(a)*1.32,Math.sin(a)*1.32]);tip.rotation.x=a}rotors.push({obj:prop,kind:'motor'});}
// curved exhaust exits separately above turbine; conceptual exhaust duct.
const exhaust=new THREE.CatmullRomCurve3([new THREE.Vector3(.3,.3,0),new THREE.Vector3(.6,.75,-.2),new THREE.Vector3(.9,1.1,-.8)]);mesh(groups[3],new THREE.TubeGeometry(exhaust,20,.22,14,false),0x9b9a89);
makeLine(0,1,0xd9a259,'gas');makeLine(1,2,0xd98437,'gas');makeLine(2,3,0xd98437,'gas');
makeLine(4,5,0x258b79,'gen');makeLine(5,6,0x258b79,'gen');makeLine(7,8,0x9768b4,'battery');makeLine(8,6,0x9768b4,'battery');for(const z of [-2.25,2.25]){makeLine(6,9,0x258b79,'motor',0,z);makeLine(9,10,0x258b79,'motor',z,z);}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(groups.filter(g=>g.visible),true);if(hits.length){let o=hits[0].object;while(o&&o.userData.part===undefined)o=o.parent;if(o)select(o.userData.part)}});
new ResizeObserver(resize).observe($('#viewport'));resize();updateVisibility();$('#live-status').textContent='● 三维教学构型 · 可交互';}
function ringLocal(g,r,t,color,x,z){const o=ring(g,r,t,color,x);o.position.z=z}
function makeLine(a,b,color,kind,az=0,bz=0){const root=new THREE.Group();scene.add(root);const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.65});const line=new THREE.Line(new THREE.BufferGeometry(),mat);root.add(line);const particles=[];for(let i=0;i<9;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.052,7,5),new THREE.MeshBasicMaterial({color}));root.add(p);particles.push(p)}lines.push({a,b,az,bz,root,line,particles,kind});}
function resize(){if(!renderer||tab!=='model')return;const r=$('#viewport').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function view(name){if(!camera)return;const positions={perspective:[12,11,16],top:[.5,22,.3],side:[.5,2.0,23]};camera.position.set(...positions[name]);controls.target.set(.4,0,.2);controls.update()}
$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('#reset').onclick=()=>{isolated=false;updateVisibility();view('perspective')};
function render(dt){if(!renderer)return;groups.forEach((g,i)=>{const p=basePositions[i];let dx=0,dz=0;if(mode==='exploded'){dx=i<7?(i-3)*.23:.4;dz=i===7||i===8?1.3:i>=9?.5:-.5;}g.position.lerp(new THREE.Vector3(p[0]+dx,p[1],p[2]+dz),.12)});
rotors.forEach(r=>{const rate=r.kind==='motor'?state.shaft>0?Math.pow(state.shaft/800,1/3)*3.5:0:generation>0?(r.kind==='core'?2.5:1.5)*Math.pow(generation/900,.3):0;r.obj.rotation.x=time*rate});
groups[1].traverse(o=>{if(o.userData.flame){o.visible=generation>0;o.material.emissiveIntensity=generation>0?.6+.1*Math.sin(time*9):0}});
lines.forEach(l=>{const a=groups[l.a].position.clone().add(new THREE.Vector3(.15,.15,l.az)),b=groups[l.b].position.clone().add(new THREE.Vector3(-.15,.15,l.bz));const mid1=a.clone().lerp(b,.33),mid2=a.clone().lerp(b,.66);if(l.kind!=='gas'){mid1.y=-.5;mid2.y=-.5;}const curve=new THREE.CatmullRomCurve3([a,mid1,mid2,b]);l.line.geometry.dispose();l.line.geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));let active=l.kind==='gas'||l.kind==='gen'?generation>0:l.kind==='battery'?Math.abs(state.battery)>.05:state.shaft>0;const direction=l.kind==='battery'&&state.battery<0?-1:1;l.particles.forEach((p,i)=>{p.visible=flow&&active;p.position.copy(curve.getPoint(((time*.27*direction+i/9)%1+1)%1))});});
controls.update();renderer.render(scene,camera);
if(showLabels){const r=$('#viewport').getBoundingClientRect();groups.forEach((g,i)=>{const v=g.position.clone();v.y+=i<5?1.35:.8;if(i===9)v.z-=2.25;if(i===10)v.z+=2.25;if(i===11)v.z-=2.25;v.project(camera);const n=labelEls[i];n.style.display=g.visible&&v.z<1&&tab==='model'?'block':'none';n.style.left=(v.x*.5+.5)*r.width+'px';n.style.top=(-v.y*.5+.5)*r.height+'px';n.style.borderColor=i===selected?'#de9b42':'#cfd9ca'})}
}
function loop(t){const dt=Math.min((t-framePrevious)/1000,.05)||0;framePrevious=t;if(playing){time+=dt*speed;tourTime+=dt*speed}if(tour){const seq=[0,1,2,3,4,5,6,7,8,9,10,11];const next=seq[Math.floor(tourTime/4)%seq.length];if(next!==selected)select(next);$('#live-status').textContent='● 能量导览 / '+parts[selected][0];}else $('#live-status').textContent=renderer?'● '+(playing?'动画运行':'动画暂停')+' · 教学构型':'● 能量图谱可用';if(tab==='model'||recording)render(dt);requestAnimationFrame(loop)}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a',{href:u,download:name});if(name.endsWith('.webm')){let wrap=$('#recorded-media');if(!wrap){wrap=el('section',{id:'recorded-media'});$('.downloads').after(wrap)}wrap.replaceChildren();const v=el('video',{controls:'',src:u,'aria-label':'已录制的三维动画'});v.style.cssText='width:100%;max-height:480px;background:#eef2e9';a.textContent='保存刚录制的 WebM 动画';wrap.append(v,a);a.click();}else{a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}}
$('#snapshot').onclick=()=>{if(!renderer){$('#export-status').textContent='三维显示不可用，请下载概念图或 SVG 动画。';return}render(0);renderer.domElement.toBlob(b=>{if(b)download(b,'series-hybrid-3d.png')})};
$('#record').onclick=async()=>{if(!renderer||!window.MediaRecorder||!renderer.domElement.captureStream){$('#export-status').textContent='此浏览器不支持录制，可下载独立 SVG 动画。';return}
const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type){$('#export-status').textContent='此浏览器不支持 WebM，请下载 SVG 动画。';return}
const stream=renderer.domElement.captureStream(30),chunks=[];let recorder;try{recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:6000000})}catch(e){stream.getTracks().forEach(t=>t.stop());$('#export-status').textContent='录制初始化失败，可下载 SVG 动画。';return}
recording=true;const old=playing;setPlay(true);$('#record').disabled=true;$('#export-status').textContent='正在录制 8 秒，包含当前三维画面和能量粒子…';recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{download(new Blob(chunks,{type}),'series-hybrid-animation.webm');stream.getTracks().forEach(t=>t.stop());recording=false;setPlay(old);$('#record').disabled=false;$('#export-status').textContent='WebM 动画已导出。'};recorder.start();setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},8000)};
select(0);updatePower('cruise');setPlay(playing);try{createModel()}catch(e){console.error(e);$('#webgl-fallback').hidden=false;$('#snapshot').disabled=true;$('#record').disabled=true;$('#live-status').textContent='● 请切换能量图谱';}
requestAnimationFrame(loop);

