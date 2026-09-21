modded class PlayerBase
{
    override void OnRPC(PlayerIdentity sender, int rpc_type, ParamsReadContext ctx)
    {
        super.OnRPC(sender, rpc_type, ctx);

        if (!GetGame().IsServer() || rpc_type != 742101)
            return;

        if (!sender || !GetIdentity())
            return;

        if (sender.GetPlainId() != GetIdentity().GetPlainId())
        {
            Print("[SenzanyDelivery][SECURITY] RPC CLAIM refuse : identite incoherente");
            return;
        }

        SZD_DeliveryManager manager = SZD_DeliveryManager.GetInstance();
        if (manager)
            manager.RequestClaimForPlayer(this, sender);
    }
};
