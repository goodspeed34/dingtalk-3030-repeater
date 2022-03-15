const WATING = 2
const SENDING_COOL_DOWN = 1 * 60 * 1000
const DINGTALK_LOGIN_URL = "https://im.dingtalk.com/"

let sending = false;
let messageCount = 0;
let messagePool = [];

let lastSend = "";

const webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until,
    Key = webdriver.Key
const drv = new webdriver.Builder()
    .forBrowser('chrome').build()

function logCatch (e) {
    console.log(e)
}

async function appendMessages(messages)
{
    for (const el of messages) {
        messagePool.push({
            "time": Math.floor(Date.now() / 1000),
            "content": await el.getText()
        })
    };
}

async function doSend(content)
{
    if (content == lastSend) return
    if (sending) return
    console.log("Sending message: ", content)
    sending = true
    setTimeout(() => { sending = false }, SENDING_COOL_DOWN)

    await drv.wait(until.elementLocated(By.xpath('//textarea')), 60 * 1000)

    let textarea = await drv.findElement(By.xpath('//textarea')).catch(logCatch)
    await textarea.sendKeys(content)
    
    drv.executeScript("arguments[0].focus();", textarea)
    await textarea.sendKeys(Key.ENTER)

    lastSend = content
}

async function doCheck()
{
    /* 若前 N 条信息一样，复读一次。 */
    let content
    for (let i = 1; i < WATING+1; i++) {
        if (i == 1) { content = messagePool[messagePool.length-i]["content"] }
        if (messagePool[messagePool.length-i]["content"] != content) { break }
        if (i == WATING) { await doSend(content) }
    }
}

const run = async () =>
{
    drv.get(DINGTALK_LOGIN_URL)

    // Wait 1min for the user to login.
    await drv.wait(until.elementLocated(By.id('menu-pannel')), 60 * 1000)
    console.log("we're successfully logged in")

    // Click the "Continue to use" button.
    drv.findElement(By.xpath("//button[@ng-click='updateMsgModal.ok()']"))
        .then(el => {
            el.click();
        }).catch((e) => {
            console.log("there's no need to press continue button")
        })

    // Check if we're in the chat room.
    await drv.wait(until.elementLocated(By.className('chat-head')), 60 * 1000)
    console.log("chat room joined")

    drv.findElement(By.xpath("//span[@ng-bind-html='chat.conv.i18nTitle|emoj']"))
        .then(async (el) => {
            const n = await el.getText()
            console.log("dealing with ", n.trim())
        })
    
    // Initialize message count
    messageCount = (await drv.findElements(
        By.xpath('//pre[@ng-if="::!msg.isCodeSnippet"]'))).length
    // Regularly check for messages
    setInterval(async () => {
        const messages = await drv.findElements(By.xpath('//pre[@ng-if="::!msg.isCodeSnippet"]'))
        // Exit if no further messages were received
        if (messages.length <= messageCount) return
        // Update message pool to store new messages
        await appendMessages(messages.slice(- (messages.length - messageCount)))
        messageCount = messages.length

        try { await doCheck(); }
        catch (e) { logCatch(e) }
    }, 1 * 1000);
}

run()