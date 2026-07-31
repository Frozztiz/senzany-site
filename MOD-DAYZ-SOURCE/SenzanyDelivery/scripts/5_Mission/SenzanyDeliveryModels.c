class SZD_Settings
{
    string apiUrl = "http://213.32.88.222";
    string apiKey = "CHANGE_ME";
    string agentId = "senzany-dayz-officiel-01";
    int pollIntervalSeconds = 30;
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
