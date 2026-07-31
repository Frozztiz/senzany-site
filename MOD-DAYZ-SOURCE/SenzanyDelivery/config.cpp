class CfgPatches
{
    class SenzanyDelivery
    {
        units[] = {};
        weapons[] = {};
        requiredVersion = 0.1;
        requiredAddons[] = {"DZ_Data", "DZ_Scripts"};
    };
};

class CfgMods
{
    class SenzanyDelivery
    {
        dir = "SenzanyDelivery";
        name = "Senzany Delivery";
        author = "Senzany";
        version = "0.6.0";
        type = "mod";
        dependencies[] = {"Mission"};

        class defs
        {
            class missionScriptModule
            {
                value = "";
                files[] = {"SenzanyDelivery/scripts/5_Mission"};
            };
        };
    };
};
