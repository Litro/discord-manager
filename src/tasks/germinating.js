const db = require('../db');

const {
  GERMINATING_ROLE_ID,
  WELCOME_CHANNEL_ID,
  CODE_OF_CONDUCT_MESSAGE_ID,
  SEEDLING_ROLE_ID,
  MIN_INTRO_MESSAGE_LENGTH
} = require('../config');

function addMissingGerminators(guild) {
  guild.roles.get(GERMINATING_ROLE_ID).members.forEach(async (member) => {
    const dbMember = await db.find({
      _id: member.id
    });
    if (!dbMember) {
      await db.insert({
        _id: member.user.id,
        codeOfConduct: false,
        introduction: false
      });
      console.log('Added missing germinator to db:', member.user.username);
    }
  });
}

async function moveToGerminating(member) {
  console.log(member.user.username, 'just joined the server!');
  const germinatingRole = member.guild.roles.get(GERMINATING_ROLE_ID);
  const addRolePromise = member.addRole(germinatingRole);
  const insertDB = db.update({
    _id: member.user.id,
  }, {
    _id: member.user.id,
    codeOfConduct: false,
    introduction: false
  }, {
    upsert: true
  });
  try {
    await addRolePromise;
    console.log(member.user.username, 'added to germinating role!');
  }
  catch (error) {
    console.error('Error moving', member.user.username, 'to germinating role.');
    console.error(error);
  }
  try {
    await insertDB;
    console.log(member.user.username, 'inserted into DB!');
  }
  catch (error) {
    console.error('Error inserting', member.user.username, 'into DB.');
  }
}

async function listenCodeOfConductReactions(guild) {
  const welcomeChannel = guild.channels.get(WELCOME_CHANNEL_ID);
  const message = await welcomeChannel.fetchMessage(CODE_OF_CONDUCT_MESSAGE_ID);
  const collector = message.createReactionCollector(_ => true);
  collector.on('collect', async (reaction) => {
    const guildMembers = await Promise.all(reaction.users.map(user => guild.fetchMember(user)));
    guildMembers.forEach(async (guildMember) => {
      checkMoveToSeedling(guildMember, 'codeOfConduct');
    });
  });
}

async function checkIntroMessage(message, guild, author) {
  if (message.content.length >= MIN_INTRO_MESSAGE_LENGTH) {
    const guildMember = await guild.fetchMember(author);
    checkMoveToSeedling(guildMember, 'introduction');
  }
}

async function checkMoveToSeedling(guildMember, property) {
  const germinatingRole = guildMember.roles.get(GERMINATING_ROLE_ID);
  if (germinatingRole) {
    const info = await db.update({
      _id: guildMember.id
    }, {
      $set: {
        [property]: true
      }
    }, {
      upsert: true,
      returnUpdatedDocs: true
    });

    if (info && info.codeOfConduct && info.introduction) {
      addToSeedling(guildMember);
    }
  }
}

async function addToSeedling(guildMember) {
  const addRolePromise = guildMember.addRole(SEEDLING_ROLE_ID);
  const removeRolePromise = guildMember.removeRole(GERMINATING_ROLE_ID);

  try {
    await addRolePromise;
    console.log(guildMember.user.username, 'has become a seedling!');
    await db.remove({
      _id: guildMember.id
    });
  } catch (error) {
    console.error('Error adding', guildMember.user.username, 'to seedling role!');
  }

  try {
    await removeRolePromise;
    console.log(guildMember.user.username, 'has been removed from germinating!');
  } catch (error) {
    console.error('Error removing', guildMember.user.username, 'from germinating role!');
  }
}

module.exports = {
  moveToGerminating,
  listenCodeOfConductReactions,
  checkIntroMessage,
  addMissingGerminators
};