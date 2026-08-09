/* SENZANY — bâtiments Chernarus VANILLA test V2
   Une seule source mapgrouppos retenue. Pas de fusion des 6 exports.
   Les positions et orientations viennent du fichier DayZ.
   Les dimensions restent approximatives pour le test d'alignement.
*/
(function(){
  const DATA_URL='buildings-vanilla.json';
  let buildingsLayer=null;

  function rotate(dx,dz,deg){
    const a=deg*Math.PI/180;
    const c=Math.cos(a), s=Math.sin(a);
    return [dx*c-dz*s, dx*s+dz*c];
  }

  function footprint(b){
    const hw=(Number(b.w)||12)/2;
    const hh=(Number(b.h)||9)/2;
    return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([dx,dz])=>{
      const [rx,rz]=rotate(dx,dz,Number(b.a)||0);
      return dayzToLatLng(Number(b.x)+rx,Number(b.z)+rz);
    });
  }

  async function initSenzanyVanillaBuildings(){
    const res=await fetch(DATA_URL,{cache:'no-store'});
    if(!res.ok) throw new Error('buildings-vanilla.json HTTP '+res.status);
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

    function refresh(){
      if(map.getZoom()>=5){
        if(!map.hasLayer(buildingsLayer)) buildingsLayer.addTo(map);
      }else if(map.hasLayer(buildingsLayer)){
        map.removeLayer(buildingsLayer);
      }
    }

    map.on('zoomend',refresh);
    refresh();
    return {count:data.count||0,layer:buildingsLayer};
  }

  window.initSenzanyVanillaBuildings=initSenzanyVanillaBuildings;
})();