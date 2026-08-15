void main()
{
	//INIT ECONOMY--------------------------------------
	Hive ce = CreateHive();
	if ( ce )
		ce.InitOffline();

	//DATE RESET AFTER ECONOMY INIT-------------------------
	int year, month, day, hour, minute;
	int reset_month = 9, reset_day = 20;
	GetGame().GetWorld().GetDate(year, month, day, hour, minute);

	if ((month == reset_month) && (day < reset_day))
	{
		GetGame().GetWorld().SetDate(year, reset_month, reset_day, hour, minute);
	}
	else
	{
		if ((month == reset_month + 1) && (day > reset_day))
		{
			GetGame().GetWorld().SetDate(year, reset_month, reset_day, hour, minute);
		}
		else
		{
			if ((month < reset_month) || (month > reset_month + 1))
			{
				GetGame().GetWorld().SetDate(year, reset_month, reset_day, hour, minute);
			}
		}
	}
}

class SenzanyFlagpoleSyncSettings
{
	string apiUrl = "";
	string agentId = "";
	string apiKey = "";
}

class SenzanyFlagpoleSyncCallback : RestCallback
{
	override void OnError(int errorCode)
	{
		Print("[SENZANY FLAGPOLES] API ERREUR code : " + errorCode.ToString());
	}

	override void OnTimeout()
	{
		Print("[SENZANY FLAGPOLES] API TIMEOUT");
	}

	override void OnSuccess(string data, int dataSize)
	{
		Print("[SENZANY FLAGPOLES] API OK : " + data);
	}
}

class CustomMission: MissionServer
{
	// SENZANY ---------------------------------------------------------
	// V4 : test du hook + export local des TerritoryFlag.
	// Aucun envoi réseau. Aucune modification de la persistence.
	override void OnMissionStart()
	{
		super.OnMissionStart();

		Print("[SENZANY FLAGPOLES] OnMissionStart OK");

		string bootPath = "$profile:Senzany_Flagpoles_BOOT.txt";
		FileHandle bootFile = OpenFile(bootPath, FileMode.WRITE);

		if (bootFile != 0)
		{
			FPrintln(bootFile, "SENZANY FLAGPOLES - OnMissionStart OK");
			CloseFile(bootFile);
		}

		GetGame().GetCallQueue(CALL_CATEGORY_SYSTEM).CallLater(SenzanyExportFlagpoles, 60000, false);
		GetGame().GetCallQueue(CALL_CATEGORY_SYSTEM).CallLater(SenzanyExportFlagpoles, 300000, true);
	}

	void SenzanyExportFlagpoles()
	{
		Print("[SENZANY FLAGPOLES] Debut du scan");

		array<Object> objects = new array<Object>;
		array<CargoBase> proxyCargos = new array<CargoBase>;

		vector center = "7680 0 7680";
		float radius = 12000.0;

		GetGame().GetObjectsAtPosition3D(center, radius, objects, proxyCargos);

		string outputPath = "$profile:Senzany_Flagpoles.csv";
		FileHandle file = OpenFile(outputPath, FileMode.WRITE);

		if (file == 0)
		{
			Print("[SENZANY FLAGPOLES] ERREUR ouverture fichier");
			return;
		}

		FPrintln(file, "type,x,y,z");

		int count = 0;
		string jsonFlagpoles = "[";

		foreach (Object obj : objects)
		{
			if (!obj)
				continue;

			string typeName = obj.GetType();

			if (typeName != "TerritoryFlag")
				continue;

			vector pos = obj.GetPosition();
			string csvLine = string.Format("%1,%2,%3,%4", typeName, pos[0], pos[1], pos[2]);
			FPrintln(file, csvLine);

			if (count > 0)
				jsonFlagpoles += ",";

			jsonFlagpoles += string.Format("{\"type\":\"%1\",\"x\":%2,\"y\":%3,\"z\":%4}", typeName, pos[0], pos[1], pos[2]);
			count++;
		}

		CloseFile(file);
		jsonFlagpoles += "]";

		SenzanySendFlagpolesToApi(jsonFlagpoles, count);

		string doneLine = string.Format("[SENZANY FLAGPOLES] Export termine : %1 mat(s)", count);
		Print(doneLine);
	}

	void SenzanySendFlagpolesToApi(string jsonFlagpoles, int count)
	{
		string settingsPath = "$profile:SenzanyDelivery/settings.json";

		if (!FileExist(settingsPath))
		{
			Print("[SENZANY FLAGPOLES] API ignoree : settings SenzanyDelivery introuvable");
			return;
		}

		SenzanyFlagpoleSyncSettings settings = new SenzanyFlagpoleSyncSettings();
		JsonFileLoader<SenzanyFlagpoleSyncSettings>.JsonLoadFile(settingsPath, settings);

		if (!settings || settings.apiUrl == "" || settings.apiKey == "")
		{
			Print("[SENZANY FLAGPOLES] API ignoree : configuration incomplete");
			return;
		}

		RestApi restApi = GetRestApi();
		if (!restApi)
		{
			Print("[SENZANY FLAGPOLES] API ERREUR : GetRestApi null");
			return;
		}

		RestContext context = restApi.GetRestContext(settings.apiUrl);
		if (!context)
		{
			Print("[SENZANY FLAGPOLES] API ERREUR : GetRestContext null");
			return;
		}

		context.SetHeader("application/json");

		string body = "{";
		body += "\"agentId\":\"" + settings.agentId + "\",";
		body += "\"agentKey\":\"" + settings.apiKey + "\",";
		body += "\"flagpoles\":" + jsonFlagpoles;
		body += "}";

		SenzanyFlagpoleSyncCallback callback = new SenzanyFlagpoleSyncCallback();
		int requestState = context.POST(callback, "/api/delivery-agent/flagpoles", body);

		Print("[SENZANY FLAGPOLES] API envoi : " + count.ToString() + " mat(s) - etat " + requestState.ToString());
	}

	// ----------------------------------------------------------------
	void SetRandomHealth(EntityAI itemEnt)
	{
		if ( itemEnt )
		{
			float rndHlt = Math.RandomFloat( 0.45, 0.65 );
			itemEnt.SetHealth01( "", "", rndHlt );
		}
	}

	override PlayerBase CreateCharacter(PlayerIdentity identity, vector pos, ParamsReadContext ctx, string characterName)
	{
		Entity playerEnt;
		playerEnt = GetGame().CreatePlayer( identity, characterName, pos, 0, "NONE" );
		Class.CastTo( m_player, playerEnt );

		GetGame().SelectPlayer( identity, m_player );

		return m_player;
	}

	override void StartingEquipSetup(PlayerBase player, bool clothesChosen)
	{
		EntityAI itemClothing;
		EntityAI itemEnt;
		ItemBase itemBs;
		float rand;

		itemClothing = player.FindAttachmentBySlotName( "Body" );
		if ( itemClothing )
		{
			SetRandomHealth( itemClothing );
			
			itemEnt = itemClothing.GetInventory().CreateInInventory( "BandageDressing" );
			player.SetQuickBarEntityShortcut(itemEnt, 2);
			
			string chemlightArray[] = { "Chemlight_White", "Chemlight_Yellow", "Chemlight_Green", "Chemlight_Red" };
			int rndIndex = Math.RandomInt( 0, 4 );
			itemEnt = itemClothing.GetInventory().CreateInInventory( chemlightArray[rndIndex] );
			SetRandomHealth( itemEnt );
			player.SetQuickBarEntityShortcut(itemEnt, 1);

			rand = Math.RandomFloatInclusive( 0.0, 1.0 );
			if ( rand < 0.35 )
				itemEnt = player.GetInventory().CreateInInventory( "Apple" );
			else if ( rand > 0.65 )
				itemEnt = player.GetInventory().CreateInInventory( "Pear" );
			else
				itemEnt = player.GetInventory().CreateInInventory( "Plum" );
			player.SetQuickBarEntityShortcut(itemEnt, 3);
			SetRandomHealth( itemEnt );
		}
		
		itemClothing = player.FindAttachmentBySlotName( "Legs" );
		if ( itemClothing )
			SetRandomHealth( itemClothing );
		
		itemClothing = player.FindAttachmentBySlotName( "Feet" );
	}
};

Mission CreateCustomMission(string path)
{
	return new CustomMission();
}