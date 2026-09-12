'use strict';
const fakevCard = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "© JUNAID↣³⁰²😡🚩☠️",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:REDXBOT302\nORG:JUNAID↣³⁰²;\nTEL;type=CELL;type=VOICE;waid=+923442174513:+92 344 2174513\nEND:VCARD`
        }
    }
};
// Export both ways so all plugins work regardless of import style
module.exports = fakevCard;
module.exports.fakevCard = fakevCard;
module.exports.default = fakevCard;
