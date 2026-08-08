const express = require('express');
const router = express.Router();
const { verifySteamId } = require('../utils/steamSession');
const voteAliasService = require('../services/voteAliasService');
const topServeursService = require('../services/topServeursService');
const voteWalletService = require('../services/voteWalletService');
const supabaseService = require('../services/supabaseService');

function steamIdFrom(req,res){
  const secret=process.env.SESSION_SECRET;
  if(!secret){res.status(500).json({error:'SESSION_SECRET manquant.'});return null;}
  const steamId=verifySteamId(req.cookies?.senzany_session,secret);
  if(!steamId){res.status(401).json({error:'Connexion Steam requise.'});return null;}
  return steamId;
}

async function sync(steamId){
  const aliases=await voteAliasService.listBySteamId(steamId);
  const result=await topServeursService.getPlayerVotes({aliases:aliases.map(a=>a.alias)});
  await voteWalletService.syncForPlayer({steamId,aliases,aliasDetails:result.aliasDetails});
  return {aliases,result};
}

router.get('/', async(req,res)=>{
  res.set('Cache-Control','no-store');
  const steamId=steamIdFrom(req,res); if(!steamId)return;
  try{
    const {result}=await sync(steamId);
    res.json(await voteWalletService.getSummary(steamId,result.votes));
  }catch(error){console.error('[VOTE WALLET] summary',error);res.status(error.status||502).json({error:error.message||'Cagnotte indisponible.'});}
});

router.post('/claim', async(req,res)=>{
  res.set('Cache-Control','no-store');
  const steamId=steamIdFrom(req,res); if(!steamId)return;
  try{
    const {aliases,result}=await sync(steamId);

    // Nom affiché dans le Centre de commandement.
    // Priorité au pseudo Discord lié au compte Senzany, puis au pseudo
    // réellement retrouvé sur Top-Serveurs, puis au dernier alias enregistré.
    let playerName=null;

    try{
      const link=await supabaseService.getLinkBySteamId(steamId);
      if(link?.discord_username){
        playerName=String(link.discord_username).trim()||null;
      }
    }catch(identityError){
      console.warn('[VOTE WALLET] Impossible de récupérer le nom du compte lié :',identityError?.message||identityError);
    }

    if(!playerName && result?.matchedName){
      playerName=String(result.matchedName).trim()||null;
    }

    if(!playerName && Array.isArray(result?.matchedNames) && result.matchedNames.length){
      playerName=String(result.matchedNames[result.matchedNames.length-1]||'').trim()||null;
    }

    if(!playerName && Array.isArray(aliases) && aliases.length){
      playerName=String(aliases[aliases.length-1]?.alias||'').trim()||null;
    }

    const claim=await voteWalletService.claimAll({steamId,playerName});
    res.status(201).json({...claim,summary:await voteWalletService.getSummary(steamId,result.votes)});
  }catch(error){console.error('[VOTE WALLET] claim',error);res.status(error.status||500).json({error:error.message||'Impossible de réclamer la cagnotte.',code:error.code||null});}
});

module.exports=router;
