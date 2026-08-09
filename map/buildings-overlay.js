/* SENZANY — couche bâtiments prototype V1.1
   Positions et orientations: exports DayZ mapgrouppos.
   Empreintes: approximatives pour validation visuelle.
*/
(function(){
  const DATA_URL='buildings.json';
  let buildingsLayer=null;

  function rotate(dx,dz,deg){
    const a=deg*Math.PI/180;
    const c=Math.cos(a), s=Math.sin(a);
    return [dx*c-dz*s, dx*s+dz*c];
  }

  function footprint(b){
    const hw=(Number(b.w)||12)/2;
    const hh=(Number(b.h)||9)/2;
    const pts=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];

    return pts.map(([dx,dz])=>{
      const [rx,rz]=rotate(dx,dz,Number(b.a)||0);
      return dayzToLatLng(Number(b.x)+rx,Number(b.z)+rz);
    });
  }

  async function initSenzanyBuildings(){
    const res=await fetch(DATA_URL,{cache:'no-store'});
    if(!res.ok) throw new Error('buildings.json HTTP '+res.status);

    const data=await res.json();
    buildingsLayer=L.layerGroup();

    const renderer=L.canvas({padding:.5});

    for(const b of (data.structures||[])){
      L.polygon(footprint(b),{
        renderer,
        color:'#f1dfb7',
        weight:1,
        opacity:.95,
        fillColor:'#d8c79f',
        fillOpacity:.58,
        interactive:false
      }).addTo(buildingsLayer);
    }

    function refreshVisibility(){
      if(map.getZoom()>=5){
        if(!map.hasLayer(buildingsLayer)) buildingsLayer.addTo(map);
      }else if(map.hasLayer(buildingsLayer)){
        map.removeLayer(buildingsLayer);
      }
    }

    map.on('zoomend',refreshVisibility);
    refreshVisibility();

    console.log('[SENZANY] bâtiments chargés :',data.count);
    return {layer:buildingsLayer,count:data.count||0};
  }

  window.initSenzanyBuildings=initSenzanyBuildings;
})();