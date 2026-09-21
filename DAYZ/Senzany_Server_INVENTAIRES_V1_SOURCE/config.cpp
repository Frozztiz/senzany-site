class CfgPatches
{
    class Senzany_Server
    {
        units[] = {};
        weapons[] = {};
        requiredVersion = 0.1;
        requiredAddons[] = {"DZ_Data", "CJ_LootChests", "LBmaster_Core", "LBmaster_SkinSystem", "LBmaster_SkinSystemServer"};
    };
};

class CfgMods
{
    class Senzany_Server
    {
        dir = "Senzany_Server";
        name = "Senzany Server";
        author = "Senzany";
        version = "1.1.2";
        type = "mod";
        dependencies[] = {"World", "Mission"};

        class defs
        {
            class worldScriptModule
            {
                value = "";
                files[] = {"Senzany_Server/scripts/4_World"};
            };
            class missionScriptModule
            {
                value = "";
                files[] = {"Senzany_Server/scripts/5_Mission"};
            };
        };
    };
};
