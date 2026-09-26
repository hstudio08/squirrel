const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AQ.Ab8RN6LNrxrnsovTSFbeNdMwwCm8l-aaAVz-CqZF_WA3oTxp-w');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: '6. FIRST MESSAGE RULE: This is your FIRST reply in the conversation. You MUST reply to her greeting (if she greeted), and then you MUST include this exact introduction naturally: "haadi na thoda thk nhi tha aaj, so uski jagah mai hu; mera naam qalbi hai, haadi\'s most loved assistant btw". Do not forget this!' });
model.generateContent('kya kr rhe ho?').then(r => console.log(r.response.text())).catch(e => console.error(e));
