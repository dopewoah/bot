require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Colors, SlashCommandBuilder, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, ActivityType } = require('discord.js');
const { Client: SelfBotClient } = require('discord.js-selfbot-v13');
const chalk = require('chalk');
const fs = require('fs');
const axios = require('axios');
const config = require('./config');

// Main Bot Initialization
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start the advertisement process'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the advertisement process'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the status of all logged-in clients'),
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Show the dashboard with controls'),
  new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Generate and send a file with all channel IDs'),
  new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Set the status and activity of self-bots')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('The status to set (online, idle, dnd)')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
        ))
    .addStringOption(option =>
      option.setName('activity')
        .setDescription('The activity type (playing, listening, watching)')
        .setRequired(true)
        .addChoices(
          { name: 'Playing', value: 'PLAYING' },
          { name: 'Listening', value: 'LISTENING' },
          { name: 'Watching', value: 'WATCHING' },
        ))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the activity')
        .setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(process.env.DASHBOARD_BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const clients = [];
let isAdvertising = false;
let adsSentCount = 0;
const startTime = new Date();
let dashboardMessage = null;
const lastAdTimeMap = new Map();
const lastSelfBotMessageTimeMap = new Map();
let breakTimeout;

bot.once('ready', async () => {
  console.log(`${chalk.green.bold('[MAIN BOT]:')} Logged in as ${bot.user.tag}`);
});

bot.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'start') {
      if (isAdvertising) {
        await interaction.reply({ content: 'Self-bots are already running, this is prolly cause a crash and needs to be ran again, do `/stop` and `/start` again to fix this.', ephemeral: true });
        return;
      }

      try {
        await startSelfBots();
        isAdvertising = true;

        const startEmbed = new EmbedBuilder()
          .setTitle('Advertisement Process Started')
          .setDescription('The advertisement process has been successfully started.')
          .setColor(Colors.Green)
          .addFields(
            { name: 'Start Time', value: new Date().toISOString(), inline: true },
            { name: 'Target Channels', value: config.normalChannels.length.toString(), inline: true },
            { name: 'Status', value: 'Running', inline: true },
            { name: 'Description', value: 'The bot will now start sending advertisements to the specified channels.', inline: false },
            { name: 'Total Self-Bots', value: tokens.length.toString(), inline: true },
            { name: 'Webhook URL', value: webhookUrl ? 'Configured' : 'Not Configured', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Advertisement Bot', iconURL: bot.user.displayAvatarURL() });

        await interaction.reply({ embeds: [startEmbed], ephemeral: true });
      } catch (error) {
        console.error(`${chalk.red.bold('[START ERROR]:')} ${error.message}`);
        await interaction.reply({ content: `Failed to start advertisements process: ${error.message}`, ephemeral: true });
      }
    } else if (commandName === 'stop') {
      if (!isAdvertising) {
        await interaction.reply({ content: 'Stopping self-bots... (Self Bots Stopped, run `/start` to start the process again.', ephemeral: true });
        return;
      }

      try {
        stopSelfBots();
        isAdvertising = false;
        await interaction.reply({ content: 'Stopping self-bots... (Self Bots Stopped, run `/start` to start the process again.)', ephemeral: true });
      } catch (error) {
        console.error(`${chalk.red.bold('[STOP ERROR]:')} ${error.message}`);
        await interaction.reply({ content: `Failed to stop advertisements process: ${error.message}`, ephemeral: true });
      }
    } else if (commandName === 'status') {
      const statusEmbed = new EmbedBuilder()
        .setTitle('Self-bot Status Command')
        .setDescription('Click the button below to view detailed stats.')
        .setColor(Colors.Blue)
        .setTimestamp()
        .setFooter({ text: 'Advertisement Bot', iconURL: bot.user.displayAvatarURL() });

      const statsButton = new ButtonBuilder()
        .setCustomId('stats')
        .setLabel('Stats')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(statsButton);

      await interaction.reply({ embeds: [statusEmbed], components: [row], ephemeral: true });
    } else if (commandName === 'dashboard') {
      const uptime = (new Date() - startTime) / 1000;
const dashboardEmbed = new EmbedBuilder()
  .setTitle('📊 Advertisement Dashboard')
  .setDescription('Use the buttons below to control the advertisement process.')
  .setColor(Colors.DarkBlue)
  .setThumbnail(bot.user.displayAvatarURL())
  .addFields(
    { name: '🕒 Uptime', value: `${Math.floor(uptime / 60)} minutes`, inline: false },
    { name: '🤖 Active Self-Bots', value: clients.length.toString(), inline: true },
    { name: '📈 Ads Sent', value: adsSentCount.toString(), inline: true },
    { name: '📢 Active Channels', value: config.normalChannels.length.toString(), inline: true },
    { name: '⏲️ Avg Time Between Ads', value: `${(adsSentCount > 0 ? (uptime / adsSentCount).toFixed(2) : 0)} seconds`, inline: true },
    { name: '🕓 Last Ad Sent', value: lastAdTimeMap.size > 0 ? new Date(Math.max(...lastAdTimeMap.values())).toISOString() : 'N/A', inline: false }
  )
  .setImage('https://example.com/dashboard-banner.png') // Add an image if you have one
  .setTimestamp()
  .setFooter({
    text: 'Advertisement Bot - Automated Advertisement System',
    iconURL: bot.user.displayAvatarURL()
  });

const startButton = new ButtonBuilder()
  .setCustomId('start')
  .setLabel('Start')
  .setStyle(ButtonStyle.Success)
  .setEmoji('🟢');

const stopButton = new ButtonBuilder()
  .setCustomId('stop')
  .setLabel('Stop')
  .setStyle(ButtonStyle.Danger)
  .setEmoji('🔴');

const statusButton = new ButtonBuilder()
  .setCustomId('status')
  .setLabel('Status')
  .setStyle(ButtonStyle.Primary)
  .setEmoji('ℹ️');

const refreshButton = new ButtonBuilder()
  .setCustomId('refresh')
  .setLabel('Refresh')
  .setStyle(ButtonStyle.Secondary)
  .setEmoji('🔄');

const breakButton = new ButtonBuilder()
  .setCustomId('manual_break')
  .setLabel('Manual Break')
  .setStyle(ButtonStyle.Secondary)
  .setEmoji('⏸️');

const channelsButton = new ButtonBuilder()
  .setCustomId('channels')
  .setLabel('Channels')
  .setStyle(ButtonStyle.Secondary)
  .setEmoji('📋');

const row1 = new ActionRowBuilder()
  .addComponents(startButton, stopButton, statusButton, refreshButton);

const row2 = new ActionRowBuilder()
  .addComponents(breakButton, channelsButton);

dashboardMessage = await interaction.reply({ embeds: [dashboardEmbed], components: [row1, row2], fetchReply: true });

setInterval(updateDashboardEmbed, 120000);
    } else if (commandName === 'channels') {
      const channelsInfo = config.normalChannels.map((channelId, index) => `Channel ${index + 1}: ${channelId}`).join('\n');
      
      fs.writeFileSync('message.txt', channelsInfo);

      const file = new AttachmentBuilder('message.txt');

      await interaction.reply({ content: 'Here are the channel IDs:', files: [file], ephemeral: true });
    } else if (commandName === 'setstatus') {
      const status = interaction.options.getString('status');
      const activityType = interaction.options.getString('activity');
      const activityName = interaction.options.getString('name');

      clients.forEach(client => {
        try {
          client.user.setPresence({
            activities: [{ name: activityName, type: ActivityType[activityType] }],
            status: status,
          });
        } catch (error) {
          console.error(`${chalk.red.bold('[SET STATUS ERROR]:')} Failed to set status for ${client.user.tag}: ${error.message}`);
        }
      });

      await interaction.reply({ content: `Status and activity updated to: ${status}, ${activityType} ${activityName}`, ephemeral: true });
    }
  } else if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId === 'start') {
      await startSelfBots();
      isAdvertising = true;

      const startEmbed = new EmbedBuilder()
    .setTitle('🚀 Advertisement Process Started')
    .setDescription('The advertisement process has been successfully started. Below are the details:')
    .setColor(Colors.Green)
    .addFields(
    { name: '🕒 Start Time', value: new Date().toISOString(), inline: false },
    { name: '📢 Target Channels', value: `${config.normalChannels.length}`, inline: true },
    { name: '🤖 Total Self-Bots', value: `${tokens.length}`, inline: true },
    { name: '🔗 Webhook URL', value: webhookUrl ? 'Configured' : 'Not Configured', inline: true },
    { name: '⚙️ Status', value: 'Running', inline: false },
    { name: '📄 Description', value: 'The bot will now start sending advertisements to the specified channels.', inline: false }
  )
    .setThumbnail(bot.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: 'Advertisement Bot - oppenheimer', iconURL: bot.user.displayAvatarURL() });

      await interaction.reply({ embeds: [startEmbed], ephemeral: true });
    } else if (customId === 'stop') {
      stopSelfBots();
      isAdvertising = false;
      await interaction.reply({ content: 'Stopping self-bots... (Self Bots Stopped, run `/start` to start the process again.)', ephemeral: true });
    } else if (customId === 'status') {
      const connectedAccounts = clients.map(client => ({
        username: client.user.username,
        id: client.user.id,
        status: 'online',
      }));

      const statusEmbed = new EmbedBuilder()
        .setTitle('Self-bot Status')
        .setColor(Colors.Green);

      connectedAccounts.forEach(account => {
        statusEmbed.addFields(
          { name: 'Username', value: account.username, inline: true },
          { name: 'ID', value: account.id, inline: true },
          { name: 'Status', value: account.status, inline: true }
        );
      });

      await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
    } else if (customId === 'stats') {
      const uptime = (new Date() - startTime) / 1000;
      const statsEmbed = new EmbedBuilder()
        .setTitle('Detailed Stats')
        .setDescription('Here are the current statistics.')
        .setColor(Colors.Blue)
        .addFields(
          { name: 'Uptime', value: `${Math.floor(uptime / 60)} minutes`, inline: true },
          { name: 'Active Self-Bots', value: clients.length.toString(), inline: true },
          { name: 'Ads Sent', value: adsSentCount.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'oppenheimer', iconURL: bot.user.displayAvatarURL() });

      await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
    } else if (customId === 'refresh') {
      await updateDashboardEmbed();
      await interaction.reply({ content: 'Dashboard refreshed.', ephemeral: true });
    } else if (customId === 'manual_break') {
      const modal = new ModalBuilder()
        .setCustomId('manual_break_modal')
        .setTitle('Manual Break');

      const breakDurationInput = new TextInputBuilder()
        .setCustomId('break_duration')
        .setLabel('Break Duration (minutes)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter break duration in minutes')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(breakDurationInput);

      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    } else if (customId === 'channels') {
      const channelsInfo = config.normalChannels.map((channelId, index) => `Channel ${index + 1}: ${channelId}`).join('\n');
      
      fs.writeFileSync('message.txt', channelsInfo);

      const file = new AttachmentBuilder('message.txt');

      await interaction.reply({ content: 'Here are the channel IDs:', files: [file], ephemeral: true });
    } else if (customId === 'end_break') {
      clearTimeout(breakTimeout);
      console.log(`${chalk.blue.bold('[SELF BOT]:')} Break ended early by user.`);
      await interaction.reply({ content: 'Break ended early. Use The `/dashboard` to set another', ephemeral: true });
      breakTimeout = null;
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'manual_break_modal') {
      const breakDuration = parseInt(interaction.fields.getTextInputValue('break_duration'));

      if (isNaN(breakDuration) || breakDuration <= 0) {
        await interaction.reply({ content: 'Invalid break duration. Please enter a valid number of minutes.', ephemeral: true });
        return;
      }

      console.log(`${chalk.blue.bold('[SELF BOT]:')} Taking a manual break for ${breakDuration} minutes...`);

      const breakEmbed = new EmbedBuilder()
        .setTitle('Advertisement Bot Manual Break')
        .setDescription(`The bot is taking a manual break for ${breakDuration} minutes. Click the button below to end the break early.`)
        .setColor(Colors.Orange)
        .setTimestamp()
        .setFooter({ text: 'Advertisement Bot', iconURL: bot.user.displayAvatarURL() });

      const endBreakButton = new ButtonBuilder()
        .setCustomId('end_break')
        .setLabel('End Break Early')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(endBreakButton);

      await bot.channels.cache.get(config.logChannelId).send({ embeds: [breakEmbed], components: [row] });

      breakTimeout = setTimeout(async () => {
        console.log(`${chalk.blue.bold('[SELF BOT]:')} Resuming advertisement process after manual break...`);
        breakTimeout = null;
      }, breakDuration * 60 * 1000);

      await interaction.reply({ content: `Manual break for ${breakDuration} minutes started.`, ephemeral: true });
    }
  }
});

bot.login(process.env.DASHBOARD_BOT_TOKEN);

// Self-Bot Functions
const tokens = fs.readFileSync('tokens.txt', 'utf-8').split('\n').filter(Boolean);
const webhookUrl = config.webhookUrl;

if (tokens.length === 0) {
  console.error('Error: TOKENS environment variable is not set or empty.');
  process.exit(1);
}

console.log(`${chalk.blue.bold('[SELF BOT]:')} Tokens loaded from file:`, tokens);

async function startSelfBots() {
  console.log(`${chalk.blue.bold('[SELF BOT]:')} Starting self-bots...`);
  for (const token of tokens) {
    console.log(`${chalk.blue.bold('[SELF BOT]:')} Attempting to login with token: ${token}`);
    const client = new SelfBotClient({
      checkUpdate: false,
    });

    client.once('ready', () => {
      console.log(`${chalk.green.bold('[SELF BOT]:')} Logged in as ${client.user.tag}`);
      clients.push(client);
      if (clients.length === tokens.length) {
        console.log(`${chalk.blue.bold('[SELF BOT]:')} All self-bots logged in. Starting advertisement process...`);
        sendBatchAds();
      }
    });

    client.on('messageCreate', message => {
      if (message.author.id === client.user.id) {
        lastSelfBotMessageTimeMap.set(message.channel.id, Date.now());
      }
    });

    client.login(token).catch(error => {
      console.error(`${chalk.red.bold('[LOGIN ERROR]:')} Failed to login client with token: ${error.message}`);
    });
  }
}

function stopSelfBots() {
  console.log(`${chalk.blue.bold('[SELF BOT]:')} Stopping self-bots...`);
  clients.forEach(client => {
    client.destroy();
    console.log(`${chalk.red.bold('[SELF BOT]:')} Logged out`);
  });
  clients.length = 0; 
  lastAdTimeMap.clear();
  lastSelfBotMessageTimeMap.clear();
  console.log(`${chalk.blue.bold('[SELF BOT]:')} All self-bots stopped.`);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomSelfBotMessageInterval() {
  const minInterval = 5 * 60 * 1000; 
  const maxInterval = 30 * 60 * 1000; 
  return getRandomInt(minInterval, maxInterval);
}

const sendBatchAds = async () => {
  if (clients.length === 0) {
    console.error(`${chalk.red.bold('[SELF BOT ERROR]:')} No self-bots are logged in.`);
    return;
  }

  const minDelay = 1000;
  const maxDelay = 3000;
  const ad = config.ads[0];
  const adCooldownPeriod = 10 * 60 * 1000;
  const minAdInterval = 30 * 1000;
  const minIntervalBetweenAds = 30 * 1000; 

  console.log(`${chalk.blue.bold('[SELF BOT]:')} Starting batch advertisement process...`);

  while (true) {
    try {
      for (const channelId of config.normalChannels) {
        const client = clients[0];
        if (client && client.channels) {
          const channel = client.channels.cache.get(channelId);
          if (channel) {
            const now = Date.now();
            const lastAdTime = lastAdTimeMap.get(channelId) || 0;
            
            try {
              const fetchedMessages = await channel.messages.fetch({ limit: 10 });
              const recentAdMessage = fetchedMessages.find(msg => msg.author.bot && config.ads.includes(msg.content));

              if (recentAdMessage && (now - recentAdMessage.createdTimestamp) < adCooldownPeriod) {
                console.log(`${chalk.yellow.bold('[SKIP]:')} Skipping channel ${channel.name} as a recent advertisement was found.`);
                continue;
              }
            } catch (error) {
              console.error(`${chalk.red.bold('[FETCH ERROR]:')} Failed to fetch messages from ${channel.name}: ${error.message}`);
            }

            if (now - lastAdTime >= adCooldownPeriod && now - lastAdTime >= minIntervalBetweenAds) {
              try {
                console.log(`Attempting to send ad to channel: ${channel.name}`);

                const sendMessageWithTimeout = new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                  channel.send(ad)
                    .then(message => {
                      clearTimeout(timeout);
                      resolve(message);
                      adsSentCount++;
                      
                      sendWebhookNotification(`**Advertisement sent** to ${channel.name} in ${channel.guild.name}`, message.url);
                    })
                    .catch(error => {
                      clearTimeout(timeout);
                      reject(error);
                    });
                });

                await sendMessageWithTimeout;
                console.log(`Sent advertisement to channel ${channel.name}`);
                lastAdTimeMap.set(channelId, now);

                await new Promise(resolve => setTimeout(resolve, minAdInterval));
              } catch (error) {
                console.error(`${chalk.red.bold('[SEND ERROR]:')} Failed to send advertisement to ${channel.name}: ${error.message}`);
              }
            } else {
              const remainingCooldown = Math.max(adCooldownPeriod - (now - lastAdTime), minIntervalBetweenAds - (now - lastAdTime));
              console.log(`${chalk.yellow.bold('[COOLDOWN]:')} Channel ${channel.name} is on cooldown. Waiting for ${remainingCooldown / 1000} seconds.`);
              await new Promise(resolve => setTimeout(resolve, remainingCooldown));
            }

            const randomDelay = getRandomInt(minDelay, maxDelay);
            console.log(`${chalk.blue.bold('[SELF BOT]:')} Waiting for ${randomDelay / 1000} seconds before the next message...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
          } else {
            console.log(`${chalk.red.bold('[CHANNEL NOT FOUND]:')} Channel with ID ${channelId} not found`);
          }
        } else {
          console.error(`${chalk.red.bold('[SELF BOT ERROR]:')} Client or client.channels is undefined.`);
          return;
        }
      }

      const breakDuration = getRandomInt(25, 40) * 60 * 1000;
      const breakEndTime = new Date(Date.now() + breakDuration);
      console.log(`${chalk.blue.bold('[SELF BOT]:')} Taking a break for ${breakDuration / 60000} minutes...`);

      const breakEmbed = new EmbedBuilder()
        .setTitle('🛑 Advertisement Bot Break')
        .setDescription(`The bot is taking a manual break. The break will end at **${breakEndTime.toISOString()}**.`)
        .setColor(Colors.Orange)
        .addFields(
          { name: 'Break Duration', value: `${breakDuration / 60000} minutes`, inline: true },
          { name: 'Break End Time', value: `${breakEndTime.toISOString()}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Advertisement Bot', iconURL: bot.user.displayAvatarURL() });

      const endBreakButton = new ButtonBuilder()
        .setCustomId('end_break')
        .setLabel('End Break Early')
        .setStyle(ButtonStyle.Danger);

      const changeBreakButton = new ButtonBuilder()
        .setCustomId('manual_break')
        .setLabel('Change Break Duration')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏸️');

      const row = new ActionRowBuilder().addComponents(endBreakButton, changeBreakButton);

      await bot.channels.cache.get(config.logChannelId).send({ embeds: [breakEmbed], components: [row] });

      breakTimeout = setTimeout(async () => {
        console.log(`${chalk.blue.bold('[SELF BOT]:')} Resuming advertisement process...`);
        breakTimeout = null;
      }, breakDuration);

      await new Promise(resolve => breakTimeout = setTimeout(resolve, breakDuration));
    } catch (error) {
      console.error(`${chalk.red.bold('[BATCH ERROR]:')} An error occurred during the batch advertisement process: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); 
    }
  }
};

const sendWebhookNotification = async (content) => {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Advertisement Sent!')
      .setDescription(content)
      .setColor(Colors.Green)
      .setThumbnail(bot.user.displayAvatarURL())
      .addFields(
        { name: 'Time', value: new Date().toISOString(), inline: true },
        { name: 'Status', value: 'Success', inline: true }
      )
      .setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4KBceUSwijSvGoEX6ZE8u__FxF5dN1ggY7Q&s') 
      .setTimestamp()
      .setFooter({
        text: 'Advertisement Bot - Automated Advertisement System',
        iconURL: bot.user.displayAvatarURL()
      });

    await axios.post(webhookUrl, {
      content: null, 
      embeds: [embed.toJSON()]
    });
  } catch (error) {
    console.error(`${chalk.red.bold('[WEBHOOK ERROR]:')} ${error.message}`);
  }
};


async function updateDashboardEmbed() {
  if (dashboardMessage) {
    try {
      const uptime = (new Date() - startTime) / 1000;
      const updatedEmbed = new EmbedBuilder()
        .setTitle('📊 Advertisement Dashboard')
        .setDescription('Use the buttons below to control the advertisement process.')
        .setColor(Colors.DarkBlue)
        .setThumbnail(bot.user.displayAvatarURL())
        .addFields(
          { name: '🕒 Uptime', value: `${Math.floor(uptime / 60)} minutes`, inline: false },
          { name: '🤖 Active Self-Bots', value: clients.length.toString(), inline: true },
          { name: '📈 Ads Sent', value: adsSentCount.toString(), inline: true },
          { name: '📢 Active Channels', value: config.normalChannels.length.toString(), inline: true },
          { name: '⏲️ Avg Time Between Ads', value: `${(adsSentCount > 0 ? (uptime / adsSentCount).toFixed(2) : 0)} seconds`, inline: true },
          { name: '🕓 Last Ad Sent', value: lastAdTimeMap.size > 0 ? new Date(Math.max(...lastAdTimeMap.values())).toISOString() : 'N/A', inline: false }
        )
        .setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4KBceUSwijSvGoEX6ZE8u__FxF5dN1ggY7Q&s') 
        .setTimestamp()
        .setFooter({
          text: 'Advertisement Bot - Automated Advertisement System',
          iconURL: bot.user.displayAvatarURL()
        });

      const startButton = new ButtonBuilder()
        .setCustomId('start')
        .setLabel('Start')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢');

      const stopButton = new ButtonBuilder()
        .setCustomId('stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔴');

      const statusButton = new ButtonBuilder()
        .setCustomId('status')
        .setLabel('Status')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('ℹ️');

      const refreshButton = new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄');

      const breakButton = new ButtonBuilder()
        .setCustomId('manual_break')
        .setLabel('Manual Break')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏸️');

      const channelsButton = new ButtonBuilder()
        .setCustomId('channels')
        .setLabel('Channels')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋');
      
      const row1 = new ActionRowBuilder()
        .addComponents(startButton, stopButton, statusButton, refreshButton);
      
      const row2 = new ActionRowBuilder()
        .addComponents(breakButton, channelsButton);

      await dashboardMessage.edit({ embeds: [updatedEmbed], components: [row1, row2] });
    } catch (error) {
      if (error.code === 10008) {
        console.error('Dashboard message not found, possibly deleted.');
        dashboardMessage = null;
      } else {
        console.error(`Failed to update dashboard message: ${error.message}`);
      }
    }
  }
}
