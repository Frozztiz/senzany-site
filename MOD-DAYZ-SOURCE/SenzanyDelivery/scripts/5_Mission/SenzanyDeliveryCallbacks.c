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
        Print("[SenzanyDelivery] CLAIM ERREUR - SteamID : " + m_SteamId + " - code : " + errorCode.ToString());
    }

    override void OnTimeout()
    {
        Print("[SenzanyDelivery] CLAIM TIMEOUT - SteamID : " + m_SteamId);
    }

    override void OnSuccess(string data, int dataSize)
    {
        Print("[SenzanyDelivery] CLAIM reponse recue - SteamID : " + m_SteamId);
        Print("[SenzanyDelivery] CLAIM taille : " + dataSize.ToString());

        if (m_Manager)
        {
            m_Manager.OnClaimResponse(m_Player, m_SteamId, data);
        }
    }
};

class SZD_CompleteCallback : RestCallback
{
    protected string m_DeliveryId;

    void SZD_CompleteCallback(string deliveryId)
    {
        m_DeliveryId = deliveryId;
    }

    override void OnError(int errorCode)
    {
        Print("[SenzanyDelivery] COMPLETE ERREUR - livraison : " + m_DeliveryId + " - code : " + errorCode.ToString());
    }

    override void OnTimeout()
    {
        Print("[SenzanyDelivery] COMPLETE TIMEOUT - livraison : " + m_DeliveryId);
    }

    override void OnSuccess(string data, int dataSize)
    {
        Print("[SenzanyDelivery] COMPLETE succes - livraison : " + m_DeliveryId);
        Print("[SenzanyDelivery] COMPLETE reponse : " + data);
    }
};
