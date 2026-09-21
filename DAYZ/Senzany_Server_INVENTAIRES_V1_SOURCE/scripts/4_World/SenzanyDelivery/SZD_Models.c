
class SZD_LBBankingPlayerData
{
    int version;
    string steamid;
    string playername;
    int currentMoney;
    int maxMoneyBonus;
    int paycheckBonus;
    int ignoreTransferFee;
};

class SZD_Settings
{
    string apiUrl = "http://213.32.88.222";
    string apiKey = "CHANGE_ME";
    string agentId = "senzany-dayz-test";
    int pollIntervalSeconds = 20;
    int maxQuantityPerItem = 100;
    float groundDropDistance = 1.5;
};

class SZD_CompleteRequest
{
    string deliveryId;
    string claimToken;
    bool success;
    string errorMessage;
    string agentKey;
};

class SZD_DeliveryItem
{
    string id;
    string className;
    string name;
    int quantity;
};

class SZD_Delivery
{
    string id;
    string steamId;
    string playerName;
    string title;
    string message;
    string status;
    string claimToken;
    ref array<ref SZD_DeliveryItem> items;
};

class SZD_ClaimResponse
{
    ref SZD_Delivery delivery;
};

class SZD_CheckResponse
{
    bool available;
    int count;
};

class SZD_SkinGrant
{
    string claimId;
    string claimToken;
    string steamId;
    string permission;
};

class SZD_SkinPollResponse
{
    bool success;
    ref SZD_SkinGrant grant;
};

class SZD_SkinCompleteRequest
{
    string AgentKey;
    string AgentId;
    string ClaimId;
    string ClaimToken;
    string Result;
    int LBmasterCode;
};


class SZD_InventoryItemSnapshot
{
    string className;
    string displayName;
    int quantity;
    float healthPercent;
};

class SZD_InventorySnapshotRequest
{
    string steamId;
    string playerName;
    string agentId;
    string agentKey;
    ref array<ref SZD_InventoryItemSnapshot> items;
};
