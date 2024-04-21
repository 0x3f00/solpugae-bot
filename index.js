const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const fs = require('fs');
const urlExists = require('./urlExists');
const callAiApi = require('./callAiApi');

// get home env
const home = process.env.SOLPUGAE_HOME || '/var/solpugae';

// load settings
const settings = JSON.parse(fs.readFileSync(home + '/settings.json', 'utf8'));

const bot = new Telegraf(settings.botToken);
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))


bot.start((ctx) => ctx.reply('Welcome'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
bot.hears('@scolopendra19_bot', (ctx) => ctx.reply('Hey there'))

// ai help command
bot.command('ai', (ctx) => { 
	handleAiRequest(ctx)
})
bot.command('AI', (ctx) => { 
	handleAiRequest(ctx)
})

// test command
bot.command('test', (ctx) => { 
	console.log(ctx.message);
})

// poll for ban command
bot.command('ban', (ctx) => {
	if(!ctx.message.reply_to_message)
	{
		console.log(ctx.message);
		return ctx.reply("I can only ban messages that I replied to");
	}
	const userName = ctx.message.reply_to_message.from.first_name;

	ctx.replyWithPoll( "Забанить " + userName + "?", 
	["Да, забанить", "Нет, простить"], {
		is_anonymous: false,
		type: 'regular',
		correct_option_id: 0,
		explanation: 'Explaination',
		explanation_parse_mode: 'Markdown',
		allows_multiple_answers: false,
		open_period: 30//,
//		close_date: (new Date().getTime() / 1000) + 60 * 60 * 24,
	});
});

function handleAiRequest(ctx)
{
	ctx.sendChatAction('typing');
	//console.log(ctx.message);

	// skip 4 first chars
	var text = ctx.message.text.substr(4);
	if(ctx.message.reply_to_message)
		text = ctx.message.reply_to_message.text;
	
//	console.log("request text: " + text);

	callAiApi(settings.callAiApiUrl, text)
	.then((res) => {
		ctx.reply(res)
	})
	.catch((err) => { 
		console.log(err);
		// bot typing
		ctx.reply("Sorry, an error occurred");
	})
//	ctx.reply('Ai')

}

// features:
// list of superusers
// /var/tgbot as home
// /var/tgbot/inbox -- dump this file to superusers, then delete

function botStartup()
{
	bot.launch();
}

// repeat until internet is found 
function waitInternet()
{
	urlExists('https://api.telegram.org')
		.then((res) => {
//			console.log('Launch bot');
			botStartup();
		})
		.catch((err) => {
	  	console.error(err.message)
        console.log('Check URL...');
	  	setTimeout(waitInternet, 5000);
	});
}
waitInternet();


////////////////////////////////////////////////////
// INBOX
const inboxPath = './inbox';
fs.watch(inboxPath, (eventType, filename) => {
	//		console.log(`event type is: ${eventType}`);
	if (!filename) 
		return;

	if('rename' != eventType)
		return;

	const fullPath = inboxPath + '/' + filename;
	if (!fs.existsSync(fullPath))
		return;

	try { 				
		for(let i = 0; i < settings.superusers.length; i++)
		{
			//console.log('inboxed: ', i, " ", filename, " ", settings.superusers[i]);
			bot.telegram.sendMessage(settings.superusers[i], filename);
		}
	}
	catch(e) {
		console.log(e);
	}

	setTimeout( () => { tryRemove(fullPath)}, 500);
});

function tryRemove(fullPath)
{
	try { 
		if (fs.existsSync(fullPath))
			fs.unlinkSync(fullPath);
	}
	catch(e) {
		console.log(e);
	}
}
