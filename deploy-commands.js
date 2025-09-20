const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Wyślij mój specjalny link!'),
  new SlashCommandBuilder()
    .setName('deklaracja')
    .setDescription('Losowo generuje wartości deklaracji paczek'),
  new SlashCommandBuilder()
    .setName('proxy')
    .setDescription('Instrukcje dotyczące zakupu przedmiotów'),
  new SlashCommandBuilder()
    .setName('pomoc')
    .setDescription('Wyświetla listę wszystkich dostępnych komend'),
  new SlashCommandBuilder()
    .setName('weryfikacja')
    .setDescription('Instrukcja weryfikacji konta'),
  new SlashCommandBuilder()
    .setName('kupony')
    .setDescription('Informacje o kuponach')
].map(command => command.toJSON());


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Rejestruję komendy...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Komendy zarejestrowane!');
  } catch (error) {
    console.error(error);
  }
})();
