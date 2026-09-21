class SZD_CheckCallback : RestCallback
{
    protected ref SZD_DeliveryManager m_Manager;
    protected PlayerBase m_Player;
    protected string m_SteamId;

    void SZD_CheckCallback(SZD_DeliveryManager manager, PlayerBase player, string steamId)
    {
        m_Manager = manager;
        m_Player = player;
        m_SteamId = steamId;
    }

    override void OnError(int errorCode)
    {
        Print("[SenzanyDelivery][CHECK] Erreur HTTP " + errorCode.ToString() + " pour " + m_SteamId);
    }

    override void OnTimeout()
    {
        Print("[SenzanyDelivery][CHECK] Timeout pour " + m_SteamId);
    }

    override void OnSuccess(string data, int dataSize)
    {
        if (m_Manager) m_Manager.OnCheckResponse(m_Player, m_SteamId, data);
    }
};

class SZD_ClaimCallback : RestCallback
{
    protected ref SZD_DeliveryManager m_Manager;
    protected PlayerBase m_Player;
    protected string m_SteamId;

    void SZD_ClaimCallback(SZD_DeliveryManager manager, PlayerBase player, string steamId)
    {
        m_Manager = manager;
        m_Player = player;
        m_SteamId = steamId;
    }

    override void OnError(int errorCode)
    {
        if (m_Manager) m_Manager.OnClaimTransportFailure(m_Player, m_SteamId, "Erreur de communication avec le service de livraison.");
    }

    override void OnTimeout()
    {
        if (m_Manager) m_Manager.OnClaimTransportFailure(m_Player, m_SteamId, "Le service de livraison ne repond pas.");
    }

    override void OnSuccess(string data, int dataSize)
    {
        if (m_Manager) m_Manager.OnClaimResponse(m_Player, m_SteamId, data);
    }
};

class SZD_CompleteCallback : RestCallback
{
    protected ref SZD_DeliveryManager m_Manager;
    protected PlayerBase m_Player;
    protected string m_SteamId;
    protected string m_DeliveryId;
    protected bool m_DeliverySuccess;

    void SZD_CompleteCallback(SZD_DeliveryManager manager, PlayerBase player, string steamId, string deliveryId, bool deliverySuccess)
    {
        m_Manager = manager;
        m_Player = player;
        m_SteamId = steamId;
        m_DeliveryId = deliveryId;
        m_DeliverySuccess = deliverySuccess;
    }

    override void OnError(int errorCode)
    {
        if (m_Manager) m_Manager.OnCompleteFinished(m_Player, m_SteamId, false, "La confirmation de livraison a echoue.");
    }

    override void OnTimeout()
    {
        if (m_Manager) m_Manager.OnCompleteFinished(m_Player, m_SteamId, false, "La confirmation de livraison a expire.");
    }

    override void OnSuccess(string data, int dataSize)
    {
        if (m_Manager) m_Manager.OnCompleteFinished(m_Player, m_SteamId, m_DeliverySuccess, "");
    }
};

class SZD_SkinPollCallback : RestCallback
{
    protected ref SZD_DeliveryManager m_Manager;

    void SZD_SkinPollCallback(SZD_DeliveryManager manager)
    {
        m_Manager = manager;
    }

    override void OnError(int errorCode)
    {
        if (m_Manager) m_Manager.OnSkinPollFailure("HTTP " + errorCode.ToString());
    }

    override void OnTimeout()
    {
        if (m_Manager) m_Manager.OnSkinPollFailure("timeout");
    }

    override void OnSuccess(string data, int dataSize)
    {
        if (m_Manager) m_Manager.OnSkinPollResponse(data);
    }
};

class SZD_SkinCompleteCallback : RestCallback
{
    protected ref SZD_DeliveryManager m_Manager;
    protected string m_ClaimId;
    protected string m_Result;

    void SZD_SkinCompleteCallback(SZD_DeliveryManager manager, string claimId, string result)
    {
        m_Manager = manager;
        m_ClaimId = claimId;
        m_Result = result;
    }

    override void OnError(int errorCode)
    {
        if (m_Manager) m_Manager.OnSkinCompleteFailure(m_ClaimId, "HTTP " + errorCode.ToString());
    }

    override void OnTimeout()
    {
        if (m_Manager) m_Manager.OnSkinCompleteFailure(m_ClaimId, "timeout");
    }

    override void OnSuccess(string data, int dataSize)
    {
        if (m_Manager) m_Manager.OnSkinCompleteResponse(m_ClaimId, m_Result, data);
    }
};


class SZD_InventorySnapshotCallback : RestCallback
{
    protected string m_SteamId;

    void SZD_InventorySnapshotCallback(string steamId)
    {
        m_SteamId = steamId;
    }

    override void OnError(int errorCode)
    {
        Print("[SenzanyInventory] HTTP " + errorCode.ToString() + " pour " + m_SteamId);
    }

    override void OnTimeout()
    {
        Print("[SenzanyInventory] Timeout pour " + m_SteamId);
    }

    override void OnSuccess(string data, int dataSize)
    {
        Print("[SenzanyInventory] Snapshot accepte pour " + m_SteamId);
    }
};
