const chatbot = require('../src/chatbot');

(async () => {
  try {
    console.log('Running simple chatbot tests (no OpenAI key)');
    const res1 = await chatbot.generateReply('how many ussd', {});
    console.log('Test 1:', res1);

    const res2 = await chatbot.generateReply('hello', {});
    console.log('Test 2:', res2);

    // Basic assertions
    if (!res1 || (!res1.reply && typeof res1 !== 'string')) throw new Error('res1 missing reply');
    if (!res2 || (!res2.reply && typeof res2 !== 'string')) throw new Error('res2 missing reply');

    console.log('\nSimple tests passed (note: OpenAI not invoked unless OPENAI_API_KEY is set).');
  } catch (e) {
    console.error('Chatbot tests failed:', e && e.message);
    process.exit(2);
  }
})();
