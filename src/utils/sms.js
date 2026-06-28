const https = require('https');
const http = require('http');

/**
 * Send an SMS via SMSBox.com
 * @param {string} phone  - recipient number, e.g. "96555107000" or "55107000"
 * @param {string} message
 */
async function sendSms(phone, message) {
  // Normalise: ensure it starts with 965 (Kuwait)
  let number = String(phone).replace(/\D/g, '');
  if (!number.startsWith('965')) number = '965' + number;

  const username   = process.env.SMSBOX_USERNAME  || 'ShiryKidsFun';
  const password   = process.env.SMSBOX_PASSWORD  || '';
  const customerId = process.env.SMSBOX_CUSTOMER_ID || '3536';
  const sender     = process.env.SMSBOX_SENDER    || 'SHIRYKIDS';

  const url =
    `http://smsbox.com/smsgateway/services/messaging.asmx/Http_SendSMS` +
    `?username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}` +
    `&customerid=${encodeURIComponent(customerId)}` +
    `&sendertext=${encodeURIComponent(sender)}` +
    `&messagebody=${encodeURIComponent(message)}` +
    `&recipientnumbers=${encodeURIComponent(number)}` +
    `&defdate=&isblink=false&isflash=false`;

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[SMS]', number, '->', data.trim());
        resolve(data);
      });
    }).on('error', reject);
  });
}

module.exports = { sendSms };
