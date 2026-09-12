'use strict';

/**
 * .k / .kk
 * Kick a selected group member by mention or by replying to their message.
 * The command sender must be a group admin; the bot must also be a group admin.
 */

function norm(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0];
}

function getTargetJid(message, args = []) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid || [];
  if (mentioned.length) return mentioned[0];

  // If .k is used as a reply, target the person whose message was quoted.
  if (ctx?.participant) return ctx.participant;

  // Optional fallback: .k 923xxxxxxxxx
  const raw = String(args?.[0] || '').replace(/[^0-9]/g, '');
  if (raw.length >= 7) return `${raw}@s.whatsapp.net`;

  return null;
}

async function resolveParticipant(sock, chatId, jid) {
  try {
    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata?.participants || [];
    const n = norm(jid);
    return participants.find(p =>
      norm(p?.id) === n ||
      norm(p?.lid) === n ||
      norm(p?.phoneNumber) === n
    ) || null;
  } catch (e) {
    console.error('[KICK] participant lookup failed:', e.message);
    return null;
  }
}

function candidateJids(participant, original) {
  const values = [
    participant?.phoneNumber,
    participant?.id,
    participant?.jid,
    participant?.lid,
    original
  ].filter(Boolean).map(String);
  return [...new Set(values)];
}

module.exports = {
  command: 'k',
  aliases: ['kk', 'kickme'],
  category: 'admin',
  description: 'Kick a mentioned/replied group member with .k',
  usage: '.k @user  or  reply to user with .k',
  groupOnly: true,
  adminOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) return;

    const target = getTargetJid(message, args);
    if (!target) {
      await sock.sendMessage(chatId, {
        text: '❌ *Use:* `.k @user`\nOr reply to the member’s message with `.k`.'
      }, { quoted: message }).catch(() => {});
      return;
    }

    try {
      const metadata = await sock.groupMetadata(chatId);
      const sender = (metadata?.participants || []).find(p =>
        norm(p?.id) === norm(senderId) ||
        norm(p?.lid) === norm(senderId) ||
        norm(p?.phoneNumber) === norm(senderId)
      );
      const targetParticipant = (metadata?.participants || []).find(p =>
        norm(p?.id) === norm(target) ||
        norm(p?.lid) === norm(target) ||
        norm(p?.phoneNumber) === norm(target)
      );

      if (!sender || !['admin', 'superadmin'].includes(sender.admin)) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use `.k`.' }, { quoted: message }).catch(() => {});
        return;
      }

      if (!targetParticipant) {
        await sock.sendMessage(chatId, { text: '❌ I could not find that member in this group.' }, { quoted: message }).catch(() => {});
        return;
      }

      if (['admin', 'superadmin'].includes(targetParticipant.admin)) {
        await sock.sendMessage(chatId, { text: '❌ You cannot remove a group admin with `.k`.' }, { quoted: message }).catch(() => {});
        return;
      }

      // Delete the .k command first.
      try {
        await sock.sendMessage(chatId, { delete: message.key });
      } catch (e) {
        console.warn('[KICK] command delete failed:', e.message);
      }

      // Try every exact JID WhatsApp supplied for this participant. This is
      // important for newer @lid accounts where converting the LID to a fake
      // phone JID can make groupParticipantsUpdate() fail.
      const candidates = candidateJids(targetParticipant, target);
      let removed = false;
      let lastError = null;

      for (const jid of candidates) {
        try {
          console.log('[KICK] trying remove:', jid);
          const result = await sock.groupParticipantsUpdate(chatId, [jid], 'remove');
          const row = Array.isArray(result) ? result[0] : null;
          const status = String(row?.status || '200');
          if (status === '200' || status === '409') {
            removed = true;
            console.log('[KICK] removed:', jid, result);
            break;
          }
          lastError = new Error(`WhatsApp remove returned status ${status}`);
        } catch (e) {
          lastError = e;
          console.warn('[KICK] remove attempt failed:', jid, e.message);
        }
      }

      if (!removed) throw lastError || new Error('Unable to remove participant');
    } catch (error) {
      console.error('[KICK] remove failed:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Could not remove that member. Make sure the bot is a group admin and the target is not an admin.'
      }, { quoted: message }).catch(() => {});
    }
  }
};
