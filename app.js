import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, addDoc, updateDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = id => document.getElementById(id);
const state = { conversations: [], selectedId: null, admin: false, user: null, authenticated: false, unsubChats: null, unsubReplies: null, replies: [], search: '', view: 'home' };
const configured = !firebaseConfig.apiKey.includes('PASTE_') && !firebaseConfig.projectId.includes('YOUR_');
let auth, db;
let toastTimer;

function toast(message) { const el = $('toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 5500); }
function humanDate(value) { const d = value?.toDate?.(); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'; }
function humanTime(value) { const d = value?.toDate?.(); return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'; }
function setBusy(button, busy, text) { button.disabled = busy; if (busy) { button.dataset.label = button.textContent; button.textContent = text; } else if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; } }
function show(view) {
  state.view = view;
  for (const [name,id] of [['home','welcome-screen'],['conversation','conversation-view'],['create','create-view']]) $(id).classList.toggle('hidden', name !== view);
  $('sidebar').classList.remove('open');
  $('content').scrollTo({top:0,behavior:'instant'});
}
function setUrl(id) { const url = new URL(location.href); if (id) url.searchParams.set('chat', id); else url.searchParams.delete('chat'); history.pushState({}, '', url); }
function goHome() { state.selectedId = null; state.unsubReplies?.(); state.unsubReplies = null; show('home'); setUrl(null); renderList(); renderFeatured(); }
function goCreate() { show('create'); setUrl(null); $('question-title').focus(); }
function selectConversation(id, fromHistory=false) {
  const item = state.conversations.find(c => c.id === id);
  if (!item) { toast('Conversation not found in the most recent 100.'); return; }
  state.selectedId = id; state.unsubReplies?.(); state.replies = [];
  show('conversation'); if (!fromHistory) setUrl(id);
  renderList(); renderConversation();
  state.unsubReplies = onSnapshot(query(collection(db, 'conversations', id, 'replies'), orderBy('createdAt', 'asc'), limit(100)), snap => {
    if (state.selectedId !== id) return;
    state.replies = snap.docs.map(d => ({id:d.id,...d.data()})); renderThread();
  }, err => toast(`Couldn't load replies: ${err.message}`));
}
function renderList() {
  const box = $('chat-list'); box.replaceChildren();
  const term = state.search.toLowerCase().trim();
  const matching = state.conversations.filter(c => `${c.title} ${c.initialMessage}`.toLowerCase().includes(term));
  $('count').textContent = state.conversations.length;
  if (!matching.length) { const p=document.createElement('p'); p.className='loading-message'; p.textContent=term?'No matching conversations.':'No conversations yet. Be the first to ask!'; box.append(p); return; }
  for (const c of matching) {
    const button = document.createElement('button'); button.type='button'; button.className='chat-entry' + (c.id===state.selectedId?' active':'');
    const title=document.createElement('div'); title.className='chat-entry-title'; title.textContent=c.title;
    const sub=document.createElement('div'); sub.className='chat-entry-sub';
    const dot=document.createElement('span'); dot.className='small-dot' + (c.status==='answered'?' answered':'');
    const label=document.createElement('span'); label.textContent=(c.status==='answered'?'Answered':'Awaiting reply')+' · '+humanDate(c.createdAt);
    sub.append(dot,label); button.append(title,sub); button.addEventListener('click',()=>selectConversation(c.id)); box.append(button);
  }
}
function renderFeatured() {
  const grid=$('featured-grid'); grid.replaceChildren();
  if (!state.conversations.length) { const p=document.createElement('p'); p.className='loading-message'; p.textContent=configured?'No questions yet. Be the first to ask.':'Connect Firebase to see conversations. See README.md for setup.'; grid.append(p); return; }
  for (const c of state.conversations.slice(0,5)) {
    const button=document.createElement('button'); button.type='button'; button.className='feature-card';
    const icon=document.createElement('div'); icon.className='feature-icon'; icon.textContent='↗';
    const content=document.createElement('div');content.className='feature-content';
    const title=document.createElement('h3'); title.textContent=c.title;
    const description=document.createElement('p'); description.textContent=c.initialMessage;
    const bottom=document.createElement('div'); bottom.className='feature-bottom'; bottom.textContent=humanDate(c.createdAt);
    content.append(title,description); button.append(icon,content,bottom); button.addEventListener('click',()=>selectConversation(c.id)); grid.append(button);
  }
}
function renderConversation() {
  const c=state.conversations.find(x=>x.id===state.selectedId); if (!c) { goHome(); return; }
  $('conversation-title').textContent=c.title; $('conversation-date').textContent='Asked '+humanDate(c.createdAt)+' · Publicly visible';
  $('conversation-status').textContent=c.status==='answered'?'Answered':'Awaiting answer'; $('conversation-status').className='status'+(c.status==='answered'?' answered':'');
  $('reply-form').classList.toggle('hidden', !state.admin); $('read-only').classList.toggle('hidden', state.admin); renderThread();
}
function appendMessage(container, label, text, timestamp, admin=false) {
  const wrap=document.createElement('article'); wrap.className='message'+(admin?' admin':'');
  const avatar=document.createElement('div'); avatar.className='avatar'; avatar.textContent=admin?'✳':'?';
  const content=document.createElement('div'); content.className='message-content';
  const name=document.createElement('div'); name.className='message-label'; name.textContent=label;
  const body=document.createElement('div'); body.className='message-body'; body.textContent=text;
  const time=document.createElement('div'); time.className='message-time'; time.textContent=humanTime(timestamp);
  content.append(name,body,time); wrap.append(avatar,content); container.append(wrap);
}
function renderThread() { const c=state.conversations.find(x=>x.id===state.selectedId); if (!c) return; const thread=$('thread'); thread.replaceChildren(); appendMessage(thread,'Community member',c.initialMessage,c.createdAt); for (const r of state.replies) appendMessage(thread,'AI',r.text,r.createdAt,true); }
async function ensureAnonymous() { if (auth.currentUser) return auth.currentUser; const {user}=await signInAnonymously(auth); return user; }
async function checkAdmin(user) { if (!user || user.isAnonymous) return false; const snap=await getDoc(doc(db,'admins',user.uid)); return snap.exists() && snap.data().enabled === true; }
function listenConversations() {
  state.unsubChats?.(); state.unsubChats=onSnapshot(query(collection(db,'conversations'),orderBy('createdAt','desc'),limit(100)),snapshot=>{
    state.conversations=snapshot.docs.map(d=>({id:d.id,...d.data()})); renderList();renderFeatured();
    if (state.selectedId) { if(state.conversations.some(c=>c.id===state.selectedId)) renderConversation(); else goHome(); }
    const linked=new URLSearchParams(location.search).get('chat'); if(linked && !state.selectedId && state.conversations.some(c=>c.id===linked)) selectConversation(linked,true);
  },err=>toast(`Couldn't load conversations: ${err.message}`));
}
async function createConversation(event) {
  event.preventDefault(); if (!configured) return toast('Configure Firebase first.');
  const title=$('question-title').value.trim(),initialMessage=$('question-body').value.trim();
  if(title.length<5 || title.length>120 || initialMessage.length<10 || initialMessage.length>5000) return toast('Check the title and message lengths.');
  const button=$('create-submit'); setBusy(button,true,'Publishing…');
  try { const user=await ensureAnonymous(); const ref=await addDoc(collection(db,'conversations'),{title,initialMessage,createdBy:user.uid,status:'open',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); $('create-form').reset(); toast('Your conversation is now public!');
    // The live list may not include this new document immediately.
    state.selectedId=null; setUrl(ref.id); show('home'); $('home-question').value='';
  } catch(err) { toast('Could not publish: '+err.message); } finally {setBusy(button,false);}
}
async function sendReply(event) {
  event.preventDefault(); if (!state.admin || !state.selectedId) return toast('Admin access required.');
  const id=state.selectedId, text=$('reply-text').value.trim(); if(!text || text.length>5000) return;
  const button=$('reply-submit'); button.disabled=true;
  try { await addDoc(collection(db,'conversations',id,'replies'),{text,senderUid:auth.currentUser.uid,createdAt:serverTimestamp()});
    await updateDoc(doc(db,'conversations',id),{status:'answered',updatedAt:serverTimestamp()});
    $('reply-form').reset(); toast('Reply published.');
  } catch(err) {toast('Could not send reply: '+err.message);} finally {button.disabled=false;}
}
async function login(event) {
  event.preventDefault(); const button=$('login-submit'); setBusy(button,true,'Signing in…');
  try { const email=$('login-email').value.trim(), password=$('login-password').value; await signInWithEmailAndPassword(auth,email,password);
    // The onAuthStateChanged handler verifies the admin allowlist.
    $('login-modal').classList.add('hidden'); $('login-password').value='';
  } catch(err) {toast('Sign in failed: '+err.message);} finally {setBusy(button,false);}
}
async function toggleAccount() {if(!configured)return toast('Configure Firebase first.'); if(state.admin){await signOut(auth);return;} $('login-modal').classList.remove('hidden');$('login-email').focus();}

$('new-chat').addEventListener('click',goCreate);$('top-home').addEventListener('click',goHome);
$('back-home').addEventListener('click',goHome);$('back-from-create').addEventListener('click',goHome);
$('create-form').addEventListener('submit',createConversation);$('reply-form').addEventListener('submit',sendReply);
$('search').addEventListener('input',event=>{state.search=event.target.value;renderList();});
$('home-question-form').addEventListener('submit', event=>{event.preventDefault();const body=$('home-question').value.trim();goCreate();$('question-body').value=body; if(body.length>0){const candidate=body.split(/[.!?\n]/)[0].slice(0,120).trim();$('question-title').value=candidate.length>=5?candidate:'';} $('question-title').focus();});
$('home-question').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('home-question-form').requestSubmit();}});
$('account-button').addEventListener('click',()=>toggleAccount().catch(err=>toast(err.message)));
$('login-form').addEventListener('submit',login);$('close-login').addEventListener('click',()=>$('login-modal').classList.add('hidden'));
$('login-modal').addEventListener('click',event=>{if(event.target===$('login-modal'))$('login-modal').classList.add('hidden');});
$('menu-toggle').addEventListener('click',()=>$('sidebar').classList.toggle('open')); $('close-menu').addEventListener('click',()=>$('sidebar').classList.remove('open')); $('sidebar-scrim').addEventListener('click',()=>$('sidebar').classList.remove('open'));
window.addEventListener('keydown',event=>{if(event.key==='Escape'){$('login-modal').classList.add('hidden');$('sidebar').classList.remove('open');} if(event.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();$('search').focus();}});
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('chat');if(id)selectConversation(id,true);else goHome();});

if(configured){
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async user=>{
    try {
      if(!user){state.admin=false;state.user=null;await signInAnonymously(auth);return;}
      state.user=user;state.admin=await checkAdmin(user);
      $('account-button').textContent=state.admin?'Sign out':'Admin sign in';
      if(!user.isAnonymous && !state.admin) toast('This account is not an administrator.');
      if(state.view==='conversation')renderConversation();
      if(!state.authenticated){state.authenticated=true;listenConversations();}
    }catch(err){toast('Authentication error: '+err.message);}
  });
}else{
  $('chat-list').innerHTML='<p class="loading-message">Add Firebase config to activate the website.</p>';
}
