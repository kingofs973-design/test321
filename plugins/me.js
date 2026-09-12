'use strict';

/**
 * .me — JUNAID MD 302 sound command
 * .me        -> plays sounds sequentially: 1, 2, 3 ... 14, then loops
 * .me 1-14   -> plays a specific sound
 */
const fs = require('fs');
const path = require('path');

const SOUND_DIR = path.join(process.cwd(), 'assets', 'me-sounds');
const SOUNDS = fs.readdirSync(SOUND_DIR, { withFileTypes: true })
  .filter(entry => entry.isFile() && /^me\d+\.mp3$/i.test(entry.name))
  .map(entry => path.join(SOUND_DIR, entry.name))
  .sort((a, b) => Number((path.basename(a).match(/\d+/) || ['0'])[0]) - Number((path.basename(b).match(/\d+/) || ['0'])[0]));

module.exports = {
  command: 'me',
  aliases: [],
  category: 'fun',
  description: '🎵 Play a JUNAID MD 302 sound',
  usage: '.me or .me 1-14',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message?.key?.remoteJid;
    if (!chatId) return;

    const requested = Number.parseInt(String(args?.[0] || ''), 10);

    // Without a number, play sequentially: 1 -> 2 -> 3 ... -> 14 -> 1.
    // Keep the counter on the command module so it survives between messages
    // while the bot process is running.
    if (!Number.isInteger(global.__junaidMeNextIndex)) global.__junaidMeNextIndex = 0;

    let index;
    if (Number.isInteger(requested) && requested >= 1 && requested <= SOUNDS.length) {
      index = requested - 1;
    } else {
      index = global.__junaidMeNextIndex % SOUNDS.length;
      global.__junaidMeNextIndex = (index + 1) % SOUNDS.length;
    }
    const file = SOUNDS[index];

    if (!fs.existsSync(file)) {
      return await sock.sendMessage(chatId, {
        text: '❌ `.me` sound file is missing from the bot package.'
      }, { quoted: message }).catch(() => {});
    }

    try {
      const audio = fs.readFileSync(file);
      await sock.sendMessage(chatId, {
        audio,
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `JUNAID MD 302-ME-${index + 1}.mp3`
      }, { quoted: message });
    } catch (error) {
      console.error('[ME] sound send failed:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to play the `.me` sound.'
      }, { quoted: message }).catch(() => {});
    }
  }
};
