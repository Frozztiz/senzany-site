class DiscordService {
    async getStatus() {
        return {
            online: true,
            message: "Discord Service OK"
        };
    }
}

module.exports = new DiscordService();