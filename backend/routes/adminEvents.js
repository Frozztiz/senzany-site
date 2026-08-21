const express = require("express");
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const router = express.Router();

function db() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const text=(v,n=5000)=>v==null?null:(String(v).trim().slice(0,n)||null);
const bool=v=>v===true||v==="true"||v===1||v==="1";
const integer=v=>v==null||v===""?null:(Number.isFinite(parseInt(v,10))?parseInt(v,10):null);
const date=v=>{ if(!v)return null; const d=new Date(v); return Number.isNaN(d.getTime())?null:d.toISOString(); };
const first=(b,...ks)=>{ for(const k of ks) if(Object.prototype.hasOwnProperty.call(b,k)) return b[k]; };

function payload(b={}, partial=false) {
  const p={}; const set=(k,v,f=x=>x)=>{ if(v!==undefined)p[k]=f(v); };
  set("title",first(b,"title","eventTitle"),v=>text(v,120));
  set("event_type",first(b,"event_type","eventType","type"),v=>text(v,40));
  set("starts_at",first(b,"starts_at","startsAt","startAt"),date);
  set("ends_at",first(b,"ends_at","endsAt","endAt"),date);
  set("status",first(b,"status","eventStatus"),v=>text(v,30));
  set("vote_milestone",first(b,"vote_milestone","voteMilestone"),integer);
  set("is_mystery",first(b,"is_mystery","isMystery"),bool);
  set("mystery_title",first(b,"mystery_title","mysteryTitle"),v=>text(v,120));
  set("reveal_at",first(b,"reveal_at","revealAt"),date);
  set("description",first(b,"description","eventDescription"),v=>text(v,10000));
  set("location",first(b,"location","eventLocation"),v=>text(v,500));
  set("image_url",first(b,"image_url","imageUrl"),v=>text(v,2000));
  set("rewards",first(b,"rewards","eventRewards"),v=>text(v,5000));
  set("is_featured",first(b,"is_featured","isFeatured"),bool);
  if(!partial){
    if(!p.title) throw new Error("Le nom de l'événement est obligatoire.");
    if(!p.starts_at) throw new Error("La date de l'événement est obligatoire.");
    if(!p.event_type)p.event_type="major";
    if(!p.status)p.status="draft";
    if(p.is_mystery===undefined)p.is_mystery=false;
    if(p.is_featured===undefined)p.is_featured=false;
  }
  return p;
}
function norm(r={}) { return {...r,eventType:r.event_type??r.type??null,startsAt:r.starts_at??r.start_at??null,endsAt:r.ends_at??r.end_at??null,voteMilestone:r.vote_milestone??null,isMystery:r.is_mystery===true,mysteryTitle:r.mystery_title??null,revealAt:r.reveal_at??null,imageUrl:r.image_url??null,isFeatured:r.is_featured===true}; }
function fail(res,e){ console.error("[ADMIN EVENTS]",e); return res.status(500).json({error:e?.message||e?.details||"Erreur Supabase événements."}); }

router.get("/",async(req,res)=>{try{
  const {data,error}=await db().from("events").select("*");
  if(error)return fail(res,error);
  const events=(data||[]).map(norm).sort((a,b)=>(Date.parse(a.startsAt||"")||0)-(Date.parse(b.startsAt||"")||0));
  res.json({events});
}catch(e){fail(res,e)}});

router.post("/",async(req,res)=>{try{
  const p=payload(req.body||{}); p.created_by=req.commandSteamId||null;
  const {data,error}=await db().from("events").insert(p).select("*").single();
  if(error)return fail(res,error); res.status(201).json({event:norm(data)});
}catch(e){ if(/obligatoire/i.test(e?.message||""))return res.status(400).json({error:e.message}); fail(res,e)}});

router.post(
  "/upload-image",
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "5mb"
  }),
  async (req, res) => {
    try {
      const contentType = String(req.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      };

      const extension = extensions[contentType];
      if (!extension) {
        return res.status(415).json({
          error: "Format d'image non accepté. Utilise JPG, PNG ou WEBP."
        });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          error: "Aucune image reçue."
        });
      }

      if (req.body.length > 5 * 1024 * 1024) {
        return res.status(413).json({
          error: "L'image dépasse la limite de 5 Mo."
        });
      }

      const bucketName = String(
        process.env.EVENT_IMAGES_BUCKET || "event-images"
      ).trim();

      const safeOriginalName = String(req.query.filename || "event")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      const baseName =
        safeOriginalName.replace(/\.[^.]+$/, "") || "event";

      const objectPath =
        `events/${Date.now()}-${randomUUID()}-${baseName}.${extension}`;

      const client = db();
      const { error } = await client.storage
        .from(bucketName)
        .upload(objectPath, req.body, {
          contentType,
          cacheControl: "31536000",
          upsert: false
        });

      if (error) return fail(res, error);

      const { data } = client.storage
        .from(bucketName)
        .getPublicUrl(objectPath);

      const url = data?.publicUrl;
      if (!url) {
        return res.status(500).json({
          error: "URL publique de l'image introuvable."
        });
      }

      return res.status(201).json({
        ok: true,
        url,
        path: objectPath
      });
    } catch (e) {
      if (e?.type === "entity.too.large") {
        return res.status(413).json({
          error: "L'image dépasse la limite de 5 Mo."
        });
      }
      return fail(res, e);
    }
  }
);

router.get("/:id",async(req,res)=>{try{
  const {data,error}=await db().from("events").select("*").eq("id",req.params.id).maybeSingle();
  if(error)return fail(res,error); if(!data)return res.status(404).json({error:"Événement introuvable."}); res.json({event:norm(data)});
}catch(e){fail(res,e)}});

async function update(req,res){try{
  const p=payload(req.body||{},true); if(!Object.keys(p).length)return res.status(400).json({error:"Aucune modification à enregistrer."});
  p.updated_at=new Date().toISOString();
  const {data,error}=await db().from("events").update(p).eq("id",req.params.id).select("*").maybeSingle();
  if(error)return fail(res,error); if(!data)return res.status(404).json({error:"Événement introuvable."}); res.json({event:norm(data)});
}catch(e){fail(res,e)}}
router.put("/:id",update);
router.patch("/:id",update);

router.post("/:id/reveal",async(req,res)=>{try{
  const {data,error}=await db().from("events").update({is_mystery:false,reveal_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",req.params.id).select("*").maybeSingle();
  if(error)return fail(res,error); if(!data)return res.status(404).json({error:"Événement introuvable."}); res.json({event:norm(data)});
}catch(e){fail(res,e)}});

router.delete("/:id",async(req,res)=>{try{
  const {error}=await db().from("events").delete().eq("id",req.params.id);
  if(error)return fail(res,error); res.json({ok:true});
}catch(e){fail(res,e)}});

module.exports=router;
