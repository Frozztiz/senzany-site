(() => {
  const state = { events: [], selectedId: null, imageUploading: false };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const labels = { major:'Grand événement', community:'Communautaire', vote:'Palier de votes', seasonal:'Saisonnier' };
  function showGate(message) { $('eventsAdminGateMessage').textContent = message; }
  function showWorkspace() { $('eventsAdminGate').hidden = true; $('eventsAdminWorkspace').hidden = false; }
  function feedback(message, stateName='error') { const box=$('eventAdminFeedback'); box.hidden=false; box.dataset.state=stateName; box.textContent=message; }
  function clearFeedback(){ $('eventAdminFeedback').hidden=true; }
  function renderImagePreview(url='') {
    const preview = $('eventImagePreview');
    const remove = $('removeEventImage');
    if (url) {
      preview.classList.remove('is-empty');
      preview.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.55)),url("${String(url).replace(/"/g,'')}")`;
      preview.innerHTML = '<span>Image sélectionnée</span>';
      remove.hidden = false;
    } else {
      preview.classList.add('is-empty');
      preview.style.backgroundImage = '';
      preview.innerHTML = '<span>Aucune image</span>';
      remove.hidden = true;
    }
  }
  function imageStatus(message='', stateName='') {
    const box = $('eventImageUploadStatus');
    box.hidden = !message;
    box.textContent = message;
    box.dataset.state = stateName;
  }
  async function uploadEventImage(file) {
    if (!file) return;
    const allowed = new Set(['image/jpeg','image/png','image/webp']);
    if (!allowed.has(file.type)) throw new Error('Format refusé. Utilise une image JPG, PNG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('L’image dépasse la limite de 5 Mo.');
    state.imageUploading = true;
    imageStatus('Envoi de l’image en cours…', 'loading');
    $('chooseEventImage').disabled = true;
    try {
      const response = await fetch(`/api/admin/events/upload-image?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type, Accept: 'application/json' }, body: file,
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      $('eventImageUrl').value = data.url || '';
      renderImagePreview(data.url || '');
      imageStatus('Image envoyée et prête à être utilisée.', 'success');
    } finally {
      state.imageUploading = false;
      $('chooseEventImage').disabled = false;
      $('eventImageFile').value = '';
    }
  }
  async function api(path='', options={}) {
    const response = await fetch(`/api/admin/events${path}`, { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})}, ...options });
    if (response.status===204) return null;
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  }
  async function checkAccess(){
    try { const response=await fetch('/api/commandement/access',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}); const data=await response.json().catch(()=>({})); if(!response.ok||data.authorized!==true) throw new Error(data.error||'Accès refusé.'); showWorkspace(); await loadEvents(); }
    catch(error){ showGate(error.message); }
  }
  function toLocalInput(value){ if(!value) return ''; const d=new Date(value); const offset=d.getTimezoneOffset(); return new Date(d.getTime()-offset*60000).toISOString().slice(0,16); }
  function payload(){ return { title:$('eventTitle').value, eventType:$('eventType').value, startsAt:$('eventStartsAt').value, endsAt:$('eventEndsAt').value||null, status:$('eventStatus').value, voteMilestone:$('eventVoteMilestone').value, isMystery:$('eventIsMystery').checked, mysteryTitle:$('eventMysteryTitle').value, revealAt:$('eventRevealAt').value||null, description:$('eventDescription').value, location:$('eventLocation').value, imageUrl:$('eventImageUrl').value, rewards:$('eventRewards').value, isFeatured:$('eventIsFeatured').checked }; }
  function resetForm(){ state.selectedId=null; $('eventAdminForm').reset(); $('eventId').value=''; $('eventType').value='major'; $('eventStatus').value='draft'; $('eventVoteMilestone').value='1000'; $('eventMysteryTitle').value='Événement mystère'; $('eventImageUrl').value=''; renderImagePreview(''); imageStatus(); $('eventEditorMode').textContent='NOUVEL ÉVÉNEMENT'; $('eventEditorTitle').textContent='Planifier un rendez-vous'; $('deleteEventButton').hidden=true; $('revealEventNow').hidden=true; toggleFields(); renderList(); clearFeedback(); }
  function fillForm(event){ state.selectedId=event.id; $('eventId').value=event.id; $('eventTitle').value=event.title||''; $('eventType').value=event.event_type||'community'; $('eventStartsAt').value=toLocalInput(event.starts_at); $('eventEndsAt').value=toLocalInput(event.ends_at); $('eventStatus').value=event.status||'draft'; $('eventVoteMilestone').value=event.vote_milestone||1000; $('eventIsMystery').checked=Boolean(event.is_mystery); $('eventMysteryTitle').value=event.mystery_title||'Événement mystère'; $('eventRevealAt').value=toLocalInput(event.reveal_at); $('eventDescription').value=event.description||''; $('eventLocation').value=event.location||''; $('eventImageUrl').value=event.image_url||''; renderImagePreview(event.image_url||''); imageStatus(); $('eventRewards').value=event.rewards||''; $('eventIsFeatured').checked=Boolean(event.is_featured); $('eventEditorMode').textContent='MODIFICATION'; $('eventEditorTitle').textContent=event.title; $('deleteEventButton').hidden=false; $('revealEventNow').hidden=!event.is_mystery; toggleFields(); renderList(); clearFeedback(); window.scrollTo({top:0,behavior:'smooth'}); }
  function toggleFields(){ $('eventVoteMilestoneField').hidden=$('eventType').value!=='vote'; $('mysteryFields').hidden=!$('eventIsMystery').checked; }
  function renderList(){ const query=$('eventsAdminSearch').value.trim().toLowerCase(), filter=$('eventsAdminFilter').value; const rows=state.events.filter(e=>(filter==='all'||e.status===filter)&&(!query||[e.title,e.mystery_title,e.location].join(' ').toLowerCase().includes(query))); $('eventsAdminList').innerHTML=rows.length?rows.map(e=>`<button type="button" class="event-admin-row ${e.status==='draft'?'is-draft':''}${e.id===state.selectedId?' is-active':''}" data-event-id="${escapeHtml(e.id)}"><header><strong>${escapeHtml(e.title)}</strong><em>${escapeHtml(e.status.toUpperCase())}</em></header><small>${new Date(e.starts_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})} · ${labels[e.event_type]||e.event_type}${e.is_mystery?' · 🔒 Mystère':''}</small></button>`).join(''):'<div class="event-empty">Aucun événement.</div>'; document.querySelectorAll('[data-event-id]').forEach(btn=>btn.addEventListener('click',()=>fillForm(state.events.find(e=>e.id===btn.dataset.eventId)))); }
  async function loadEvents(){ try{ const data=await api(); state.events=Array.isArray(data.events)?data.events:[]; renderList(); if(state.selectedId){ const fresh=state.events.find(e=>e.id===state.selectedId); if(fresh) fillForm(fresh); } }catch(error){ feedback(error.message); } }
  $('eventAdminForm').addEventListener('submit',async(e)=>{ e.preventDefault(); clearFeedback(); if(state.imageUploading){ feedback('Attends la fin de l’envoi de l’image.'); return; } try{ const body=JSON.stringify(payload()); const data=state.selectedId?await api(`/${state.selectedId}`,{method:'PUT',body}):await api('',{method:'POST',body}); state.selectedId=data.event.id; await loadEvents(); fillForm(state.events.find(item=>item.id===state.selectedId)); feedback('Événement enregistré.', 'success'); }catch(error){ feedback(error.message); } });
  $('deleteEventButton').addEventListener('click',async()=>{ if(!state.selectedId||!confirm('Supprimer définitivement cet événement ?')) return; try{ await api(`/${state.selectedId}`,{method:'DELETE'}); resetForm(); await loadEvents(); feedback('Événement supprimé.','success'); }catch(error){feedback(error.message);} });
  $('revealEventNow').addEventListener('click',async()=>{ if(!state.selectedId||!confirm("Révéler cet événement maintenant ?")) return; try{ await api(`/${state.selectedId}/reveal`,{method:'POST',body:'{}'}); await loadEvents(); feedback('Événement révélé immédiatement.','success'); }catch(error){feedback(error.message);} });
  $('chooseEventImage').addEventListener('click',()=>$('eventImageFile').click());
  $('eventImageFile').addEventListener('change',async()=>{ try{ clearFeedback(); await uploadEventImage($('eventImageFile').files?.[0]); } catch(error){ imageStatus(error.message,'error'); feedback(error.message); } });
  $('removeEventImage').addEventListener('click',()=>{ $('eventImageUrl').value=''; renderImagePreview(''); imageStatus('Image retirée. Enregistre l’événement pour confirmer.','success'); });
  $('newEventButton').addEventListener('click',resetForm); $('eventType').addEventListener('change',toggleFields); $('eventIsMystery').addEventListener('change',toggleFields); $('eventsAdminSearch').addEventListener('input',renderList); $('eventsAdminFilter').addEventListener('change',renderList);
  checkAccess();
})();
