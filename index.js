const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const fs = require('fs');
const urlExists = require('./urlExists');
const callAiApi = require('./callAiApi');

// get home env
const home = process.env.SOLPUGAE_HOME || '/var/solpugae';

// load settings
const settings = JSON.parse(fs.readFileSync(home + '/settings.json', 'utf8'));
var glRunningPolls = [];
var glDetectedSelfId = 0;

const bot = new Telegraf(settings.botToken);
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// start and help
bot.start((ctx) => ctx.reply(settings.textStartMessage))
bot.help((ctx) => ctx.reply(settings.textHelpMessage))

// ai text generation command
bot.command('ai', (ctx) => handleAiRequest(ctx))
bot.command('AI', (ctx) => handleAiRequest(ctx))

// test command
bot.command('test', (ctx) => console.log(ctx.message))

// erase command -- reply to bot's message so it be removed
bot.command('erase', (ctx) => handleErase(ctx))
bot.command('Erase', (ctx) => handleErase(ctx))
bot.command('del', (ctx) => handleErase(ctx))
bot.command('Del', (ctx) => handleErase(ctx))

// feature to poll for ban command
// 1. create poll
// 2. remember poll id, user id, ctx
// 3. wait for poll answers, do counting
// 4. as soon as threshold is reached, ban user, remove poll
// 5. on timeout, remove poll

// poll for ban command
bot.hears('ban', (ctx) => handleBan(ctx));
bot.hears('Ban', (ctx) => handleBan(ctx));
bot.on('poll_answer', (ctx) => handleAnswer(ctx))

// Initialization
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


function handleAnswer(ctx)
{
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
		doBan(pollName);
		return;
	}

	if(glRunningPolls[pollName].forgiveCount >= settings.banThreshold)
	{
		doForgive(pollName);
		return;
	}
}

function handleBan(ctx)
{
	if(!ctx.message.reply_to_message || !ctx.message.reply_to_message.text)
	{
		console.log(ctx.message);
		return ctx.reply(settings.textErrorReplyIsNeeded);
	}
	const userName = ctx.message.reply_to_message.from.first_name;
	var prompt = settings.textBanQuestion.replace('%USERNAME%', userName);

	const poll = ctx.replyWithPoll( prompt, 
	[settings.textBanOptionBan, settings.textBanOptionForgive], {
		is_anonymous: false,
		type: 'regular',
		correct_option_id: 0,
		explanation: 'Explaination',
		explanation_parse_mode: 'Markdown',
		allows_multiple_answers: false,
		open_period: settings.banPollDuration /* in seconds */
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
		}, (settings.banPollDuration + 5) * 1000);
//		console.log(glRunningPolls);
	})
}

function doPollCleanup(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	glRunningPolls[pollName].ctx.deleteMessage(glRunningPolls[pollName].pollMessageId).catch((e) => console.log(e));
	glRunningPolls[pollName].ctx.deleteMessage(glRunningPolls[pollName].banMessageId).catch((e) => console.log(e));

	glRunningPolls[pollName].shown = false;

	delete glRunningPolls[pollName];
//	console.log("Poll removed: " + pollName);
//	console.log(glRunningPolls);
}

function doBan(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	var banReportHtml = settings.textBanReportHtml.replace('%USERNAME%', glRunningPolls[pollName].targetUserName);
	glRunningPolls[pollName].ctx.replyWithHTML(banReportHtml);
	
	if(0 != glRunningPolls[pollName].targetUserId 
		&& glDetectedSelfId != glRunningPolls[pollName].targetUserId)
	{
		glRunningPolls[pollName].ctx.banChatMember(glRunningPolls[pollName].targetUserId).catch((e) => console.log(e));
	}

	doPollCleanup(pollName);
}

function doForgive(pollName)
{
	if(null == glRunningPolls[pollName])
		return;

	if(!glRunningPolls[pollName].shown)
		return;

	var forgiveReportHtml = settings.textForgiveReportHtml.replace('%USERNAME%', glRunningPolls[pollName].targetUserName);
	glRunningPolls[pollName].ctx.replyWithHTML(forgiveReportHtml);
	doPollCleanup(pollName);
}

function handleErase(ctx)
{
	console.log(ctx.message);
	const targetMessageId = ctx.message.reply_to_message.message_id;
	const messageId = ctx.message.message_id;
	const targetUserId = ctx.message.reply_to_message.from.id;

	if(0 == glDetectedSelfId)
	{
		ctx.reply(settings.textRemoving).then((msg) => {
			glDetectedSelfId = msg.from.id;
			const currMessageId = msg.message_id;
			ctx.deleteMessage(currMessageId);
			if(glDetectedSelfId == targetUserId) // delete only if message was sent by bot
				ctx.deleteMessage(targetMessageId);
		});
	}

	if(glDetectedSelfId == targetUserId) // delete only if message was sent by bot
		ctx.deleteMessage(targetMessageId);

	ctx.deleteMessage(messageId).catch((e) => console.log(e));
}

function handleAiRequest(ctx)
{
	ctx.sendChatAction('typing');

	// skip 4 first chars "/ai "
	var text = ctx.message.text.substr(4);
	if(ctx.message.reply_to_message && ctx.message.reply_to_message.text)
		text = ctx.message.reply_to_message.text;

	if(!text || text.length == 0)
	{
		ctx.reply(settings.textErrorTextIsMissing).then((msg) => {
			console.log(msg);
			glDetectedSelfId = msg.from.id;
		});
		return;
	}

	if(text.length > 500)
	{
		ctx.reply(settings.textErrorTextTooLong).then((msg) => {
			console.log(msg);
			glDetectedSelfId = msg.from.id;
		});
		return;
	}
	
//	console.log("request text: " + text);

	callAiApi(settings.callAiApiUrl, settings.textAiPrompt, text)
	.then((res) => {
		ctx.reply(res).then((msg) => {
			console.log(msg);
			glDetectedSelfId = msg.from.id;
		})
	})
	.catch((err) => { 
		console.log(err);
		ctx.reply(settings.textErrorOccured);
	})
}

// Inbox feature:
// /var/solpugae as home
// /var/solpugae/inbox -- dump appeared files to superusers, then delete


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


// Utils
const escapeHTML = str =>
  str.replace(
    /[&<>'"]/g,
    tag =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
  );
