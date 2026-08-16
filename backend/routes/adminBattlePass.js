const express = require("express");
const service = require("../services/battlePassService");
const router = express.Router();
function fail(res,e){ console.error("[BATTLE PASS]",e?.data||e); res.status(e?.status||500).json({error:e?.message||"Erreur Battle Pass."}); }
router.get("/",async(req,res)=>{try{res.json(await service.dashboard());}catch(e){fail(res,e)}});
router.put("/season",async(req,res)=>{try{res.json(await service.saveSeason(req.body,req.commandSteamId));}catch(e){fail(res,e)}});
router.put("/levels/:id",async(req,res)=>{try{res.json({level:await service.saveLevel(req.params.id,req.body,req.commandSteamId)});}catch(e){fail(res,e)}});
router.post("/players",async(req,res)=>{try{res.status(201).json({player:await service.addPlayer(req.body,req.commandSteamId)});}catch(e){fail(res,e)}});
router.put("/players/:id",async(req,res)=>{try{res.json({player:await service.updatePlayer(req.params.id,req.body,req.commandSteamId)});}catch(e){fail(res,e)}});
module.exports=router;
