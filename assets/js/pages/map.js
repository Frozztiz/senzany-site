(() => {
  const stage = document.getElementById('mapStage');
  const canvas = document.getElementById('mapCanvas');
  const layer = document.getElementById('markerLayer');
  if (!stage || !canvas || !layer) return;

  const WORLD = 15360;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, startTx = 0, startTy = 0;
  let placementMode = false;
  let selectedMarker = null;

  function apply() {
    canvas.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`;
    const reset = document.getElementById('zoomReset');
    if (reset) reset.textContent = `${Math.round(scale * 100)}%`;
  }

  function clampScale(v){ return Math.max(.65, Math.min(3.2, v)); }
  function zoomAt(delta){
    scale = clampScale(scale + delta);
    apply();
  }

  document.getElementById('zoomIn')?.addEventListener('click', () => zoomAt(.18));
  document.getElementById('zoomOut')?.addEventListener('click', () => zoomAt(-.18));
  document.getElementById('zoomReset')?.addEventListener('click', () => { scale=1; tx=0; ty=0; apply(); });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    scale = clampScale(scale + (e.deltaY < 0 ? .12 : -.12));
    apply();
  }, {passive:false});

  stage.addEventListener('pointerdown', e => {
    dragging = true; moved = false;
    startX=e.clientX; startY=e.clientY; startTx=tx; startTy=ty;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(Math.abs(dx)+Math.abs(dy)>5) moved=true;
    tx=startTx+dx; ty=startTy+dy; apply();
  });
  stage.addEventListener('pointerup', e => {
    dragging=false; stage.classList.remove('is-dragging');
    if(!moved && placementMode) placeFromClient(e.clientX,e.clientY);
  });

  function placeFromClient(clientX, clientY){
    const rect=canvas.getBoundingClientRect();
    const px=(clientX-rect.left)/rect.width;
    const py=(clientY-rect.top)/rect.height;
    if(px<0||px>1||py<0||py>1) return;

    const x=Math.max(0,Math.min(WORLD,Math.round(px*WORLD)));
    const z=Math.max(0,Math.min(WORLD,Math.round((1-py)*WORLD)));

    if(selectedMarker) selectedMarker.remove();
    selectedMarker=document.createElement('div');
    selectedMarker.className='map-marker map-marker--selected';
    selectedMarker.style.left=`${px*100}%`;
    selectedMarker.style.top=`${py*100}%`;
    selectedMarker.innerHTML='<div class="map-marker__radius"></div><div class="map-marker__dot"></div>';
    layer.appendChild(selectedMarker);

    document.getElementById('selectedX').textContent=x;
    document.getElementById('selectedZ').textContent=z;
    const panel=document.getElementById('selectionPanel');
    if(panel) panel.hidden=false;
    placementMode=false;
    stage.style.cursor='grab';
  }

  const startBtn=document.getElementById('startPlacementBtn');
  startBtn?.addEventListener('click',()=>{
    placementMode=true;
    stage.style.cursor='crosshair';
    const hint=document.getElementById('mapHint');
    if(hint) hint.textContent='Cliquez sur la carte pour placer le centre de votre future base';
  });

  document.getElementById('cancelPlacementBtn')?.addEventListener('click',()=>{
    placementMode=false;
    selectedMarker?.remove(); selectedMarker=null;
    const panel=document.getElementById('selectionPanel');
    if(panel) panel.hidden=true;
    stage.style.cursor='grab';
  });

  document.getElementById('submitPlacementBtn')?.addEventListener('click',()=>{
    const x=document.getElementById('selectedX')?.textContent;
    const z=document.getElementById('selectedZ')?.textContent;
    alert(`V1 interface validée : demande X ${x} / Z ${z}.\\n\\nLa connexion Supabase sera ajoutée à l'étape suivante.`);
  });

  apply();
})();