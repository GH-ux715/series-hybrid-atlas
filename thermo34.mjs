// User concept, not AL-31F data. SI internally; pressure in kPa at the UI.
export const assumptions={T0:288.15,p0:101.325,M0:0,inletRecovery:.98,piLP:1.25,piAxial:1.25,piMixed:3.2,etaC:.82,etaT:.86,etaM:.99,burnerRecovery:.95,nozzleRecovery:.99,cpAir:1005,cpGas:1150,gammaAir:1.4,gammaGas:1.33};
export const routePoints=[[-4.85,1.95],[-4.65,1.22],[-4.4,.87],[-2.35,.91],[-1.32,.94],[-.75,1.71],[.41,1.71],[.33,1.44],[-.48,1.43],[-.77,1.33],[-.63,1.09],[-.26,.88],[.62,1.07],[1.12,1.16],[2.42,1.21],[5.35,1.23]];
export const stationU=[0,.10,.18,.25,.32,.43,.64,.853,.90,.956,1];
export function estimateCycle({T4=1200,load=120}={}){
 const a=assumptions;let T=a.T0*(1+(a.gammaAir-1)/2*a.M0*a.M0),p=a.p0*(T/a.T0)**(a.gammaAir/(a.gammaAir-1));
 const stations=[],push=(name,u,part,note)=>stations.push({name,u,part,note,T,p});
 push('周向入口',0,1,'环境空气进入周向滤网。');p*=a.inletRecovery;push('滤网 / 进气出口',.10,1,'滤网与进气压损；无轴功，总温近似不变。');
 const compress=pi=>{T*=1+(pi**((a.gammaAir-1)/a.gammaAir)-1)/a.etaC;p*=pi;};
 const tLPin=T;compress(a.piLP);const wLP=a.cpAir*(T-tLPin);push('低压压气机出口',.18,2,'低压轴做功，空气总温和总压升高。');
 const tHPin=T;compress(a.piAxial);push('高压轴流级出口',.25,4,'高压轴流级继续压缩。');compress(a.piMixed);const wHP=a.cpAir*(T-tHPin);push('高压斜流级出口',.32,5,'斜流压缩与扩压后进入外侧供气腔。');
 push('燃烧室供气腔',.43,6,'沿外侧供气腔向后流动；本站未单列扩压损失。');
 T=T4;p*=a.burnerRecovery;push('折流燃烧 / 折返',.64,6,'加热、掺混并折返；总温升高，总压下降。');push('燃烧室出口',.853,6,'折返后进入内侧出口，供给高压涡轮；未单列出口压损。');
 const expand=work=>{const dT=work/(a.cpGas*a.etaM),base=1-dT/(a.etaT*T);p*=base>0?base**(a.gammaGas/(a.gammaGas-1)):0;T-=dT;};
 expand(wHP);push('高压涡轮出口',.90,7,'提取高压压气机所需轴功，总温和总压下降。');
 expand(wLP+load*1000);push('低压涡轮出口',.956,8,'提取低压压气机与电机负载所需轴功。');
 p*=a.nozzleRecovery;push('波瓣喷管出口',1,9,'绝热无轴功，总温近似不变；总压有损失。不是静温。');
 const valid=stations.every(s=>Number.isFinite(s.T)&&Number.isFinite(s.p)&&s.T>0&&s.p>0)&&p>a.p0;
 return {stations,valid,warning:valid?'概念稳态估算；未求解流量与部件匹配。':'该参数组合剩余总压不足，不能支持所假设的对环境排气；仅供趋势检查。',wHP:wHP/1000,wLP:wLP/1000,load,T4,maxT:Math.max(...stations.map(s=>s.T)),minP:Math.min(...stations.map(s=>s.p)),maxP:Math.max(...stations.map(s=>s.p))};
}
export function sampleStation(cycle,u){u=Math.max(0,Math.min(1,u));const a=cycle.stations;let i=0;while(i<a.length-2&&u>=a[i+1].u)i++;const f=(u-a[i].u)/(a[i+1].u-a[i].u),closest=f>.5?a[i+1]:a[i];return {...closest,T:a[i].T+(a[i+1].T-a[i].T)*f,p:a[i].p+(a[i+1].p-a[i].p)*f,region:f===0?a[i].name:f===1?a[i+1].name:a[i].name+' → '+a[i+1].name,note:f===0?a[i].note:a[i+1].note};}
export function colorRGB(value,min,max,kind='temperature'){
 const t=Math.max(0,Math.min(1,(value-min)/(max-min||1))),palette=kind==='pressure'?[[.38,.77,.68],[.15,.47,.78],[.53,.23,.66]]:[[.16,.55,.85],[.95,.70,.24],[.85,.23,.12]],f=t*2,i=Math.min(1,Math.floor(f));return palette[i].map((v,k)=>v+(palette[i+1][k]-v)*(f-i));
}
