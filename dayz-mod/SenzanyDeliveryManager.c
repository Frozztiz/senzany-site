class SZD_LBBankingPlayerData
{
    int version = 0;
    string steamid = "";
    string playername = "";
    int currentMoney = 0;
    int maxMoneyBonus = 0;
    int paycheckBonus = 0;
    int ignoreTransferFee = 0;
};

class SZD_DeliveryManager
{
    protected static const string SETTINGS_DIRECTORY = "$profile:SenzanyDelivery";
    protected static const string SETTINGS_FILE = "$profile:SenzanyDelivery/settings.json";

    protected ref SZD_Settings m_Settings;
    protected RestContext m_RestContext;
    protected bool m_IsRunning;
    protected float m_PollTimer;

    void SZD_DeliveryManager()
    {
        Print("[SenzanyDelivery] Manager construit - version 0.8.0-bank-credit");
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

            ClaimForPlayer(player, steamId);
        }
    }

    protected void ClaimForPlayer(PlayerBase player, string steamId)
    {
        RestApi restApi = GetRestApi();

        if (!restApi)
        {
            Print("[SenzanyDelivery] CLAIM ERREUR - GetRestApi a retourne null");
            return;
        }

        m_RestContext = restApi.GetRestContext(m_Settings.apiUrl);

        if (!m_RestContext)
        {
            Print("[SenzanyDelivery] CLAIM ERREUR - GetRestContext a echoue");
            return;
        }

        string body = "{";
        body += "\"steamId\":\"" + steamId + "\",";
        body += "\"agentId\":\"" + m_Settings.agentId + "\",";
        body += "\"agentKey\":\"" + m_Settings.apiKey + "\"";
        body += "}";

        SZD_ClaimCallback callback = new SZD_ClaimCallback(this, player, steamId);

        Print("[SenzanyDelivery] POST " + m_Settings.apiUrl + "/api/delivery-agent/claim");
        Print("[SenzanyDelivery] CLAIM SteamID : " + steamId);

        m_RestContext.SetHeader("application/json");

        int requestState = m_RestContext.POST(callback, "/api/delivery-agent/claim", body);

        Print("[SenzanyDelivery] CLAIM requete envoyee - etat initial : " + requestState.ToString());
    }

    void OnClaimResponse(PlayerBase player, string steamId, string data)
    {
        if (data.IndexOf("\"delivery\":null") != -1)
        {
            Print("[SenzanyDelivery] CLAIM aucune livraison en attente pour " + steamId);
            return;
        }

        if (!player || !player.IsAlive() || !player.GetIdentity())
        {
            Print("[SenzanyDelivery] CLAIM abandon - joueur absent ou mort : " + steamId);
            return;
        }

        if (player.GetIdentity().GetPlainId() != steamId)
        {
            Print("[SenzanyDelivery] CLAIM abandon - SteamID incorrect");
            return;
        }

        SZD_ClaimResponse response = new SZD_ClaimResponse();
        JsonSerializer serializer = new JsonSerializer();
        string jsonError;

        if (!serializer.ReadFromString(response, data, jsonError))
        {
            Print("[SenzanyDelivery] CLAIM JSON invalide : " + jsonError);
            return;
        }

        if (!response.delivery)
        {
            Print("[SenzanyDelivery] CLAIM ATTENTION - aucune livraison exploitable");
            return;
        }

        Print("[SenzanyDelivery] CLAIM livraison recue pour " + steamId);

        string deliveryError;
        bool success = Deliver(player, response.delivery, deliveryError);

        Complete(response.delivery, success, deliveryError);
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

            // Livraison virtuelle : credit direct du compte LBmaster Enhanced Banking.
            // Aucun billet physique n'est cree.
            if (deliveryItem.className == "SenzanyBankCredit")
            {
                totalRequested += quantity;

                string bankError;
                bool bankSuccess = CreditLBmasterBank(player, quantity, bankError);

                if (bankSuccess)
                {
                    totalCreated += quantity;
                    Print("[SenzanyDelivery] BANQUE CREDitee : " + quantity.ToString() + " $ pour " + player.GetIdentity().GetPlainId());
                }
                else
                {
                    failures.Insert("SenzanyBankCredit: " + bankError);
                    Print("[SenzanyDelivery] BANQUE ECHEC : " + bankError);
                }

                continue;
            }

            if (quantity > m_Settings.maxQuantityPerItem)
            {
                quantity = m_Settings.maxQuantityPerItem;
            }

            totalRequested += quantity;

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

        Print("[SenzanyDelivery] Livraison " + delivery.id + " : " + totalCreated.ToString() + "/" + totalRequested.ToString() + " objet(s) cree(s)");

        if (totalCreated != totalRequested)
        {
            errorMessage = totalCreated.ToString() + "/" + totalRequested.ToString() + " objets crees. Echecs : " + JoinFailures(failures);
            return false;
        }

        errorMessage = "";
        return true;
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

        string bankingFile = "$profile:LBmaster/Data/LBBanking/Players/" + steamId + ".json";

        if (!FileExist(bankingFile))
        {
            errorMessage = "compte LBmaster introuvable : " + bankingFile;
            return false;
        }

        SZD_LBBankingPlayerData bankData = new SZD_LBBankingPlayerData();
        JsonFileLoader<SZD_LBBankingPlayerData>.JsonLoadFile(bankingFile, bankData);

        if (!bankData || bankData.steamid == "")
        {
            errorMessage = "fichier bancaire invalide ou illisible";
            return false;
        }

        if (bankData.steamid != steamId)
        {
            errorMessage = "SteamID du compte bancaire incoherent";
            return false;
        }

        int beforeMoney = bankData.currentMoney;
        int maxMoney = 20000000 + bankData.maxMoneyBonus;

        if (beforeMoney < 0)
        {
            beforeMoney = 0;
        }

        if (beforeMoney > maxMoney)
        {
            errorMessage = "solde bancaire actuel superieur au plafond";
            return false;
        }

        if (amount > (maxMoney - beforeMoney))
        {
            errorMessage = "credit impossible : plafond bancaire depasse";
            return false;
        }

        bankData.currentMoney = beforeMoney + amount;
        bankData.playername = playerName;

        JsonFileLoader<SZD_LBBankingPlayerData>.JsonSaveFile(bankingFile, bankData);

        // Verification immediate apres ecriture.
        SZD_LBBankingPlayerData verifyData = new SZD_LBBankingPlayerData();
        JsonFileLoader<SZD_LBBankingPlayerData>.JsonLoadFile(bankingFile, verifyData);

        if (!verifyData || verifyData.currentMoney != (beforeMoney + amount))
        {
            errorMessage = "verification du nouveau solde impossible";
            return false;
        }

        Print(
            "[SenzanyDelivery] LB BANK - "
            + steamId
            + " : "
            + beforeMoney.ToString()
            + " -> "
            + verifyData.currentMoney.ToString()
            + " (+"
            + amount.ToString()
            + ")"
        );

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

    protected void Complete(SZD_Delivery delivery, bool success, string errorMessage)
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

        SZD_CompleteCallback callback = new SZD_CompleteCallback(delivery.id);
        int requestState = completeContext.POST(callback, "/api/delivery-agent/complete", payload);

        Print("[SenzanyDelivery] COMPLETE requete envoyee - livraison : " + delivery.id + " - succes : " + success.ToString() + " - etat initial : " + requestState.ToString());
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
            JsonFileLoader<SZD_Settings>.JsonSaveFile(SETTINGS_FILE, m_Settings);

            Print("[SenzanyDelivery] settings.json cree avec succes");
            Print("[SenzanyDelivery] Configure apiKey puis redemarre le serveur");

            return false;
        }

        JsonFileLoader<SZD_Settings>.JsonLoadFile(SETTINGS_FILE, m_Settings);

        if (!m_Settings)
        {
            Print("[SenzanyDelivery] ERREUR - settings.json invalide ou illisible");
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
};