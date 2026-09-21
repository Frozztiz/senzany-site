class SZD_DeliveryManager
{
    protected static ref SZD_DeliveryManager s_Instance;
    protected static const string SETTINGS_DIRECTORY = "$profile:SenzanyDelivery";
    protected static const string SETTINGS_FILE = "$profile:SenzanyDelivery/settings.json";

    protected ref SZD_Settings m_Settings;
    protected RestContext m_RestContext;
    protected bool m_IsRunning;
    protected float m_PollTimer;
    protected ref array<string> m_ClaimsInProgress;
    protected bool m_SkinPollInProgress;

    void SZD_DeliveryManager()
    {
        s_Instance = this;
        m_ClaimsInProgress = new array<string>();
        m_SkinPollInProgress = false;
        Print("[SenzanyDelivery] Manager construit - version 1.1.4-inventory-snapshot");
    }

    static SZD_DeliveryManager GetInstance()
    {
        return s_Instance;
    }

    void Start()
    {
        Print("[SenzanyDelivery] Agent demarre");

        if (!LoadSettings())
        {
            Print("[SenzanyDelivery] ERREUR - Impossible de charger la configuration");
            return;
        }

        Print("[SenzanyDelivery] Configuration OK");
        Print("[SenzanyDelivery] API URL : " + m_Settings.apiUrl);
        Print("[SenzanyDelivery] Agent ID : " + m_Settings.agentId);
        Print("[SenzanyDelivery] Poll interval : " + m_Settings.pollIntervalSeconds.ToString() + " seconde(s)");

        if (m_Settings.apiKey == "" || m_Settings.apiKey == "CHANGE_ME")
        {
            Print("[SenzanyDelivery] ERREUR - apiKey non configuree dans settings.json");
            return;
        }

        m_PollTimer = 0;
        m_IsRunning = true;
    }

    void Stop()
    {
        m_IsRunning = false;
        Print("[SenzanyDelivery] Agent arrete");
    }

    void Update(float timeslice)
    {
        if (!m_IsRunning || !m_Settings)
        {
            return;
        }

        m_PollTimer += timeslice;

        if (m_PollTimer < m_Settings.pollIntervalSeconds)
        {
            return;
        }

        m_PollTimer = 0;
        PollConnectedPlayers();
        PollSkinGrants();
    }

    protected string BuildSkinAgentBody()
    {
        string body = "{";
        body += "\"AgentKey\":\"" + m_Settings.apiKey + "\",";
        body += "\"AgentId\":\"" + m_Settings.agentId + "\"";
        body += "}";
        return body;
    }

    protected void PollSkinGrants()
    {
        if (m_SkinPollInProgress) return;

        RestContext context = CreateContext();
        if (!context)
        {
            Print("[ABP][LBMASTER] claim retry - contexte REST indisponible");
            return;
        }

        m_SkinPollInProgress = true;
        SZD_SkinPollCallback callback = new SZD_SkinPollCallback(this);
        int result = context.POST(callback, "/api/battle-pass-delivery/lbmaster-skins/poll", BuildSkinAgentBody());
        if (result < 0 || result >= ERestResultState.EREST_ERROR)
        {
            m_SkinPollInProgress = false;
            Print("[ABP][LBMASTER] claim retry - poll refuse");
        }
    }

    void OnSkinPollFailure(string reason)
    {
        m_SkinPollInProgress = false;
        Print("[ABP][LBMASTER] claim retry - " + reason);
    }

    protected bool IsValidSkinPermission(string permission)
    {
        if (permission.Length() < 1 || permission.Length() > 128) return false;
        string allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
        for (int i = 0; i < permission.Length(); i++)
        {
            if (allowed.IndexOf(permission.Substring(i, 1)) == -1) return false;
        }
        return true;
    }

    void OnSkinPollResponse(string data)
    {
        if (data.IndexOf("\"grant\":null") != -1)
        {
            m_SkinPollInProgress = false;
            return;
        }

        SZD_SkinPollResponse response = new SZD_SkinPollResponse();
        JsonSerializer serializer = new JsonSerializer();
        string jsonError;
        if (!serializer.ReadFromString(response, data, jsonError) || !response || !response.success || !response.grant)
        {
            OnSkinPollFailure("reponse backend invalide");
            return;
        }

        SZD_SkinGrant grant = response.grant;
        Print("[ABP][LBMASTER] claim recu id=" + grant.claimId);
        Print("[ABP][LBMASTER] permission demandee=" + grant.permission);

        if (grant.steamId.Length() != 17 || !IsValidSkinPermission(grant.permission))
        {
            CompleteSkinGrant(grant, "permanentError", 400);
            return;
        }

        string lbBody = "{";
        lbBody += "\"steamid\":\"" + grant.steamId + "\",";
        lbBody += "\"permissionGroupName\":\"" + grant.permission + "\",";
        lbBody += "\"comment\":\"Senzany Battle Pass\"";
        lbBody += "}";

        LBAPIResponse lbResponse = LBAPIManager.OnAPIRequest("SenzanyBattlePass", "/v1/skins/permissions/player/add", lbBody, false);
        if (!lbResponse)
        {
            CompleteSkinGrant(grant, "retry", 0);
            return;
        }

        int code = lbResponse.GetCode();
        Print("[ABP][LBMASTER] LBmaster reponse code=" + code.ToString());
        if (code == 200)
        {
            CompleteSkinGrant(grant, "success", code);
            return;
        }
        if (code == 304)
        {
            CompleteSkinGrant(grant, "alreadyExists", code);
            return;
        }
        if (code == 400 || code == 404)
        {
            CompleteSkinGrant(grant, "permanentError", code);
            return;
        }
        CompleteSkinGrant(grant, "retry", code);
    }

    protected void CompleteSkinGrant(SZD_SkinGrant grant, string result, int code)
    {
        RestContext context = CreateContext();
        if (!context || !grant)
        {
            OnSkinPollFailure("confirmation impossible");
            return;
        }

        SZD_SkinCompleteRequest request = new SZD_SkinCompleteRequest();
        request.AgentKey = m_Settings.apiKey;
        request.AgentId = m_Settings.agentId;
        request.ClaimId = grant.claimId;
        request.ClaimToken = grant.claimToken;
        request.Result = result;
        request.LBmasterCode = code;
        JsonSerializer serializer = new JsonSerializer();
        string payload;
        if (!serializer.WriteToString(request, false, payload))
        {
            OnSkinPollFailure("serialisation confirmation impossible");
            return;
        }

        SZD_SkinCompleteCallback callback = new SZD_SkinCompleteCallback(this, grant.claimId, result);
        int state = context.POST(callback, "/api/battle-pass-delivery/lbmaster-skins/complete", payload);
        if (state < 0 || state >= ERestResultState.EREST_ERROR)
        {
            OnSkinPollFailure("confirmation refusee");
        }
    }

    void OnSkinCompleteFailure(string claimId, string reason)
    {
        m_SkinPollInProgress = false;
        Print("[ABP][LBMASTER] claim retry id=" + claimId + " - " + reason);
    }

    void OnSkinCompleteResponse(string claimId, string result, string data)
    {
        m_SkinPollInProgress = false;
        if (data.IndexOf("\"success\":true") == -1)
        {
            Print("[ABP][LBMASTER] claim retry id=" + claimId + " - confirmation backend invalide");
            return;
        }
        if (result == "success" || result == "alreadyExists")
        {
            Print("[ABP][LBMASTER] claim termine id=" + claimId);
            return;
        }
        if (result == "permanentError")
        {
            Print("[ABP][LBMASTER] claim echec id=" + claimId);
            return;
        }
        Print("[ABP][LBMASTER] claim retry id=" + claimId);
    }

    protected void PollConnectedPlayers()
    {
        array<Man> players = new array<Man>();
        GetGame().GetPlayers(players);

        Print("[SenzanyDelivery] POLL joueurs connectes : " + players.Count().ToString());

        foreach (Man man : players)
        {
            PlayerBase player = PlayerBase.Cast(man);

            if (!player || !player.IsAlive() || !player.GetIdentity())
            {
                continue;
            }

            string steamId = player.GetIdentity().GetPlainId();
            string playerName = player.GetIdentity().GetName();

            if (steamId.Length() != 17)
            {
                Print("[SenzanyDelivery] CLAIM ignore - SteamID invalide pour " + playerName + " : " + steamId);
                continue;
            }

            CheckForPlayer(player, steamId);
            SendInventorySnapshot(player, steamId, playerName);
        }
    }

    protected void SendInventorySnapshot(PlayerBase player, string steamId, string playerName)
    {
        if (!player || !player.GetInventory()) return;

        ref array<EntityAI> entities = new array<EntityAI>();
        player.GetInventory().EnumerateInventory(InventoryTraversalType.PREORDER, entities);

        SZD_InventorySnapshotRequest request = new SZD_InventorySnapshotRequest();
        request.steamId = steamId;
        request.playerName = playerName;
        request.agentId = m_Settings.agentId;
        request.agentKey = m_Settings.apiKey;
        request.items = new array<ref SZD_InventoryItemSnapshot>();

        foreach (EntityAI entity : entities)
        {
            if (!entity || entity == player) continue;

            string className = entity.GetType();
            if (className == "") continue;

            SZD_InventoryItemSnapshot row = new SZD_InventoryItemSnapshot();
            row.className = className;
            row.displayName = className;
            row.quantity = 1;
            row.healthPercent = entity.GetHealth01("", "") * 100.0;

            ItemBase item = ItemBase.Cast(entity);
            if (item && item.HasQuantity())
            {
                float quantity = item.GetQuantity();
                if (quantity > 0) row.quantity = Math.Round(quantity);
            }

            request.items.Insert(row);
        }

        JsonSerializer serializer = new JsonSerializer();
        string payload;
        if (!serializer.WriteToString(request, false, payload))
        {
            Print("[SenzanyInventory] Serialisation impossible pour " + steamId);
            return;
        }

        RestContext context = CreateContext();
        if (!context)
        {
            Print("[SenzanyInventory] Contexte REST indisponible pour " + steamId);
            return;
        }

        SZD_InventorySnapshotCallback callback = new SZD_InventorySnapshotCallback(steamId);
        int state = context.POST(callback, "/api/delivery-agent/inventory", payload);

        if (state < 0 || state >= ERestResultState.EREST_ERROR)
        {
            Print("[SenzanyInventory] Envoi refuse pour " + steamId);
        }
    }

    protected string BuildAgentBody(string steamId)
    {
        string body = "{";
        body += "\"steamId\":\"" + steamId + "\",";
        body += "\"agentId\":\"" + m_Settings.agentId + "\",";
        body += "\"agentKey\":\"" + m_Settings.apiKey + "\"";
        body += "}";
        return body;
    }

    protected RestContext CreateContext()
    {
        RestApi restApi = GetRestApi();
        if (!restApi) return null;

        RestContext context = restApi.GetRestContext(m_Settings.apiUrl);
        if (context) context.SetHeader("application/json");
        return context;
    }

    protected void CheckForPlayer(PlayerBase player, string steamId)
    {
        RestContext context = CreateContext();
        if (!context)
        {
            Print("[SenzanyDelivery] CHECK ERREUR - contexte REST indisponible");
            return;
        }

        SZD_CheckCallback callback = new SZD_CheckCallback(this, player, steamId);
        context.POST(callback, "/api/delivery-agent/check", BuildAgentBody(steamId));
    }

    void OnCheckResponse(PlayerBase player, string steamId, string data)
    {
        if (!ValidatePlayer(player, steamId)) return;

        SZD_CheckResponse response = new SZD_CheckResponse();
        JsonSerializer serializer = new JsonSerializer();
        string jsonError;

        if (!serializer.ReadFromString(response, data, jsonError))
        {
            Print("[SenzanyDelivery] CHECK JSON invalide : " + jsonError);
            return;
        }

        SendStatus(player, response.count);
    }

    void RequestClaimForPlayer(PlayerBase player, PlayerIdentity sender)
    {
        if (!m_IsRunning || !player || !sender || !player.GetIdentity()) return;

        string steamId = sender.GetPlainId();
        if (steamId.Length() != 17 || player.GetIdentity().GetPlainId() != steamId) return;

        if (m_ClaimsInProgress.Find(steamId) != -1)
        {
            SendResult(player, 0, "Une recuperation est deja en cours.");
            return;
        }

        m_ClaimsInProgress.Insert(steamId);
        SendResult(player, 1, "Recuperation en cours...");

        RestContext context = CreateContext();
        if (!context)
        {
            RemoveClaimLock(steamId);
            SendResult(player, 0, "Service de livraison indisponible.");
            return;
        }

        SZD_ClaimCallback callback = new SZD_ClaimCallback(this, player, steamId);
        context.POST(callback, "/api/delivery-agent/claim", BuildAgentBody(steamId));
    }

    void OnClaimTransportFailure(PlayerBase player, string steamId, string message)
    {
        RemoveClaimLock(steamId);
        if (ValidatePlayer(player, steamId)) SendResult(player, 0, message);
    }

    protected bool ValidatePlayer(PlayerBase player, string steamId)
    {
        return player && player.IsAlive() && player.GetIdentity() && player.GetIdentity().GetPlainId() == steamId;
    }

    protected void RemoveClaimLock(string steamId)
    {
        int index = m_ClaimsInProgress.Find(steamId);
        if (index != -1) m_ClaimsInProgress.Remove(index);
    }

    protected void SendStatus(PlayerBase player, int count)
    {
        if (!player || !player.GetIdentity()) return;
        GetGame().RPCSingleParam(player, 742100, new Param1<int>(count), true, player.GetIdentity());
    }

    protected void SendResult(PlayerBase player, int state, string message)
    {
        if (!player || !player.GetIdentity()) return;
        GetGame().RPCSingleParam(player, 742102, new Param2<int, string>(state, message), true, player.GetIdentity());
    }

    void OnClaimResponse(PlayerBase player, string steamId, string data)
    {
        if (data.IndexOf("\"delivery\":null") != -1)
        {
            Print("[SenzanyDelivery] CLAIM aucune livraison en attente pour " + steamId);
            RemoveClaimLock(steamId);
            if (ValidatePlayer(player, steamId))
            {
                SendStatus(player, 0);
                SendResult(player, 0, "Aucune livraison en attente.");
            }
            return;
        }

        if (!player || !player.IsAlive() || !player.GetIdentity())
        {
            Print("[SenzanyDelivery] CLAIM abandon - joueur absent ou mort : " + steamId);
            RemoveClaimLock(steamId);
            return;
        }

        if (player.GetIdentity().GetPlainId() != steamId)
        {
            Print("[SenzanyDelivery] CLAIM abandon - SteamID incorrect");
            RemoveClaimLock(steamId);
            return;
        }

        SZD_ClaimResponse response = new SZD_ClaimResponse();
        JsonSerializer serializer = new JsonSerializer();
        string jsonError;

        if (!serializer.ReadFromString(response, data, jsonError))
        {
            Print("[SenzanyDelivery] CLAIM JSON invalide : " + jsonError);
            RemoveClaimLock(steamId);
            SendResult(player, 0, "Reponse de livraison invalide.");
            return;
        }

        if (!response.delivery)
        {
            Print("[SenzanyDelivery] CLAIM ATTENTION - aucune livraison exploitable");
            RemoveClaimLock(steamId);
            SendResult(player, 0, "Aucune livraison exploitable.");
            return;
        }

        Print("[SenzanyDelivery] CLAIM livraison recue pour " + steamId);

        string deliveryError;
        bool success = Deliver(player, response.delivery, deliveryError);

        Complete(player, steamId, response.delivery, success, deliveryError);
    }

    protected bool Deliver(PlayerBase player, SZD_Delivery delivery, out string errorMessage)
    {
        if (!delivery.items || delivery.items.Count() == 0)
        {
            errorMessage = "La livraison ne contient aucun objet.";
            Print("[SenzanyDelivery] LIVRAISON ECHEC - " + errorMessage);
            return false;
        }

        int totalRequested = 0;
        int totalCreated = 0;
        ref array<string> failures = new array<string>();

        foreach (SZD_DeliveryItem deliveryItem : delivery.items)
        {
            if (!deliveryItem || deliveryItem.className == "")
            {
                failures.Insert("classname vide");
                continue;
            }

            int quantity = deliveryItem.quantity;

            if (quantity < 1)
            {
                quantity = 1;
            }

            // Cagnotte de votes : livraison virtuelle vers Enhanced Banking.
            // Aucun billet physique n'est cree.
            if (deliveryItem.className == "SenzanyBankCredit")
            {
                totalRequested += quantity;

                string bankError;
                bool bankSuccess = CreditLBmasterBank(player, quantity, bankError);

                if (bankSuccess)
                {
                    totalCreated += quantity;

                    // Message prive affiche uniquement au joueur qui vient de recevoir le credit.
                    string playerBankMessage = "SENZANY - Transfert bancaire : ";
                    playerBankMessage += quantity.ToString();
                    playerBankMessage += " $ ont ete credites sur votre compte.";
                    player.MessageStatus(playerBankMessage);

                    Print("[SenzanyDelivery] BANK CREDIT OK : +" + quantity.ToString() + " $");
                }
                else
                {
                    failures.Insert("SenzanyBankCredit : " + bankError);
                    Print("[SenzanyDelivery] BANK CREDIT ECHEC : " + bankError);
                }

                continue;
            }

            // Bitcoin physique - test minimal : un seul objet avec la quantite demandee.
            // Pas de boucle, pas de helper, pas de calcul de stack.
            if (deliveryItem.className == "bitcoin")
            {
                totalRequested += quantity;

                EntityAI bitcoinCreated = CreateForPlayer(player, deliveryItem.className, 0);

                if (bitcoinCreated)
                {
                    ItemBase bitcoinItem = ItemBase.Cast(bitcoinCreated);

                    if (bitcoinItem)
                    {
                        bitcoinItem.SetQuantity(quantity);
                        totalCreated += quantity;
                        Print("[SenzanyDelivery] BITCOIN MINIMAL OK : " + quantity.ToString());
                    }
                    else
                    {
                        failures.Insert("bitcoin");
                        Print("[SenzanyDelivery] BITCOIN MINIMAL ECHEC : ItemBase invalide");
                    }
                }
                else
                {
                    failures.Insert("bitcoin");
                    Print("[SenzanyDelivery] BITCOIN MINIMAL ECHEC : creation impossible");
                }

                continue;
            }

            if (quantity > m_Settings.maxQuantityPerItem)
            {
                quantity = m_Settings.maxQuantityPerItem;
            }

            totalRequested += quantity;

            // Closed internal-quantity allowlist: only these seven exact classnames.
            // Bitcoin and bank credit have already used their original branches.
            if (IsInternalQuantityItem(deliveryItem.className))
            {
                EntityAI stackCreated = CreateForPlayer(player, deliveryItem.className, 0);
                ItemBase stackItem = ItemBase.Cast(stackCreated);
                bool stackApplied = false;
                float stackActualQuantity = -1; // Unavailable if creation/cast/quantity support fails.

                if (stackItem && stackItem.HasQuantity())
                {
                    // SetQuantity returns deletion status, NOT delivery success.
                    bool stackDeleted = stackItem.SetQuantity(quantity);
                    if (!stackDeleted && stackItem && !stackItem.IsPrepareToDelete())
                    {
                        stackActualQuantity = stackItem.GetQuantity();
                        stackApplied = stackActualQuantity == quantity;
                    }
                }

                if (stackApplied)
                {
                    totalCreated += quantity;
                    Print("[SenzanyDelivery] STACK OK : " + deliveryItem.className + " x" + quantity.ToString());
                }
                else
                {
                    // Do not leave a partial/default item after a failed stack.
                    if (stackCreated && !stackCreated.IsPrepareToDelete())
                    {
                        GetGame().ObjectDelete(stackCreated);
                    }
                    failures.Insert(deliveryItem.className + " : quantite non appliquee");
                    Print("[SenzanyDelivery] STACK ECHEC : " + deliveryItem.className + " demande=" + quantity.ToString() + " reel=" + stackActualQuantity.ToString());
                }

                continue;
            }

            for (int i = 0; i < quantity; i++)
            {
                EntityAI created = CreateForPlayer(player, deliveryItem.className, i);

                if (created)
                {
                    totalCreated++;
                    Print("[SenzanyDelivery] OBJET CREE : " + deliveryItem.className);
                }
                else
                {
                    failures.Insert(deliveryItem.className);
                    Print("[SenzanyDelivery] OBJET ECHEC : " + deliveryItem.className);
                }
            }
        }

        Print("[SenzanyDelivery] Livraison " + delivery.id + " : " + totalCreated.ToString() + "/" + totalRequested.ToString() + " unite(s) traitee(s)");

        if (totalCreated != totalRequested)
        {
            errorMessage = totalCreated.ToString() + "/" + totalRequested.ToString() + " unite(s) traitees. Echecs : " + JoinFailures(failures);
            return false;
        }

        errorMessage = "";
        return true;
    }

    protected bool IsInternalQuantityItem(string className)
    {
        if (className == "CJ_Materials_CalibrationTools")
            return true;

        if (className == "CJ_Materials_Conden")
            return true;

        if (className == "CJ_Materials_bolts")
            return true;

        if (className == "CJ_Materials_nuts")
            return true;

        if (className == "CJ_Materials_Copper")
            return true;

        if (className == "CJ_Materials_plastic")
            return true;

        if (className == "CJ_Materials_Scrap")
            return true;

        return false;
    }

    protected bool CreditLBmasterBank(PlayerBase player, int amount, out string errorMessage)
    {
        if (!player || !player.GetIdentity())
        {
            errorMessage = "joueur ou identite invalide";
            return false;
        }

        if (amount < 1)
        {
            errorMessage = "montant invalide";
            return false;
        }

        string steamId = player.GetIdentity().GetPlainId();
        string playerName = player.GetIdentity().GetName();

        if (steamId.Length() != 17)
        {
            errorMessage = "SteamID invalide";
            return false;
        }

        string bankFile = "$profile:LBmaster/Data/LBBanking/Players/" + steamId + ".json";

        if (!FileExist(bankFile))
        {
            errorMessage = "compte Enhanced Banking introuvable";
            return false;
        }

        string bankJson;

        if (!ReadTextFile(bankFile, bankJson))
        {
            errorMessage = "fichier Enhanced Banking illisible";
            return false;
        }

        SZD_LBBankingPlayerData bankData = new SZD_LBBankingPlayerData();
        JsonSerializer serializer = new JsonSerializer();
        string jsonError;

        if (!serializer.ReadFromString(bankData, bankJson, jsonError))
        {
            errorMessage = "JSON bancaire invalide : " + jsonError;
            return false;
        }

        if (!bankData || bankData.steamid != steamId)
        {
            errorMessage = "SteamID du compte bancaire incoherent";
            return false;
        }

        int beforeMoney = bankData.currentMoney;

        // Plafond actuel du serveur : 20 000 000 $ + bonus individuel.
        // Valeur issue de LBmaster/Config/LBBanking/ATMConfig.json.
        int maxMoney = 20000000 + bankData.maxMoneyBonus;

        if (beforeMoney < 0)
        {
            errorMessage = "solde bancaire actuel invalide";
            return false;
        }

        if (amount > (maxMoney - beforeMoney))
        {
            errorMessage = "plafond bancaire depasse";
            return false;
        }

        bankData.currentMoney = beforeMoney + amount;
        bankData.playername = playerName;

        string newJson;

        if (!serializer.WriteToString(bankData, true, newJson))
        {
            errorMessage = "serialisation du compte bancaire impossible";
            return false;
        }

        FileHandle file = OpenFile(bankFile, FileMode.WRITE);

        if (file == 0)
        {
            errorMessage = "ecriture du compte bancaire impossible";
            return false;
        }

        FPrint(file, newJson);
        CloseFile(file);

        // Relit immédiatement le fichier avant de confirmer la livraison.
        string verifyJson;

        if (!ReadTextFile(bankFile, verifyJson))
        {
            errorMessage = "verification bancaire impossible";
            return false;
        }

        SZD_LBBankingPlayerData verifyData = new SZD_LBBankingPlayerData();
        string verifyError;

        if (!serializer.ReadFromString(verifyData, verifyJson, verifyError))
        {
            errorMessage = "verification JSON bancaire impossible";
            return false;
        }

        if (!verifyData || verifyData.currentMoney != (beforeMoney + amount))
        {
            errorMessage = "le nouveau solde bancaire n'a pas ete confirme";
            return false;
        }

        string bankLog = "[SenzanyDelivery] LB BANK ";
        bankLog += steamId;
        bankLog += " : ";
        bankLog += beforeMoney.ToString();
        bankLog += " -> ";
        bankLog += verifyData.currentMoney.ToString();
        bankLog += " (+";
        bankLog += amount.ToString();
        bankLog += ")";

        Print(bankLog);

        errorMessage = "";
        return true;
    }

    protected EntityAI CreateForPlayer(PlayerBase player, string className, int index)
    {
        EntityAI item = player.GetInventory().CreateInInventory(className);

        if (item)
        {
            Print("[SenzanyDelivery] OBJET place dans inventaire : " + className);
            return item;
        }

        Print("[SenzanyDelivery] Inventaire plein ou objet incompatible : " + className);

        vector position = player.GetPosition();
        vector direction = player.GetDirection();

        direction.Normalize();

        float distance = m_Settings.groundDropDistance + (index * 0.15);
        position = position + (direction * distance);
        position[1] = GetGame().SurfaceY(position[0], position[2]) + 0.15;

        Object spawnedObject = GetGame().CreateObject(className, position, false, true);
        EntityAI groundItem = EntityAI.Cast(spawnedObject);

        if (groundItem)
        {
            Print("[SenzanyDelivery] OBJET depose au sol : " + className);
        }
        else
        {
            Print("[SenzanyDelivery] ECHEC creation au sol : " + className);
        }

        return groundItem;
    }

    protected string JoinFailures(array<string> failures)
    {
        if (!failures || failures.Count() == 0)
        {
            return "aucun detail";
        }

        string output = "";
        int count = failures.Count();

        if (count > 10)
        {
            count = 10;
        }

        for (int i = 0; i < count; i++)
        {
            if (i > 0)
            {
                output += ", ";
            }

            output += failures.Get(i);
        }

        if (failures.Count() > count)
        {
            output += " (et " + (failures.Count() - count).ToString() + " autres)";
        }

        return output;
    }

    protected void Complete(PlayerBase player, string steamId, SZD_Delivery delivery, bool success, string errorMessage)
    {
        if (!delivery)
        {
            return;
        }

        RestApi restApi = GetRestApi();

        if (!restApi)
        {
            Print("[SenzanyDelivery] COMPLETE ERREUR - GetRestApi a retourne null");
            return;
        }

        RestContext completeContext = restApi.GetRestContext(m_Settings.apiUrl);

        if (!completeContext)
        {
            Print("[SenzanyDelivery] COMPLETE ERREUR - GetRestContext a echoue");
            return;
        }

        SZD_CompleteRequest request = new SZD_CompleteRequest();

        request.deliveryId = delivery.id;
        request.claimToken = delivery.claimToken;
        request.success = success;
        request.errorMessage = errorMessage;
        request.agentKey = m_Settings.apiKey;

        JsonSerializer serializer = new JsonSerializer();
        string payload;

        if (!serializer.WriteToString(request, false, payload))
        {
            Print("[SenzanyDelivery] COMPLETE ERREUR - serialisation impossible pour " + delivery.id);
            return;
        }

        completeContext.SetHeader("application/json");

        Print("[SenzanyDelivery] POST " + m_Settings.apiUrl + "/api/delivery-agent/complete");

        SZD_CompleteCallback callback = new SZD_CompleteCallback(this, player, steamId, delivery.id, success);
        int requestState = completeContext.POST(callback, "/api/delivery-agent/complete", payload);

        Print("[SenzanyDelivery] COMPLETE requete envoyee - livraison : " + delivery.id + " - succes : " + success.ToString() + " - etat initial : " + requestState.ToString());
    }

    void OnCompleteFinished(PlayerBase player, string steamId, bool success, string message)
    {
        RemoveClaimLock(steamId);

        if (!ValidatePlayer(player, steamId)) return;

        if (success)
        {
            SendResult(player, 2, "Livraison recuperee avec succes !");
            CheckForPlayer(player, steamId);
        }
        else
        {
            if (message == "") message = "La livraison n'a pas pu etre confirmee.";
            SendResult(player, 0, message);
        }
    }

    protected bool LoadSettings()
    {
        Print("[SenzanyDelivery] Chargement de settings.json...");

        if (!FileExist(SETTINGS_DIRECTORY))
        {
            MakeDirectory(SETTINGS_DIRECTORY);
        }

        m_Settings = new SZD_Settings();

        if (!FileExist(SETTINGS_FILE))
        {
            if (!SaveDefaultSettings())
            {
                Print("[SenzanyDelivery] ERREUR - impossible de creer settings.json");
                return false;
            }

            Print("[SenzanyDelivery] settings.json cree avec succes");
            Print("[SenzanyDelivery] Configure apiKey puis redemarre le serveur");
            return false;
        }

        string jsonData;

        if (!ReadTextFile(SETTINGS_FILE, jsonData))
        {
            Print("[SenzanyDelivery] ERREUR - settings.json illisible");
            return false;
        }

        JsonSerializer serializer = new JsonSerializer();
        string jsonError;

        if (!serializer.ReadFromString(m_Settings, jsonData, jsonError))
        {
            Print("[SenzanyDelivery] ERREUR - settings.json invalide : " + jsonError);
            return false;
        }

        if (!m_Settings)
        {
            Print("[SenzanyDelivery] ERREUR - configuration absente apres lecture JSON");
            return false;
        }

        if (m_Settings.apiUrl == "")
        {
            Print("[SenzanyDelivery] ERREUR - apiUrl est vide");
            return false;
        }

        if (m_Settings.agentId == "")
        {
            m_Settings.agentId = "senzany-dayz-local";
        }

        if (m_Settings.pollIntervalSeconds < 5)
        {
            m_Settings.pollIntervalSeconds = 30;
        }

        if (m_Settings.maxQuantityPerItem < 1)
        {
            m_Settings.maxQuantityPerItem = 100;
        }

        if (m_Settings.groundDropDistance < 0.5)
        {
            m_Settings.groundDropDistance = 1.5;
        }

        Print("[SenzanyDelivery] settings.json charge avec succes");
        return true;
    }

    protected bool SaveDefaultSettings()
    {
        JsonSerializer serializer = new JsonSerializer();
        string jsonData;

        if (!serializer.WriteToString(m_Settings, true, jsonData))
        {
            return false;
        }

        FileHandle file = OpenFile(SETTINGS_FILE, FileMode.WRITE);

        if (file == 0)
        {
            return false;
        }

        FPrint(file, jsonData);
        CloseFile(file);
        return true;
    }

    protected bool ReadTextFile(string filePath, out string content)
    {
        content = "";

        FileHandle file = OpenFile(filePath, FileMode.READ);

        if (file == 0)
        {
            return false;
        }

        string line;

        while (FGets(file, line) >= 0)
        {
            content += line;
        }

        CloseFile(file);
        return content != "";
    }
};
