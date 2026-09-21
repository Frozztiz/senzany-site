// Senzany compatibility fix for CJ_LootChests.
// Prevents a NULL pointer in LootChestsHandler.DeleteChests().

modded class LootChestsHandler
{
    override void AddChestToArray(EntityAI chest)
    {
        if (!chest)
        {
            LCLogger.Debug("[Senzany Fix] Ignored NULL loot chest during registration.");
            return;
        }

        m_ChestsArray.Insert(chest);
        LCLogger.Debug("Lootchest located at position " + chest.GetPosition() + " = Lootchest #" + m_ChestsArray.Count());
    }

    override void DeleteChests()
    {
        if (!m_ChestsArray)
        {
            LCLogger.Debug("[Senzany Fix] Loot chest array was NULL; nothing to delete.");
            return;
        }

        for (int j = 0; j < m_ChestsArray.Count(); j++)
        {
            EntityAI chest = m_ChestsArray.Get(j);

            if (!chest)
            {
                LCLogger.Debug("[Senzany Fix] Ignored NULL loot chest at array index " + j + ".");
                continue;
            }

            LCLogger.Debug("Lootchest at position " + chest.GetPosition() + " was deleted!");
            GetGame().ObjectDelete(chest);
        }

        m_ChestsArray.Clear();
    }
}
