/* Optional cloud account layer. Existing local learning works if the service is unavailable. */
(async function () {
 const el=id=>document.getElementById(id), status=message=>{el('cloudStatus').textContent=message;if(el('quickSyncStatus'))el('quickSyncStatus').textContent=message.startsWith('已同步')?message.split('。')[0]:message.includes('冲突')||message.includes('两边')?'需要处理同步冲突':message.includes('未完成')||message.includes('失败')?'保存未完成，本机记录保留':message.includes('正在读取')?'正在恢复云端记录':message.includes('已退出')?'未登录，进度保存在本机':message.includes('连接')?'正在连接云端':user?'自动同步已就绪':'登录后可保存到云端';};
 let client,user=null,revision=null,enabled=false,busy=false,lastSnapshot='',sessionToken='',initializing=false,conflicted=false;
 const apiURL='https://rygthwrxwbmagcnvecoc.supabase.co',publicKey='sb_publishable_W5yMucz3fj-vgmMTHnwWJQ_ykXfU0mg';
 const fingerprint=b=>JSON.stringify({...b,exportedAt:''});
 const redirect=location.origin+location.pathname;
 const controls=['quickSave','cloudLogin','cloudRegister','cloudForgot','cloudPassword','cloudUpload','cloudDownload','cloudLogout','conflictLocal','conflictRemote','conflictLater'];
 function paint(){el('accountUtilities').hidden=!user;el('accountTitle').textContent=user?'我的学习账号':'登录与账号';if(!user){conflicted=false;el('cloudConflict').hidden=true;}el('cloudGuest').hidden=!!user;el('cloudMember').hidden=!user;el('cloudEmailLabel').textContent=user?.email||'';el('accountOpen').textContent=user?'我的账号':'登录 / 云同步';}

 function describeBackup(backup){const terms=backup?.words||[],days=Object.values(backup?.daily?.days||{});return terms.length+' 个词条 · 已学 '+terms.filter(w=>w.studiedAt).length+' 个 · 打卡 '+days.filter(d=>d.completed).length+' 天';}
 async function showConflict(){
  enabled=false;conflicted=true;const owner=user?.id;if(!owner)return;
  el('cloudConflict').hidden=false;el('conflictLocalInfo').textContent=describeBackup(buildLearningBackup());el('conflictRemoteInfo').textContent='正在读取…';
  status('本机与云端都有变化，自动同步已暂停。请选择保留哪份进度；不会自动覆盖。');el('accountOpen').textContent='我的账号 · 需要处理';el('accountDialog').showModal();
  const remote=await currentCloud();if(user?.id!==owner)return;el('conflictRemoteInfo').textContent=remote?describeBackup(remote.payload)+' · 保存于 '+new Date(remote.updated_at||remote.payload.exportedAt).toLocaleString('zh-CN'):'云端暂无记录';
 }
 function archiveConflict(source,backup){localStorage.setItem('phraseCloudConflictBackup:'+user.id+':'+source,JSON.stringify(backup));}
 function exportRescue(){if(!user)return;const items={beforeRestore:localStorage.getItem('phraseCloudBeforeRestore'),local:localStorage.getItem('phraseCloudConflictBackup:'+user.id+':local'),cloud:localStorage.getItem('phraseCloudConflictBackup:'+user.id+':cloud')};let count=0;for(const [name,value] of Object.entries(items)){if(!value)continue;const url=URL.createObjectURL(new Blob([value],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='学习进度备份_'+name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);count++}status(count?'已发起备份下载，可通过“我的词库”恢复完整学习备份。':'当前没有冲突处理备份。');}
 function errorText(e){const m=e?.message||String(e);if(m.includes('SYNC_CONFLICT'))return '另一设备已有更新，自动同步已暂停。请先恢复云端数据，或备份本地后再选择上传。';if(m.includes('Invalid login credentials'))return '邮箱或密码不正确。';if(m.includes('Email not confirmed'))return '请先在邮箱中确认注册。';return '操作未完成：'+m;}
 async function run(action){if(busy)return;busy=true;controls.forEach(id=>el(id).disabled=true);try{await action();}catch(e){if((e?.message||'').includes('SYNC_CONFLICT')){try{await showConflict()}catch{status('同步冲突，读取云端失败。两边数据均未覆盖，请联网后重试。')}}else status(errorText(e));}finally{busy=false;controls.forEach(id=>el(id).disabled=false);}}
 function credentials(){const email=el('cloudEmail').value.trim(),password=el('cloudSecret').value;if(!email||!el('cloudEmail').checkValidity())throw Error('请输入有效邮箱。');return {email,password};}
 async function currentCloud(){const {data,error}=await client.from('learning_backups').select('payload,revision,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data;}

 const stateKey=id=>'phraseCloudState:'+id;
 function storedState(){try{return JSON.parse(localStorage.getItem(stateKey(user.id))||'null')}catch{return null}}
 function persistState(value){localStorage.setItem(stateKey(user.id),JSON.stringify(value))}
 function capture(){if(!enabled||!user||revision===null)return null;const backup=buildLearningBackup();validateLearningBackup(backup);const dirty=fingerprint(backup)!==lastSnapshot;const state={revision,base:lastSnapshot,pending:dirty?backup:null};persistState(state);return state}
 function showSynced(){status('已同步 · '+new Date().toLocaleTimeString('zh-CN')+'。学习变化会自动保存。');el('accountOpen').textContent='我的账号 · 已同步'}
 async function upload(initial=false){
  if(!user)throw Error('请先登录。');
  if(initial){const remote=await currentCloud();if(remote&&!confirm('用本地数据替换云端记录？请先保存完整备份。'))return;revision=remote?.revision||0;enabled=true;lastSnapshot='';}
  const state=capture();if(!state||!state.pending){showSynced();return;}
  const backup=state.pending,owner=user.id;el('accountOpen').textContent='我的账号 · 同步中';el('quickSyncStatus').textContent='正在保存…';
  const {data,error}=await client.rpc('save_learning',{p_payload:backup,p_revision:revision});if(error)throw error;if(user?.id!==owner)return;
  localStorage.setItem('phraseCloudLocalOwner',owner);conflicted=false;el('cloudConflict').hidden=true;revision=data;lastSnapshot=fingerprint(backup);const remaining=capture();if(remaining.pending){status('已有新进度，正在等待下一次保存。');el('accountOpen').textContent='我的账号 · 待同步';el('quickSyncStatus').textContent='待同步，已保存在本机'}else showSynced();
 }
 function restoreCloud(remote){
  validateLearningBackup(remote.payload);
  archiveConflict('local',buildLearningBackup());
  // Preserve the displaced local data before restoring another device/account.
  localStorage.setItem('phraseCloudBeforeRestore',JSON.stringify(buildLearningBackup()));
  writeLearningBackup(remote.payload);localStorage.setItem('phraseCloudLocalOwner',user.id);
  persistState({revision:remote.revision,base:fingerprint(remote.payload),pending:null});
  location.reload();
 }
 async function download(){if(!user)throw Error('请先登录。');const remote=await currentCloud();if(!remote){status('云端还没有记录，请先上传本地数据。');return;}if(!confirm('恢复云端将替换本机当前记录。当前数据会另存一份本地恢复前备份。继续？'))return;enabled=false;restoreCloud(remote);}
 async function initializeSync(){
  if(!user||initializing)return;initializing=true;enabled=false;
  try{
   status('正在读取云端学习记录…');const owner=user.id,remote=await currentCloud();if(user?.id!==owner)return;
   const saved=storedState();
   const localOwner=localStorage.getItem('phraseCloudLocalOwner');
   if(localOwner&&localOwner!==owner){
    if(saved?.pending){localStorage.setItem('phraseCloudBeforeRestore',JSON.stringify(buildLearningBackup()));writeLearningBackup(saved.pending);localStorage.setItem('phraseCloudLocalOwner',owner);location.reload();return;}
    if(remote){restoreCloud(remote);return;}
    status('当前本机记录属于其他账号。请先导出备份，再明确选择上传本地数据，避免混入当前账号。');return;
   }
   if(saved?.pending){
    validateLearningBackup(saved.pending);
    if(remote&&fingerprint(remote.payload)===fingerprint(saved.pending)){revision=remote.revision;lastSnapshot=fingerprint(remote.payload);enabled=true;capture();await upload();return;}
    if((remote?.revision||0)!==saved.revision){await showConflict();return;}
    revision=saved.revision;lastSnapshot=saved.base;enabled=true;await upload();return;
   }
   if(remote){
    const local=buildLearningBackup();
    if(saved&&fingerprint(local)!==saved.base){revision=saved.revision;lastSnapshot=saved.base;enabled=true;capture();if(remote.revision!==revision){await showConflict();return;}await upload();return;}
    if(fingerprint(local)!==fingerprint(remote.payload)){restoreCloud(remote);return;}
    revision=remote.revision;lastSnapshot=fingerprint(local);enabled=true;capture();showSynced();
   }else if(saved){revision=0;lastSnapshot='';enabled=true;await upload();}
   else{status('首次使用：是否将本机现有词库和进度存入这个账号？确认后会自动同步。');el('accountDialog').showModal();if(confirm('云端暂无记录，是否将本机现有词库和学习进度保存到当前账号？')){revision=0;lastSnapshot='';enabled=true;await upload();}}
  }finally{initializing=false}
 }
 function markPending(){try{if(conflicted&&user){const saved=storedState();if(saved){saved.pending=buildLearningBackup();persistState(saved);}return;}const state=capture();if(state?.pending){el('accountOpen').textContent='我的账号 · 待同步';el('quickSyncStatus').textContent='待同步，已保存在本机'}}catch(e){enabled=false;status('本地保存未完成，请立即导出完整备份：'+e.message)}}
 function checkpoint(){
  markPending();if(!enabled||!user||busy||!sessionToken)return;
  const state=storedState();if(!state?.pending)return;
  const body=JSON.stringify({p_payload:state.pending,p_revision:state.revision});
  // Browsers limit keepalive bodies. Large snapshots remain durable locally.
  if(new TextEncoder().encode(body).length>60000)return;
  const owner=user.id;fetch(apiURL+'/rest/v1/rpc/save_learning',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'},body,keepalive:true}).then(async response=>{if(!response.ok)return;const next=await response.json();if(user?.id!==owner||revision!==state.revision)return;revision=next;lastSnapshot=fingerprint(state.pending);capture();}).catch(()=>{});
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)checkpoint();else if(user&&!busy)run(initializeSync)});
 window.addEventListener('pagehide',checkpoint);
 window.addEventListener('online',()=>{if(user&&!busy)run(initializeSync)});
 window.addEventListener('beforeunload',e=>{markPending();if(user&&storedState()?.pending){e.preventDefault();e.returnValue='';}});
 document.addEventListener('click',()=>setTimeout(markPending,0));document.addEventListener('input',()=>setTimeout(markPending,0));document.addEventListener('change',()=>setTimeout(markPending,0));

 function authMode(register){el('cloudLogin').hidden=register;el('cloudRegister').hidden=!register;el('cloudForgot').hidden=register;el('registerHint').hidden=!register;el('authLoginTab').classList.toggle('primary',!register);el('authRegisterTab').classList.toggle('primary',register);el('authLoginTab').setAttribute('aria-pressed',String(!register));el('authRegisterTab').setAttribute('aria-pressed',String(register));el('cloudSecret').autocomplete=register?'new-password':'current-password';el('cloudSecret').placeholder=register?'设置密码，至少 8 位':'请输入密码';el('authDescription').textContent=register?'创建账号，在不同设备上积累同一份学习进度。':'欢迎回来，登录后继续上次的学习。';}
 el('authLoginTab').onclick=()=>authMode(false);el('authRegisterTab').onclick=()=>authMode(true);
 el('accountOpen').onclick=()=>el('accountDialog').showModal();el('accountClose').onclick=()=>el('accountDialog').close();
 try{status('正在连接账号服务，请稍候…');const {createClient}=await Promise.race([import('https://esm.sh/@supabase/supabase-js@2'),new Promise((_,reject)=>setTimeout(()=>reject(Error('加载超时')),15000))]);client=createClient('https://rygthwrxwbmagcnvecoc.supabase.co','sb_publishable_W5yMucz3fj-vgmMTHnwWJQ_ykXfU0mg');
 client.auth.onAuthStateChange((event,session)=>{const next=session?.user||null;if(next?.id!==user?.id){enabled=false;revision=null;lastSnapshot='';}user=next;sessionToken=session?.access_token||'';paint();if(event==='SIGNED_IN')setTimeout(()=>{if(user&&!busy)run(initializeSync)},0);if(event==='PASSWORD_RECOVERY'){el('accountDialog').showModal();el('cloudPassword').hidden=false;status('请在下方输入新密码并保存。');}else if(event==='SIGNED_OUT')status('已退出。当前浏览器的本地学习数据仍保留。');});
 const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;sessionToken=data.session?.access_token||'';paint();if(user)await run(initializeSync);else status('登录后自动恢复云端记录，学习进度自动保存。');
 controls.forEach(id=>el(id).disabled=false);
 el('cloudLogin').onclick=()=>run(async()=>{const c=credentials();const {error}=await client.auth.signInWithPassword(c);if(error)throw error;el('cloudSecret').value='';await initializeSync();});
 el('cloudRegister').onclick=()=>run(async()=>{const c=credentials();if(c.password.length<8)throw Error('密码至少 8 位。');const {data,error}=await client.auth.signUp({...c,options:{emailRedirectTo:redirect}});if(error)throw error;el('cloudSecret').value='';if(data.session)await initializeSync();else status('注册请求已提交，请查收邮箱确认链接，再返回登录。');});
 el('cloudForgot').onclick=()=>run(async()=>{const email=el('cloudEmail').value.trim();if(!email||!el('cloudEmail').checkValidity())throw Error('请先填写有效邮箱。');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(error)throw error;status('重置请求已提交。若邮箱对应账号可用，请查收重置邮件。');});
 el('cloudPassword').onclick=()=>run(async()=>{const password=el('cloudNewPassword').value;if(password.length<8)throw Error('新密码至少 8 位。');const {error}=await client.auth.updateUser({password});if(error)throw error;el('cloudNewPassword').value='';status('密码已更新。');});
 el('cloudUpload').onclick=()=>run(async()=>{const remote=await currentCloud();if(remote)archiveConflict('cloud',remote.payload);await upload(true)});el('cloudDownload').onclick=()=>run(download);
 el('quickSave').onclick=()=>run(async()=>{
  if(!user){el('accountDialog').showModal();status('请先登录，登录后即可保存进度到云端。');return;}
  if(conflicted){await showConflict();return;}
  if(!navigator.onLine){markPending();status('保存未完成：当前离线，进度已保留在本机，联网后自动重试。');return;}
  if(!enabled){await initializeSync();return;}
  markPending();await upload();
 });
 el('conflictLocal').onclick=()=>run(async()=>{markPending();const remote=await currentCloud();if(remote){validateLearningBackup(remote.payload);archiveConflict('cloud',remote.payload);}archiveConflict('local',buildLearningBackup());if(!confirm('保留本机当前进度并替换云端？两份记录会先保存为本地备份。'))return;revision=remote?.revision||0;lastSnapshot='';enabled=true;await upload();});
 el('conflictRemote').onclick=()=>run(download);
 el('conflictLater').onclick=()=>{markPending();el('accountDialog').close();status('已暂停云同步，可继续本机学习。稍后打开账号处理冲突。');el('accountOpen').textContent='我的账号 · 需要处理';};
 el('conflictBackup').onclick=exportRescue;
 el('cloudLogout').onclick=()=>run(async()=>{
  if(!user)return;markPending();
  if(!enabled&&storedState()?.pending)throw Error('本机还有未同步进度，请处理同步冲突后再退出。');
  if(enabled){await upload();if(capture()?.pending)throw Error('还有新进度未保存，请稍后重试退出。');}
  const {error}=await client.auth.signOut();if(error)throw error;enabled=false;
 });
 setInterval(()=>{markPending();if(!enabled||!user||busy||document.hidden||!navigator.onLine)return;const saved=storedState();if(saved?.pending)run(()=>upload());},2000);
 }catch(e){controls.forEach(id=>el(id).disabled=true);status('账号服务暂时无法连接，本地学习仍可使用。请检查网络后刷新重试。');}
})();
