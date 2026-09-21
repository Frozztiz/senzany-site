modded class MissionServer
{
    protected ref SZD_DeliveryManager m_SenzanyDeliveryManager;

    void MissionServer()
    {
        m_SenzanyDeliveryManager = new SZD_DeliveryManager();
        GetGame().GetCallQueue(CALL_CATEGORY_SYSTEM).CallLater(SZD_StartDeliveryManager, 5000, false);
    }

    protected void SZD_StartDeliveryManager()
    {
        if (m_SenzanyDeliveryManager) m_SenzanyDeliveryManager.Start();
    }

    override void OnUpdate(float timeslice)
    {
        super.OnUpdate(timeslice);
        if (m_SenzanyDeliveryManager) m_SenzanyDeliveryManager.Update(timeslice);
    }

    void ~MissionServer()
    {
        if (m_SenzanyDeliveryManager) m_SenzanyDeliveryManager.Stop();
    }
};
