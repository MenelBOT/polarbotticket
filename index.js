// 📦 Importy
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
require("dotenv").config();

// 🧠 Inicjalizacja klienta Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

const CONVERTER_CHANNEL = "1326124812766281738";
const AI_METODA_CHANNEL = "1209239062159032382"; // <- Ustaw tutaj ID kanału docelowego
const FAKTURA_CHANNEL = "1302935312481259611";
const HELP_CHANNEL_ID = "1367143933544501330"; // Kanał do systemu ticketów
const LOGS_CHANNEL_ID = "1367095099330269306"; // Kanał do logów

// 🔁 Konwersja linku z KakoBuy
function convertKakoBuyLink(text) {
  const taobaoMatch = text.match(/id%3D(\d+)/);
  if (taobaoMatch) {
    const id = taobaoMatch[1];
    return convertGenericLink("taobao", id);
  }

  const weidianMatch = text.match(/itemID%3D(\d+)/);
  if (weidianMatch) {
    const id = weidianMatch[1];
    return convertGenericLink("weidian", id);
  }

  const aliMatch = text.match(/offer%2F(\d+)\.html/);
  if (aliMatch) {
    const id = aliMatch[1];
    return convertGenericLink("1688", id);
  }

  return null;
}

// 🔁 Konwersja linku z CNFans
function convertCNFansLink(text) {
  const taobaoMatch = text.match(/id=(\d+)&platform=TAOBAO/);
  if (taobaoMatch) {
    return convertGenericLink("taobao", taobaoMatch[1]);
  }

  const weidianMatch = text.match(/id=(\d+)&platform=WEIDIAN/);
  if (weidianMatch) {
    return convertGenericLink("weidian", weidianMatch[1]);
  }

  const aliMatch = text.match(/id=(\d+)&platform=ALI_1688/);
  if (aliMatch) {
    return convertGenericLink("1688", aliMatch[1]);
  }

  return null;
}

// 🔁 Konwersja uniwersalna
function convertGenericLink(platform, id) {
  let shop = "";
  let image = "";

  switch (platform) {
    case "taobao":
      shop = `https://item.taobao.com/item.htm?id=${id}`;
      image = `https://img01.taobaocdn.com/bao/uploaded/${id}_560x560.jpg`;
      break;
    case "weidian":
      shop = `https://weidian.com/item.html?itemID=${id}`;
      image = `https://cdn.weidian.com/item/img/${id}.jpg`;
      break;
    case "1688":
      shop = `https://detail.1688.com/offer/${id}.html`;
      image = `https://cbu01.alicdn.com/img/ibank/${id}.jpg`;
      break;
  }

  return {
    platform,
    id,
    shop,
    image,
    qc: `https://finds.ly/product/${platform}/${id}`,
    hoobuy: `https://hoobuy.com/product/${platform === "weidian" ? 2 : 1}/${id}`,
  };
}

// ✅ Bot gotowy
client.once("ready", async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

// 📨 Obsługa wiadomości
client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channelId !== CONVERTER_CHANNEL) return;

  const content = message.content;
  let converted = null;

  if (content.includes("kakobuy.com")) {
    converted = convertKakoBuyLink(content);
  } else if (content.includes("cnfans.com")) {
    converted = convertCNFansLink(content);
  } else {
    const taobaoMatch = content.match(/item\.taobao\.com\/item\.htm\?id=(\d+)/);
    const weidianMatch = content.match(
      /weidian\.com\/item\.html\?itemID=(\d+)/,
    );
    const aliMatch = content.match(/detail\.1688\.com\/offer\/(\d+)\.html/);

    if (taobaoMatch) {
      converted = convertGenericLink("taobao", taobaoMatch[1]);
    } else if (weidianMatch) {
      converted = convertGenericLink("weidian", weidianMatch[1]);
    } else if (aliMatch) {
      converted = convertGenericLink("1688", aliMatch[1]);
    }
  }

  if (!converted) return;

  const platformEmojis = {
    taobao: { name: "taobao", id: "1371761509352472707" },
    weidian: { name: "wedian", id: "1371761547654860831" },
    1688: { name: "1688", id: "1371944607251955762" },
    hoobuy: { name: "hoobuy", id: "1371761528742608928" },
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Sklep")
      .setStyle(ButtonStyle.Link)
      .setURL(converted.shop)
      .setEmoji(platformEmojis[converted.platform]),
    new ButtonBuilder()
      .setLabel("QC (Findsly)")
      .setStyle(ButtonStyle.Link)
      .setURL(converted.qc)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setLabel("Hoobuy")
      .setStyle(ButtonStyle.Link)
      .setURL(converted.hoobuy)
      .setEmoji(platformEmojis.hoobuy),
  );

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`🔄 Link z ${converted.platform.toUpperCase()}`)
    .setDescription("Poniżej znajdziesz przekształcone linki do produktu.")
    .setThumbnail(converted.image)
    .addFields(
      { name: "🛒 Sklep", value: `[Kliknij tutaj](${converted.shop})` },
      { name: "📸 QC (Findsly)", value: `[Kliknij tutaj](${converted.qc})` },
      { name: "🧾 Hoobuy", value: `[Kliknij tutaj](${converted.hoobuy})` },
    )
    .setFooter({ text: "Link przetworzony automatycznie" });

  await message.reply({ embeds: [embed], components: [row] });
});

client.on("interactionCreate", async (interaction) => {
  // Obsługa modali
  if (interaction.isModalSubmit() && interaction.customId === 'close_ticket_modal') {
    await handleCloseTicketModal(interaction);
    return;
  }

  // Obsługa tworzenia ticketów
  if (interaction.isButton() && interaction.customId.startsWith('create_ticket_')) {
    const category = interaction.customId.replace('create_ticket_', '');
    await createTicket(interaction, category);
    return;
  }

  // Obsługa menu wyboru kategorii
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
    const category = interaction.values[0];
    await createTicket(interaction, category);
    return;
  }

  // Obsługa zamykania ticketów
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await closeTicket(interaction);
    return;
  }

  // Obsługa przejmowania ticketów
  if (interaction.isButton() && interaction.customId === 'claim_ticket') {
    await claimTicket(interaction);
    return;
  }

  // Obsługa oznaczania jako ważne
  if (interaction.isButton() && interaction.customId === 'mark_important') {
    await markAsImportant(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "link") {
    const embed = {
      color: 0x0099ff,
      title: "🎁 Odbierz swój kupon!",
      description:
        "Zarejestruj się z tego linku, aby odebrać kupon o wartości 113zł na dostawę!",
      fields: [
        {
          name: "🔗 Link referencyjny",
          value:
            "https://hoobuy.com/?utm_source=website&utm_medium=ambassador&utm_campaign=linksharing&inviteCode=w8o7md48",
        },
      ],
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "deklaracja") {
    function losuj(min, max) {
      return (Math.random() * (max - min) + min).toFixed(2);
    }

    const waga12 = losuj(10, 20);
    const waga35 = losuj(20, 40);
    const waga57 = losuj(40, 55);
    const waga810 = losuj(50, 65);

    const embed = {
      color: 0x00ff00,
      title: "📦 Wartości deklaracji",
      fields: [
        { name: "1-2 kg", value: `$${waga12}`, inline: true },
        { name: "3-5 kg", value: `$${waga35}`, inline: true },
        { name: "5-7 kg", value: `$${waga57}`, inline: true },
        { name: "8-10 kg", value: `$${waga810}`, inline: true },
      ],
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "proxy") {
    const embed = {
      color: 0xff9900,
      title: "🛍️ Usługa Proxy",
      description:
        "Cześć! 👋 Jeśli chcesz, abym zakupił dla Ciebie jakiś przedmiot ✨, utwórz ticket w odpowiednim kanale 📝",
      fields: [
        {
          name: "💰 Całkowita cena zamówienia",
          value: "WARTOŚĆ PRODUKTU + 15ZŁ ZA DOSTAWĘ 📦",
        },
        {
          name: "🤝 Wsparcie",
          value: "Pomogę Ci z realizacją zamówienia! 🎫",
        },
      ],
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "pomoc") {
    const embed = {
      color: 0x9900ff,
      title: "📋 Lista dostępnych komend",
      fields: [
        {
          name: "🔗 /link",
          value: "Wysyła specjalny link referencyjny",
          inline: true,
        },
        {
          name: "📦 /deklaracja",
          value: "Generuje wartości deklaracji paczek",
          inline: true,
        },
        {
          name: "🛍️ /proxy",
          value: "Informacje o zakupie przedmiotów",
          inline: true,
        },
        { name: "❓ /pomoc", value: "Wyświetla tę listę komend", inline: true },
      ],
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "drogadostawa") {
    const embed = {
      color: 0xffd700,
      title: "💸 Dlaczego twoja dostawa jest tak droga?",
      description:
        "**- Prawdopodobnie została źle policzona dostawa!**\n\n" +
        "**Co powinieneś zrobić? (preferowana opcja)**\n" +
        "📦 Najlepiej opłać przesyłkę i poczekaj aż ją wyślą — wtedy waga oraz objętość zostanie policzona poprawnie,\n" +
        "a **nadpłata zostanie Ci zwrócona**.\n\n" +
        "**Lub**\n" +
        "🎧 Stwórz ticket na stronie → **Send us a message → Shipping cost optimization**",
      footer: {
        text: "Komenda informacyjna o drogich dostawach",
      },
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "weryfikacja") {
    // Sprawdź czy użytkownik ma odpowiednią rolę
    if (!interaction.member.roles.cache.has('1367097320776142849')) {
      return await interaction.reply({ 
        content: '❌ Nie masz uprawnień do używania tej komendy!', 
        ephemeral: true 
      });
    }

    const embed = {
      color: 0x00ff00,
      title: "✅ Weryfikacja konta",
      description: "Podaj dwie pierwsze litery maila oraz nicku, data powstania KONTA! w celu weryfikacji konta.\n\nJeżeli nie masz konta z refilniku użyj `/link`",
      footer: {
        text: "Proces weryfikacji konta",
      },
    };
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === "kupony") {
    // Sprawdź czy użytkownik ma odpowiednią rolę
    if (!interaction.member.roles.cache.has('1367097320776142849')) {
      return await interaction.reply({ 
        content: '❌ Nie masz uprawnień do używania tej komendy!', 
        ephemeral: true 
      });
    }

    const embed = {
      color: 0xff6600,
      title: "🎟️ Status kuponów",
      description: "Obecnie kupony nie są dostępne, prawdopodobnie będziemy mieć je od piątku. Proszę o zamknięcie ticketa.",
      footer: {
        text: "Informacje o kuponach",
      },
    };
    await interaction.reply({ embeds: [embed] });
  }
});


// System ticketów
client.once("ready", async () => {
  try {
    const ticketChannel = await client.channels.fetch(HELP_CHANNEL_ID);
    if (!ticketChannel || !ticketChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("🎫 System Ticketów")
      .setDescription(
        "**Wybierz kategorię wsparcia:**\n\n" +
        "🌐 **Proxy** - Pomoc z zamawianiem przedmiotów\n" +
        "🛒 **Zakup** - Zakup produktów i usług\n" +
        "❓ **Pomoc** - Ogólne wsparcie techniczne\n" +
        "🎟️ **Kupony** - Pytania o kupony i promocje\n\n" +
        "**Kliknij przycisk poniżej, aby utworzyć ticket!**"
      )
      .setFooter({ text: "Wsparcie 24/7 • Szybka odpowiedź" })
      .setTimestamp();

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('ticket_category')
      .setPlaceholder('Wybierz kategorię ticketu')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Proxy')
          .setDescription('Pomoc z zamawianiem przedmiotów')
          .setValue('proxy')
          .setEmoji('🌐'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Zakup')
          .setDescription('Zakup produktów i usług')
          .setValue('zakup')
          .setEmoji('🛒'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Pomoc')
          .setDescription('Ogólne wsparcie techniczne')
          .setValue('pomoc')
          .setEmoji('❓'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Kupony')
          .setDescription('Pytania o kupony i promocje')
          .setValue('kupony')
          .setEmoji('🎟️')
      );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_proxy')
        .setLabel('Proxy')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setCustomId('create_ticket_zakup')
        .setLabel('Zakup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒'),
      new ButtonBuilder()
        .setCustomId('create_ticket_pomoc')
        .setLabel('Pomoc')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓'),
      new ButtonBuilder()
        .setCustomId('create_ticket_kupony')
        .setLabel('Kupony')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎟️')
    );

    const selectRow = new ActionRowBuilder().addComponents(categorySelect);

    await ticketChannel.send({ 
      embeds: [embed], 
      components: [buttonRow, selectRow] 
    });
    console.log("📨 System ticketów został uruchomiony.");
  } catch (error) {
    console.error("❌ Błąd przy tworzeniu systemu ticketów:", error);
  }
});


// ID kanału do monitorowania
const monitoredChannelId = "1326987823823323208";

// Funkcja generowania następnego numeru ticketu
function getNextTicketNumber(guild) {
  const ticketChannels = guild.channels.cache.filter(channel => 
    /^\d{4}-/.test(channel.name)
  );
  
  const numbers = ticketChannels.map(channel => {
    const match = channel.name.match(/^(\d{4})-/);
    return match ? parseInt(match[1], 10) : 0;
  });
  
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNumber = maxNumber + 1;
  
  // Formatuj jako 4-cyfrowy numer z zerami na początku
  return nextNumber.toString().padStart(4, '0');
}

// Funkcja tworzenia ticketu
async function createTicket(interaction, category) {
  try {
    const guild = interaction.guild;
    const user = interaction.user;

    // Sprawdź czy użytkownik już ma otwarty ticket
    const existingChannel = guild.channels.cache.find(channel => 
      channel.name.includes(`${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${category}`)
    );

    if (existingChannel) {
      return await interaction.reply({ 
        content: '❌ Masz już otwarty ticket w tej kategorii!', 
        ephemeral: true 
      });
    }

    // Różne kategorie dla różnych typów ticketów
    const categoryChannels = {
      proxy: "1389316630903001098",     // Kategoria dla proxy
      zakup: "1389316697156096040",     // Kategoria dla zakupów  
      pomoc: "1389316769436401734",     // Kategoria dla pomocy
      kupony: "1389316769436401734"     // Kategoria dla kuponów
    };

    const TICKET_CATEGORY_ID = categoryChannels[category];

    // Wygeneruj następny numer ticketu
    const ticketNumber = getNextTicketNumber(guild);

    const ticketChannel = await guild.channels.create({
      name: `${ticketNumber}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${category}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID, // Kategoria kanałów
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        // Dodaj uprawnienia dla różnych ról w zależności od kategorii
        ...getPermissionsForCategory(category)
      ],
    });

    const categoryEmojis = {
      proxy: '🌐',
      zakup: '🛒', 
      pomoc: '❓',
      kupony: '🎟️'
    };

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`${categoryEmojis[category]} Ticket - ${category.toUpperCase()}`)
      .setDescription(
        `Witaj ${user}!\n\n` +
        `**Kategoria:** ${category}\n` +
        `**Status:** 🟢 Otwarty\n\n` +
        `Opisz swój problem lub pytanie, a nasz zespół pomoże Ci tak szybko, jak to możliwe!\n\n` +
        `⏰ **Średni czas odpowiedzi:** 5-15 minut`
      )
      .setFooter({ text: `Ticket utworzony przez ${user.tag}` })
      .setTimestamp();

    const ticketButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel('Przejmij Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✋'),
      new ButtonBuilder()
        .setCustomId('mark_important')
        .setLabel('Ustaw jako ważne')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Zamknij Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await ticketChannel.send({ 
      content: `${user}`, 
      embeds: [embed], 
      components: [ticketButtons] 
    });

    // Wyślij log o utworzeniu ticketu
    await logTicketAction('create', user, ticketChannel, category);

    await interaction.reply({ 
      content: `✅ Ticket został utworzony: ${ticketChannel}`, 
      ephemeral: true 
    });

  } catch (error) {
    console.error('Błąd podczas tworzenia ticketu:', error);
    await interaction.reply({ 
      content: '❌ Wystąpił błąd podczas tworzenia ticketu!', 
      ephemeral: true 
    });
  }
}

// Funkcja definiująca uprawnienia dla różnych kategorii
function getPermissionsForCategory(category) {
  let allowedRoles = [];

  switch (category) {
    case 'zakup':
      allowedRoles = [
        { id: "1209094570487320576", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: "1328654895431028817", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];
      break;
    case 'kupony':
    case 'pomoc':
      allowedRoles = [
        { id: "1367097320776142849", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: "1209094570487320576", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: "1328654895431028817", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];
      break;
    case 'proxy':
      allowedRoles = [
        { id: "1367097320776142849", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];
      break;
    default:
      allowedRoles = [];
  }

  // Dodaj uprawnienia dla roli administratora we wszystkich kategoriach
  allowedRoles.push({
    id: "1367097320776142849", // ID roli administratora
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels
    ]
  });

  return allowedRoles;
}

// Funkcja przejmowania ticketu
async function claimTicket(interaction) {
  try {
    const channel = interaction.channel;
    const staff = interaction.user;

    // Sprawdź czy użytkownik ma odpowiednie uprawnienia (rola administratora)
    if (!interaction.member.roles.cache.has('1367097320776142849')) {
      return await interaction.reply({ 
        content: '❌ Nie masz uprawnień do przejmowania ticketów!', 
        ephemeral: true 
      });
    }

    if (!/^\d{4}-/.test(channel.name)) {
      return await interaction.reply({ 
        content: '❌ To nie jest kanał ticketu!', 
        ephemeral: true 
      });
    }

    // Sprawdź czy ticket nie jest już przejęty
    const messages = await channel.messages.fetch({ limit: 100 });
    const claimMessage = messages.find(msg => 
      msg.embeds.length > 0 && 
      msg.embeds[0].title && 
      msg.embeds[0].title.includes('przejął ticket')
    );

    if (claimMessage) {
      return await interaction.reply({ 
        content: '❌ Ten ticket jest już przejęty!', 
        ephemeral: true 
      });
    }

    const claimEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('✋ Ticket przejęty')
      .setDescription(
        `**Pracownik:** ${staff}\n` +
        `**Czas przejęcia:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
        `🟡 **Status:** Obsługiwany`
      )
      .setFooter({ text: `Przejęty przez ${staff.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [claimEmbed] });

    // Dodaj pracownika do uprawnień kanału
    await channel.permissionOverwrites.edit(staff.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true
    });

    // Wyślij log o przejęciu ticketu
    await logTicketAction('claim', staff, channel);

  } catch (error) {
    console.error('Błąd podczas przejmowania ticketu:', error);
    await interaction.reply({ 
      content: '❌ Wystąpił błąd podczas przejmowania ticketu!', 
      ephemeral: true 
    });
  }
}

// Funkcja logowania akcji ticketów
async function logTicketAction(action, user, channel, category = null) {
  try {
    const guild = channel.guild;
    const logChannel = await guild.channels.fetch(LOGS_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;

    const actionEmojis = {
      create: '🎫',
      claim: '✋', 
      close: '🔒',
      important: '⭐'
    };

    const actionNames = {
      create: 'Utworzony',
      claim: 'Przejęty',
      close: 'Zamknięty',
      important: 'Oznaczony jako ważny'
    };

    const actionColors = {
      create: 0x00ff00,
      claim: 0xffa500,
      close: 0xff0000,
      important: 0xffd700
    };

    const embed = new EmbedBuilder()
      .setColor(actionColors[action])
      .setTitle(`${actionEmojis[action]} Ticket ${actionNames[action]}`)
      .addFields(
        { name: '👤 Użytkownik', value: `${user} (${user.tag})`, inline: true },
        { name: '📍 Kanał', value: `${channel}`, inline: true },
        { name: '🕐 Czas', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    if (category) {
      embed.addFields({ name: '📂 Kategoria', value: category, inline: true });
    }

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Błąd podczas logowania:', error);
  }
}

// Funkcja logowania akcji ticketów z powodem
async function logTicketActionWithReason(action, user, channel, reason = null) {
  try {
    const guild = channel.guild;
    const logChannel = await guild.channels.fetch(LOGS_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;

    const actionEmojis = {
      create: '🎫',
      claim: '✋', 
      close: '🔒',
      important: '⭐'
    };

    const actionNames = {
      create: 'Utworzony',
      claim: 'Przejęty',
      close: 'Zamknięty',
      important: 'Oznaczony jako ważny'
    };

    const actionColors = {
      create: 0x00ff00,
      claim: 0xffa500,
      close: 0xff0000,
      important: 0xffd700
    };

    const embed = new EmbedBuilder()
      .setColor(actionColors[action])
      .setTitle(`${actionEmojis[action]} Ticket ${actionNames[action]}`)
      .addFields(
        { name: '👤 Użytkownik', value: `${user} (${user.tag})`, inline: true },
        { name: '📍 Kanał', value: `${channel}`, inline: true },
        { name: '🕐 Czas', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: '📝 Powód', value: reason, inline: false });
    }

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Błąd podczas logowania:', error);
  }
}

// Funkcja pobierania logów rozmowy dla użytkownika
async function getTicketConversationForUser(channel) {
  try {
    // Pobierz wszystkie wiadomości z kanału ticketu
    let allMessages = [];
    let lastMessageId;

    while (true) {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      allMessages.push(...messages.values());
      lastMessageId = messages.last().id;
    }

    // Sortuj wiadomości chronologicznie (od najstarszej do najnowszej)
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Przygotuj tekst rozmowy (pomijając embedy systemowe)
    let conversationText = '';
    let messageCount = 0;
    
    allMessages.forEach(msg => {
      // Pomijaj wiadomości systemowe z embedami (ale nie wszystkie wiadomości botów)
      const isSystemEmbed = msg.author.bot && msg.embeds.length > 0 && 
        (msg.embeds[0].title?.includes('Ticket') || 
         msg.embeds[0].title?.includes('przejął') || 
         msg.embeds[0].title?.includes('ważny') ||
         msg.embeds[0].title?.includes('zamknięty'));
      
      if (!isSystemEmbed) {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString('pl-PL');
        let content = msg.content || '';
        
        // Jeśli wiadomość ma załączniki lub embedy
        if (msg.attachments.size > 0) {
          content += ` [Załącznik: ${msg.attachments.first().name}]`;
        }
        if (msg.embeds.length > 0 && !content) {
          content = '*embed*';
        }
        
        if (content.trim()) {
          conversationText += `[${timestamp}] ${msg.author.tag}: ${content}\n`;
          messageCount++;
        }
      }
    });

    console.log(`Znaleziono ${messageCount} wiadomości w tickecie ${channel.name}`);

    // Jeśli nie ma żadnych wiadomości, zwróć komunikat
    if (!conversationText.trim()) {
      conversationText = 'Brak zapisanych wiadomości w tym tickecie.\n';
    }

    // Podziel na części jeśli za długa (Discord ma limit 4096 znaków na embed)
    const maxLength = 3800; // Zostawiamy miejsce na formatowanie
    const chunks = [];
    
    if (conversationText.length <= maxLength) {
      chunks.push(conversationText);
    } else {
      let currentChunk = '';
      const lines = conversationText.split('\n');

      for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
          if (currentChunk.trim()) chunks.push(currentChunk);
          currentChunk = line + '\n';
        } else {
          currentChunk += line + '\n';
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk);
    }

    return chunks;

  } catch (error) {
    console.error('Błąd podczas pobierania logów rozmowy:', error);
    return ['Wystąpił błąd podczas pobierania logów rozmowy.'];
  }
}

// Funkcja oznaczania ticketu jako ważny
async function markAsImportant(interaction) {
  try {
    const channel = interaction.channel;
    const user = interaction.user;

    if (!/^\d{4}-/.test(channel.name) && !channel.name.startsWith('⭐')) {
      return await interaction.reply({ 
        content: '❌ To nie jest kanał ticketu!', 
        ephemeral: true 
      });
    }

    // Sprawdź czy użytkownik ma odpowiednie uprawnienia (rola administratora)
    if (!interaction.member.roles.cache.has('1367097320776142849')) {
      return await interaction.reply({ 
        content: '❌ Nie masz uprawnień do oznaczania ticketów jako ważne!', 
        ephemeral: true 
      });
    }

    // Sprawdź czy ticket już nie jest oznaczony jako ważny
    if (channel.name.startsWith('⭐')) {
      return await interaction.reply({ 
        content: '❌ Ten ticket jest już oznaczony jako ważny!', 
        ephemeral: true 
      });
    }

    // Zmień nazwę kanału dodając gwiazdkę na początku
    const newChannelName = `⭐${channel.name}`;
    await channel.setName(newChannelName);

    const importantEmbed = new EmbedBuilder()
      .setColor(0xffd700) // złoty kolor
      .setTitle('⭐ Ticket oznaczony jako ważny')
      .setDescription(
        `**Moderator:** ${user}\n` +
        `**Czas oznaczenia:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
        `🟡 **Status:** Priorytetowy`
      )
      .setFooter({ text: `Oznaczony przez ${user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [importantEmbed] });

    // Wyślij log o oznaczeniu jako ważne
    await logTicketAction('important', user, channel);

  } catch (error) {
    console.error('Błąd podczas oznaczania ticketu jako ważny:', error);
    await interaction.reply({ 
      content: '❌ Wystąpił błąd podczas oznaczania ticketu jako ważny!', 
      ephemeral: true 
    });
  }
}

// Funkcja zapisywania całej rozmowy z ticketu
async function logTicketConversation(channel) {
  try {
    const guild = channel.guild;
    const logChannel = await guild.channels.fetch(LOGS_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;

    // Pobierz wszystkie wiadomości z kanału ticketu
    let allMessages = [];
    let lastMessageId;

    while (true) {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      allMessages.push(...messages.values());
      lastMessageId = messages.last().id;
    }

    // Sortuj wiadomości chronologicznie (od najstarszej do najnowszej)
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Przygotuj tekst rozmowy
    let conversationText = '';
    allMessages.forEach(msg => {
      if (!msg.author.bot || msg.embeds.length === 0) {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString('pl-PL');
        const content = msg.content || '*embed lub załącznik*';
        conversationText += `[${timestamp}] ${msg.author.tag}: ${content}\n`;
      }
    });

    // Jeśli rozmowa jest za długa, podziel na części
    const maxLength = 4000;
    if (conversationText.length <= maxLength) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📜 Zapis rozmowy z ticketu: ${channel.name}`)
        .setDescription(`\`\`\`\n${conversationText}\`\`\``)
        .setFooter({ text: `Łącznie wiadomości: ${allMessages.length}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    } else {
      // Podziel na części jeśli za długa
      const chunks = [];
      let currentChunk = '';
      const lines = conversationText.split('\n');

      for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = line + '\n';
        } else {
          currentChunk += line + '\n';
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      // Wyślij każdą część
      for (let i = 0; i < chunks.length; i++) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📜 Zapis rozmowy z ticketu: ${channel.name} (${i + 1}/${chunks.length})`)
          .setDescription(`\`\`\`\n${chunks[i]}\`\`\``)
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }

  } catch (error) {
    console.error('Błąd podczas zapisywania rozmowy:', error);
  }
}

// Funkcja zamykania ticketu
async function closeTicket(interaction) {
  try {
    const channel = interaction.channel;

    if (!/^\d{4}-/.test(channel.name) && !channel.name.startsWith('⭐')) {
      return await interaction.reply({ 
        content: '❌ To nie jest kanał ticketu!', 
        ephemeral: true 
      });
    }

    // Pokaż modal z powodem zamknięcia
    const modal = new ModalBuilder()
      .setCustomId('close_ticket_modal')
      .setTitle('Zamknij Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Powód zamknięcia ticketu')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Opisz powód zamknięcia ticketu...')
      .setRequired(true)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Błąd podczas pokazywania modala:', error);
    await interaction.reply({ 
      content: '❌ Wystąpił błąd podczas otwierania formularza!', 
      ephemeral: true 
    });
  }
}

// Funkcja obsługująca modal zamknięcia ticketu
async function handleCloseTicketModal(interaction) {
  try {
    const channel = interaction.channel;
    const closeReason = interaction.fields.getTextInputValue('close_reason');

    // Znajdź właściciela ticketu z nazwy kanału
    const channelName = channel.name.replace(/^⭐/, ''); // Usuń gwiazdkę jeśli jest
    const usernameMatch = channelName.match(/^\d{4}-(.+)-(.+)/);
    let ticketOwner = null;

    if (usernameMatch) {
      const username = usernameMatch[1];
      const category = usernameMatch[2];

      // Znajdź użytkownika na serwerze
      const guild = interaction.guild;
      ticketOwner = guild.members.cache.find(member => 
        member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '') === username
      );

      // Pobierz logi rozmowy dla użytkownika
      const conversationLogs = await getTicketConversationForUser(channel);
      console.log(`Pobrano ${conversationLogs.length} części logów dla ticketu ${channel.name}`);

      // Wyślij wiadomość prywatną do właściciela ticketu z logami
      if (ticketOwner) {
        try {
          console.log(`Wysyłanie wiadomości do użytkownika: ${ticketOwner.user.tag}`);
          
          const userEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔒 Twój ticket został zamknięty')
            .setDescription(
              `**Serwer:** ${guild.name}\n` +
              `**Kategoria:** ${category}\n` +
              `**Zamknięty przez:** ${interaction.user.tag}\n` +
              `**Powód zamknięcia:** ${closeReason}\n` +
              `**Czas zamknięcia:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
              `Dziękujemy za skorzystanie z naszego wsparcia! 🙏\n` +
              `W razie potrzeby możesz utworzyć nowy ticket.`
            )
            .setFooter({ text: 'System ticketów' })
            .setTimestamp();

          await ticketOwner.send({ embeds: [userEmbed] });
          console.log('Wysłano embed zamknięcia ticketu');

          // Wyślij logi rozmowy - ZAWSZE wyślij coś
          const logsEmbed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📜 Zapis Twojej rozmowy z ticketu')
            .setDescription(`Poniżej znajdziesz zapis rozmowy z Twojego ticketu #${channel.name}:`)
            .setTimestamp();

          await ticketOwner.send({ embeds: [logsEmbed] });
          console.log('Wysłano nagłówek logów');

          // Wyślij logi w częściach
          if (conversationLogs.length > 0) {
            for (let i = 0; i < conversationLogs.length; i++) {
              const logChunk = conversationLogs[i];
              const logEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`📄 Część ${i + 1}/${conversationLogs.length}`)
                .setDescription(`\`\`\`\n${logChunk}\`\`\``)
                .setTimestamp();

              await ticketOwner.send({ embeds: [logEmbed] });
              console.log(`Wysłano część ${i + 1}/${conversationLogs.length} logów`);
              
              // Małe opóźnienie między wiadomościami
              if (i < conversationLogs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          } else {
            // Jeśli nie ma logów, wyślij informację
            const noLogsEmbed = new EmbedBuilder()
              .setColor(0x2b2d31)
              .setDescription('```\nBrak zapisanych wiadomości w tym tickecie.\n```')
              .setTimestamp();

            await ticketOwner.send({ embeds: [noLogsEmbed] });
            console.log('Wysłano informację o braku logów');
          }

          console.log('Pomyślnie wysłano wszystkie logi do użytkownika');

        } catch (dmError) {
          console.error('Nie udało się wysłać wiadomości prywatnej do użytkownika:', dmError);
          console.error('Szczegóły błędu:', dmError.message);
        }
      } else {
        console.log('Nie znaleziono właściciela ticketu');
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🔒 Ticket zostanie zamknięty')
      .setDescription(`**Powód:** ${closeReason}\n\nKanał zostanie usunięty za 5 sekund...`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Wyślij log o zamknięciu ticketu z powodem
    await logTicketActionWithReason('close', interaction.user, channel, closeReason);

    // Zapisz całą rozmowę z ticketu do logów
    await logTicketConversation(channel);

    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (error) {
        console.error('Błąd podczas usuwania kanału:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('Błąd podczas zamykania ticketu:', error);
    await interaction.reply({ 
      content: '❌ Wystąpił błąd podczas zamykania ticketu!', 
      ephemeral: true 
    });
  }
}

client.on("messageCreate", async (message) => {
  // Ignoruj wiadomości od botów
  if (message.author.bot) return;

  // Tylko kanał, który nas interesuje dla embeddowania
  if (message.channel.id !== monitoredChannelId) return;

  // Zapisz treść wiadomości
  const content = message.content;

  try {
    // Usuń oryginalną wiadomość
    await message.delete();

    // Stwórz embed z treścią użytkownika
    const embed = new EmbedBuilder()
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(content || "*Brak treści*")
      .setColor(0x5865f2) // Kolor embeda (np. Discord blurple)
      .setTimestamp();

    // Wyślij embed w tym samym kanale
    await message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Błąd podczas usuwania lub wysyłania wiadomości:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);