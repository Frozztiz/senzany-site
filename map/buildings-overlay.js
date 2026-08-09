/* Senzany buildings overlay — prototype V1
   Source: exports mapgrouppos fournis par l'utilisateur.
   IMPORTANT: empreintes rectangulaires approximatives; positions/orientations viennent des exports DayZ.
*/
(function(){
  const WORLD=15360;
  const DATA_URL='overlay/buildings.json';
  let layer=null;

  function rotate(dx,dz,deg){
    const a=deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
    return [dx*c-dz*s, dx*s+dz*c];
  }

  function footprint(b){
    const hw=b.w/2, hh=b.h/2;
    const pts=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
    return pts.map(([dx,dz])=>{
      const [rx,rz]=rotate(dx,dz,b.a||0);
      return dayzToLatLng(b.x+rx,b.z+rz);
    });
  }

  async function initSenzanyBuildings(){
    const res=await fetch(DATA_URL,{cache:'force-cache'});
    if(!res.ok) throw new Error('buildings.json HTTP '+res.status);
    const data=await res.json();

    layer=L.layerGroup();
    const renderer=L.canvas({padding:.5});

    for(const b of data.structures||[]){
      const poly=L.polygon(footprint(b),{
        renderer,
        color:'#e8e0ce',
        weight:1,
        opacity:.9,
        fillColor:'#d6cdb9',
        fillOpacity:.55,
        interactive:false
      });
      poly.addTo(layer);
    }

    layer.addTo(map);

    // Ne dessiner les bâtiments qu'à un zoom utile.
    function visibility(){
      const z=map.getZoom();
      if(z>=5){
        if(!map.hasLayer(layer)) layer.addTo(map);
      }else if(map.hasLayer(layer)){
        map.removeLayer(layer);
      }
    }
    map.on('zoomend',visibility);
    visibility();

    console.log('[SENZANY] Couche bâtiments:', data.count);
    return layer;
  }

  window.initSenzanyBuildings=initSenzanyBuildings;
})();