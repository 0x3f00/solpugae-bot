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


bot.start((ctx) => ctx.reply('Welcome! Available commands: /ban, /ai'))
bot.help((ctx) => ctx.reply('Available commands: /ban, /ai'))

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

// feature to poll for ban command
// 1. create poll
// 2. remember poll id, user id, ctx
// 3. wait for poll answers, do counting
// 4. as soon as threshold is reached, ban user, remove poll
// 5. on timeout, remove poll

var glRunningPolls = [];
// poll for ban command
bot.command('ban', (ctx) => {
	if(!ctx.message.reply_to_message || !ctx.message.reply_to_message.text)
	{
		console.log(ctx.message);
		return ctx.reply("I can only ban messages that I replied to");
	}
	const userName = ctx.message.reply_to_message.from.first_name;

	const poll = ctx.replyWithPoll( "Забанить " + userName + "?", 
	["Да, забанить", "Нет, простить"], {
		is_anonymous: false,
		type: 'regular',
		correct_option_id: 0,
		explanation: 'Explaination',
		explanation_parse_mode: 'Markdown',
		allows_multiple_answers: false,
		open_period: 20
	});

	poll.then((res) => {
		console.log(res);
		const pollName = res.poll.id;
		const obj = {
			pollMessageId: res.message_id,
			targetUserName: userName,
			targetUserId: ctx.message.reply_to_message.from.id,
			banMessageId: ctx.message.message_id,
			ctx: ctx,
			banCount: 0,
			forgiveCount: 0,
			shown: true
		}
		glRunningPolls[pollName] = obj;
		setTimeout(() => {
			doPollCleanup(pollName);			
		}, 30 * 1000);
		console.log(glRunningPolls);
	})
});


function doPollCleanup(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	glRunningPolls[pollName].ctx.deleteMessage(glRunningPolls[pollName].pollMessageId);
	glRunningPolls[pollName].ctx.deleteMessage(glRunningPolls[pollName].banMessageId);

	glRunningPolls[pollName].shown = false;

	delete glRunningPolls[pollName];
//	console.log("Poll removed: " + pollName);
//	console.log(glRunningPolls);
}

bot.on('poll_answer', (ctx) => {
	console.log(ctx.update);
	console.log("---");

	const pollName = ctx.update.poll_answer.poll_id;
	if(null == glRunningPolls[pollName])
		return;

	if(ctx.update.poll_answer.option_ids[0] == 0)
		glRunningPolls[pollName].banCount = glRunningPolls[pollName].banCount + 1;
	
	if(ctx.update.poll_answer.option_ids[0] == 1)
		glRunningPolls[pollName].forgiveCount = glRunningPolls[pollName].forgiveCount + 1;

	if(glRunningPolls[pollName].banCount >= settings.banThreshold)
	{
		doForgive(pollName);
		return;
	}

	if(glRunningPolls[pollName].forgiveCount >= settings.banThreshold)
	{
		doForgive(pollName);
		return;
	}
})

function doBan(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	glRunningPolls[pollName].ctx.replyWithHTML("<b>" + glRunningPolls[pollName].targetUserName + "</b> забанен!");
	glRunningPolls[pollName].ctx.banChatMember(glRunningPolls[pollName].targetUserId);

	doPollCleanup(pollName);
}

function doForgive(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	glRunningPolls[pollName].ctx.replyWithHTML("<b>" + glRunningPolls[pollName].targetUserName + "</b> прощен!");
	doPollCleanup(pollName);
}

function handleAiRequest(ctx)
{
	ctx.sendChatAction('typing');
	//console.log(ctx.message);

	// skip 4 first chars
	var text = ctx.message.text.substr(4);
	if(ctx.message.reply_to_message && ctx.message.reply_to_message.text)
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
// /var/solpugae as home
// /var/solpugae/inbox -- dump this file to superusers, then delete

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
const inboxPath = home + '/inbox';
if(fs.existsSync(inboxPath))
{
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
}

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
