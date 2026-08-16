const express = require("express");
const { verifySteamId } = require("../utils/steamSession");
const service = require("../services/battlePassService");
const router = express.Router();
router.get("/me",async(req,res)=>{try{const secret=process.env.SESSION_SECRET;const steamId=secret?verifySteamId(req.cookies?.senzany_session,secret):null;if(!steamId)return res.status(401).json({error:"Connexion Steam requise."});res.json(await service.me(String(steamId)));}catch(e){console.error("[BATTLE PASS ME]",e);res.status(e?.status||500).json({error:e?.message||"Erreur Battle Pass."});}});
module.exports=router;
