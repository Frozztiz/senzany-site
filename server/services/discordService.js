class DiscordService {
    async getStatus() {
        return {
            online: true,
            message: "Discord Service OK"
        };
    }

    async getStats() {
        const token = process.env.DISCORD_BOT_TOKEN;
        const guildId = process.env.DISCORD_GUILD_ID;

        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
            {
                headers: {
                    Authorization: `Bot ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Discord API : ${response.status}`);
        }

        const guild = await response.json();

        return {
            online: true,
            guildName: guild.name,
            members: guild.approximate_member_count,
            onlineMembers: guild.approximate_presence_count,
            icon: guild.icon
        };
    }
}

module.exports = new DiscordService();