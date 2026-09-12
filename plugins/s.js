'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('stickers-formatter');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const BRAND = 'JUNAID MD 302';

async function streamToBuffer(media, type) {
  const stream = await downloadContentFromMessage(media, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function videoToFrame(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'junaid-s-'));
  const input = path.join(dir, 'input.mp4');
  const output = path.join(dir, 'frame.png');
  try {
    fs.writeFileSync(input, buffer);
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-y', '-i', input, '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease', output
    ]);
    return fs.readFileSync(output);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function makeBrandedSticker(inputBuffer) {
  const width = 512;
  const imageArea = 424;
  const textArea = 88;

  const resized = await sharp(inputBuffer)
    .rotate()
    .resize(imageArea, imageArea, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const svg = Buffer.from(`<svg width="${width}" height="${textArea}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .name { font-family: Arial, sans-serif; font-size: 34px; font-weight: 800; }
    </style>
    <text x="256" y="55" text-anchor="middle" class="name" fill="#ffffff" stroke="#000000" stroke-width="5" paint-order="stroke">${BRAND}</text>
  </svg>`);

  const canvas = await sharp({
    create: {
      width,
      height: width,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: resized, left: 44, top: 0 },
      { input: svg, left: 0, top: imageArea }
    ])
    .png()
    .toBuffer();

  const sticker = new Sticker(canvas, {
    pack: 'JUNAID MD 302',
    author: 'JUNAID MD 302',
    type: StickerTypes.DEFAULT,
    quality: 85,
    categories: ['✨', '🤖']
  });

  return sticker.toBuffer();
}

module.exports = {
  command: 's',
  aliases: ['stickername2', 'brandedsticker'],
  category: 'stickers',
  description: 'Make a sticker with JUNAID MD 302 written underneath',
  usage: '.s (reply to an image/video)',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const current = message.message;
    const media = quoted || current;
    const image = media?.imageMessage;
    const video = media?.videoMessage;

    if (!image && !video) {
      return await sock.sendMessage(chatId, {
        text: '❌ Reply to an image/video with *.s* to make a sticker.\n\nSticker name: *JUNAID MD 302*'
      }, { quoted: message });
    }

    try {
      let input;
      if (image) {
        input = await streamToBuffer(image, 'image');
      } else {
        const videoBuffer = await streamToBuffer(video, 'video');
        input = await videoToFrame(videoBuffer);
      }

      const stickerBuffer = await makeBrandedSticker(input);
      await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
    } catch (error) {
      console.error('[S BRANDED STICKER] Error:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Sticker नहीं बन सका। कृपया image/video पर reply करके फिर *.s* भेजें।'
      }, { quoted: message });
    }
  }
};
